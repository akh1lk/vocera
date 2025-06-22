import os
from flask import Flask, request, jsonify
import numpy as np
from scipy.spatial.distance import euclidean
from itertools import combinations
import tempfile
from sklearn.preprocessing import StandardScaler

from feature_extractor import (
    extract_opensmile_features,
    create_scaler_from_features,
    serialize_scaler,
    deserialize_scaler,
)
from database import FileDatabase

app = Flask(__name__)

# In-memory database
db = FileDatabase()

# Tunable parameters for scoring thresholds
# Note: These may need adjustment after normalization
OPEN_SMILE_THRESHOLD_MULTIPLIER = 1.8


@app.route("/calibrate", methods=["POST"])
def calibrate():
    """
    Calibrates a user's voice profile with StandardScaler normalization.
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

        # Extract raw features first (without normalization)
        raw_feature_vectors = [extract_opensmile_features(f) for f in temp_files]

        # Create and fit StandardScaler on the calibration data
        try:
            scaler = create_scaler_from_features(raw_feature_vectors)
        except ValueError as e:
            return jsonify({"error": f"Scaler creation failed: {str(e)}"}), 400

        # Apply normalization to all calibration vectors
        normalized_vectors = []
        for raw_vector in raw_feature_vectors:
            normalized_vector = scaler.transform(raw_vector.reshape(1, -1)).flatten()
            normalized_vectors.append(normalized_vector)

        # Calculate average Euclidean distance on NORMALIZED features
        os_distances = [
            euclidean(pair[0], pair[1]) for pair in combinations(normalized_vectors, 2)
        ]
        avg_euclidean_distance = np.mean(os_distances)

        # Serialize scaler for storage
        serialized_scaler = serialize_scaler(scaler)

        # Store in the database (now includes scaler)
        db.upsert_profile(
            {
                "user_id": user_id,
                "opensmile_vectors": normalized_vectors,
                "avg_euclidean_distance": avg_euclidean_distance,
                "scaler": serialized_scaler,  # Store scaler parameters
                "feature_normalization": "StandardScaler",  # Track normalization method
            }
        )

        print(f"✅ Calibration successful for {user_id}")
        print(f"   Normalized avg distance: {avg_euclidean_distance:.4f}")
        print(
            f"   Raw avg distance would have been: {np.mean([euclidean(pair[0], pair[1]) for pair in combinations(raw_feature_vectors, 2)]):.4f}"
        )

    except Exception as e:
        # Clean up temp files in case of error
        for temp_file_path in temp_files:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up temp files
        for temp_file_path in temp_files:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    return jsonify(
        {
            "status": "calibration successful with StandardScaler normalization",
            "user_id": user_id,
            "files_received": len(files),
            "normalized_avg_distance": avg_euclidean_distance,
        }
    )


@app.route("/verify", methods=["POST"])
def verify():
    """
    Verifies a user's voice against their normalized profile.
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

        # Fetch user profile from the database
        profile = db.get_profile(user_id)
        if not profile:
            return jsonify({"error": "User profile not found"}), 404

        # Check if profile has scaler (backward compatibility)
        if "scaler" not in profile:
            return (
                jsonify(
                    {
                        "error": "User profile missing normalization scaler. Please re-calibrate this user."
                    }
                ),
                400,
            )

        baseline_os_vectors = profile["opensmile_vectors"]
        baseline_avg_euclidean_dist = profile["avg_euclidean_distance"]

        # Deserialize the scaler
        try:
            scaler = deserialize_scaler(profile["scaler"])
        except Exception as e:
            return jsonify({"error": f"Failed to load scaler: {str(e)}"}), 500

        # Extract and normalize features from verification file
        raw_verify_vector = extract_opensmile_features(temp_file_path)
        verify_os_vector = scaler.transform(raw_verify_vector.reshape(1, -1)).flatten()

        # --- openSMILE Verification (on normalized features) ---
        os_distances = [euclidean(verify_os_vector, v) for v in baseline_os_vectors]
        avg_os_distance = np.mean(os_distances)

        # --- Scoring Logic (Sigmoid Function for Deepfake Confidence) ---
        # The confidence score reflects the likelihood that a voice is a deepfake.
        # This is based on a sigmoid function where a higher distance results
        # in a higher "deepfake confidence" score. The function is tuned to meet
        # the following points based on the distance ratio (verification_dist / baseline_dist):
        #   - Ratio 1.25x -> 10% deepfake confidence
        #   - Ratio 3.00x -> 90% deepfake confidence
        if baseline_avg_euclidean_dist > 0:
            distance_ratio = avg_os_distance / baseline_avg_euclidean_dist
        else:
            # Avoid division by zero; treat as a large distance if baseline is zero
            distance_ratio = 1e9

        # Parameters for the INCREASING sigmoid function: C(r) = 100 / (1 + exp(-k*(r - r0)))
        # Solved for C(1.25)=10 and C(3.0)=90
        k = (2 * np.log(9)) / 1.75  # Steepness of the curve (approx 2.51)
        r0 = 2.125  # Midpoint of the curve (where deepfake confidence is 50%)

        # Calculate the confidence that the sample is a deepfake
        deepfake_confidence = 100 / (1 + np.exp(-k * (distance_ratio - r0)))

        # The final score represents confidence in AUTHENTICITY
        opensmile_score = deepfake_confidence

        # --- Final Prediction ---
        prediction = True if opensmile_score >= 50 else False

        return jsonify(
            {
                "prediction": prediction,
                "confidence": opensmile_score,
                "details": {
                    "baseline_avg_euclidean_dist": baseline_avg_euclidean_dist,
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
    """Retrieves a user's profile from the database for debugging."""
    profile = db.get_profile(user_id)
    if not profile:
        return jsonify({"error": "User profile not found"}), 404

    # Create a serializable copy of the profile data
    profile_copy = {
        "user_id": profile["user_id"],
        "opensmile_vectors": [v.tolist() for v in profile["opensmile_vectors"]],
        "avg_euclidean_distance": profile["avg_euclidean_distance"],
        "feature_normalization": profile.get("feature_normalization", "None"),
        "has_scaler": "scaler" in profile,
    }

    return jsonify(profile_copy)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
