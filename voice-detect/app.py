import os
from flask import Flask, request, jsonify
import numpy as np
from scipy.spatial.distance import euclidean
from itertools import combinations
import tempfile

from feature_extractor import extract_opensmile_features
from database import FileDatabase
from textualcheck import (
    transcribe_audio,
    compare_transcriptions,
    EXPECTED_TRANSCRIPTION,
)

app = Flask(__name__)

# File-based database
db = FileDatabase()

# Tunable parameters for scoring thresholds
OPEN_SMILE_THRESHOLD_MULTIPLIER = 1.8


def calculate_avg_percent_diff(v1, v2):
    """
    Calculates the average percent difference between two vectors,
    handling division by zero.
    """
    v1 = np.array(v1)
    v2 = np.array(v2)
    denominator = (v1 + v2) / 2
    
    # Calculate percent differences, returning 0 where the denominator is 0
    percent_diffs = np.divide(
        np.abs(v1 - v2), 
        denominator, 
        out=np.zeros_like(denominator, dtype=float), 
        where=denominator!=0
    )
    return np.mean(percent_diffs)


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

        # Calculate average percent difference between feature vectors
        percent_diffs = [
            calculate_avg_percent_diff(pair[0], pair[1]) for pair in combinations(opensmile_vectors, 2)
        ]
        avg_percent_difference = np.mean(percent_diffs)

        # Store in the database
        db.upsert_profile(
            {
                "user_id": user_id,
                "opensmile_vectors": opensmile_vectors,
                "avg_percent_difference": avg_percent_difference,
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

    # --- Textual Verification ---
    # This will print the result to the console and then continue.
    # It will not stop the voice verification if it fails.
    try:
        # Rewind the stream to ensure we're at the beginning.
        files[0].stream.seek(0)
        transcribed_text = transcribe_audio(files[0].stream, files[0].filename)
        print(f"Transcribed text: {transcribed_text}")
        is_match = compare_transcriptions(transcribed_text, EXPECTED_TRANSCRIPTION)
        if not is_match:
            return jsonify(
                {
                    "prediction": "deepfake",
                    "confidence": -1,
                    "details": {},
                }
            )

    except Exception as e:
        print(f"\n⚠️  WARNING: Could not perform textual check. Reason: {e}\n")

    # --- Voice Verification (Existing Logic) ---
    temp_file_path = None
    try:
        # IMPORTANT: Rewind the stream again so it can be saved to a file for openSMILE.
        files[0].stream.seek(0)

        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            files[0].save(temp_file)
            temp_file_path = temp_file.name

        # Fetch user profile from the database
        profile = db.get_profile(user_id)
        if not profile:
            return jsonify({"error": "User profile not found"}), 404

        baseline_os_vectors = profile["opensmile_vectors"]
        baseline_avg_percent_diff = profile["avg_percent_difference"]

        # Extract features from verification file
        verify_os_vector = extract_opensmile_features(temp_file_path)

        # --- openSMILE Verification ---
        # Calculate the average percent difference between the verification vector and each baseline vector.
        percent_diffs = [calculate_avg_percent_diff(verify_os_vector, v) for v in baseline_os_vectors]
        avg_verification_percent_diff = np.mean(percent_diffs)

        # --- Scoring Logic ---
        # This logic remains the same, but now uses the normalized percent difference.
        opensmile_threshold = (
            OPEN_SMILE_THRESHOLD_MULTIPLIER * baseline_avg_percent_diff
        )
        # Handle case where threshold could be zero to avoid division by zero
        if opensmile_threshold == 0:
            # If the threshold is 0, any non-zero difference means a mismatch.
            opensmile_score = -100 if avg_verification_percent_diff > 0 else 100
        else:
            opensmile_score = 100 * (1 - (avg_verification_percent_diff / opensmile_threshold))

        # --- Final Prediction ---
        # The prediction is based on whether the confidence is above 50.
        prediction = True if opensmile_score >= 50 else False

        return jsonify(
            {
                "prediction": prediction,
                "confidence": opensmile_score,
                "details": {
                    "opensmile_score": opensmile_score,
                    "avg_verification_percent_difference": avg_verification_percent_diff,
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
        "avg_percent_difference": profile["avg_percent_difference"],
    }

    return jsonify(profile_copy)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
