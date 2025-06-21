import os
from flask import Flask, request, jsonify
import numpy as np
from scipy.spatial.distance import euclidean
from itertools import combinations
import tempfile

from feature_extractor import extract_opensmile_features
from database import FileDatabase

app = Flask(__name__)

# File-based database
db = FileDatabase()

# Tunable parameters for scoring thresholds
OPEN_SMILE_THRESHOLD_MULTIPLIER = 1.8


@app.route("/calibrate", methods=["POST"])
def calibrate():
    """
    Calibrates a user's voice profile.
    Expects 10 .wav files and a user_id.
    """
    if "user_id" not in request.form:
        return jsonify({"error": "user_id is required"}), 400

    user_id = request.form.get("user_id")
    files = request.files.getlist("files")

    if len(files) != 10:
        return jsonify({"error": "10 audio files are required for calibration"}), 400

    temp_files = []
    try:
        # Save files temporarily
        for file in files:
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
            file.save(temp_file.name)
            temp_files.append(temp_file.name)

        # Extract features
        opensmile_vectors = [extract_opensmile_features(f) for f in temp_files]

        # Calculate average Euclidean distance for openSMILE
        os_distances = [
            euclidean(pair[0], pair[1]) for pair in combinations(opensmile_vectors, 2)
        ]
        avg_euclidean_distance = np.mean(os_distances)

        # Store in the in-memory database
        db.upsert_profile(
            {
                "user_id": user_id,
                "opensmile_vectors": opensmile_vectors,
                "avg_euclidean_distance": avg_euclidean_distance,
            }
        )

    except Exception as e:
        # Clean up temp files in case of error
        for temp_file_path in temp_files:
            os.remove(temp_file_path)
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up temp files
        for temp_file_path in temp_files:
            os.remove(temp_file_path)

    return jsonify(
        {
            "status": "calibration received",
            "user_id": user_id,
            "files_received": len(files),
        }
    )


@app.route("/verify", methods=["POST"])
def verify():
    """
    Verifies a user's voice against their profile.
    Expects 1 .wav file and a user_id.
    """
    if "user_id" not in request.form:
        return jsonify({"error": "user_id is required"}), 400

    user_id = request.form.get("user_id")
    files = request.files.getlist("files")

    if len(files) != 1:
        return jsonify({"error": "1 audio file is required for verification"}), 400

    temp_file_path = None
    try:
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            files[0].save(temp_file)
            temp_file_path = temp_file.name

        # Fetch user profile from the in-memory database
        profile = db.get_profile(user_id)
        if not profile:
            return jsonify({"error": "User profile not found"}), 404

        baseline_os_vectors = profile["opensmile_vectors"]
        baseline_avg_euclidean_dist = profile["avg_euclidean_distance"]

        # Extract features from verification file
        verify_os_vector = extract_opensmile_features(temp_file_path)

        # --- openSMILE Verification ---
        # Calculate the Euclidean distance between the verification vector and each baseline vector.
        # A smaller distance signifies a closer match.
        os_distances = [euclidean(verify_os_vector, v) for v in baseline_os_vectors]
        avg_os_distance = np.mean(os_distances)

        # --- Scoring Logic ---
        # Convert raw distance values into an intuitive score. A score of 100
        # is a perfect match. A score becomes negative if the verification distance is
        # significantly larger than the user's typical baseline distance, correctly
        # penalizing a likely mismatch.

        # openSMILE Scoring:
        # The threshold uses a tunable multiplier on the user's baseline distance.
        opensmile_threshold = (
            OPEN_SMILE_THRESHOLD_MULTIPLIER * baseline_avg_euclidean_dist
        )
        opensmile_score = 100 * (1 - (avg_os_distance / opensmile_threshold))

        # --- Final Prediction ---
        # The final confidence is now just the opensmile_score.
        # The prediction is based on whether the confidence is above 50.
        prediction = "authentic" if opensmile_score >= 50 else "deepfake"

        return jsonify(
            {
                "prediction": prediction,
                "confidence": opensmile_score,
                "details": {
                    "opensmile_score": opensmile_score,
                    "avg_verification_euclidean_distance": avg_os_distance,
                },
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.route("/get_profile/<user_id>", methods=["GET"])
def get_profile(user_id):
    """Retrieves a user's profile from the file-based database for debugging."""
    profile = db.get_profile(user_id)
    if not profile:
        return jsonify({"error": "User profile not found"}), 404

    # Create a serializable copy of the profile data
    profile_copy = {
        "user_id": profile["user_id"],
        "opensmile_vectors": [v.tolist() for v in profile["opensmile_vectors"]],
        "avg_euclidean_distance": profile["avg_euclidean_distance"],
    }

    return jsonify(profile_copy)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
