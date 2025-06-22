import os
from flask import Flask, request, jsonify
import numpy as np
from scipy.spatial.distance import euclidean
from itertools import combinations
import tempfile
from sklearn.preprocessing import StandardScaler
import requests
from dotenv import load_dotenv

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set up file logging
file_handler = logging.FileHandler("voice_detect.log")
file_handler.setLevel(logging.INFO)
file_formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
file_handler.setFormatter(file_formatter)
logger.addHandler(file_handler)


from feature_extractor import (
    extract_opensmile_features,
    create_scaler_from_features,
    serialize_scaler,
    deserialize_scaler,
)
from database import SupabaseDatabase
from speaker_verification import verify_speaker_from_data

from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

app = Flask(__name__)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Use SupabaseDatabase instead of FileDatabase
db = SupabaseDatabase(supabase_client=supabase)

# Tunable parameters for scoring thresholds
# Note: These may need adjustment after normalization
OPEN_SMILE_THRESHOLD_MULTIPLIER = 1.8


# TODO not sure if this would actually work
def download_audio_from_url(audio_url):
    """
    Downloads an audio file from the supabase bucket URL and saves it to a temporary local file.
    """
    try:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        response = requests.get(audio_url, stream=True)
        response.raise_for_status()
        for chunk in response.iter_content(chunk_size=8192):
            temp_file.write(chunk)
        temp_file.close()
        return temp_file.name
    except requests.exceptions.RequestException as e:
        print(f"Error: Failed to download file from URL. {e}")
        return None


# TODO are we able to send the vectors to the supabase?
@app.route("/calibrate", methods=["POST"])
def calibrate():
    """
    Calibrates a user's voice profile with StandardScaler normalization.
    Expects 10 .wav files and a vox_key_id.
    """
    # Check for required form fields
    if "vox_key_id" not in request.form:
        return jsonify({"error": "vox_key_id is required"}), 400

    vox_key_id = request.form.get("vox_key_id")

    # Get audio files - they should be in the 'audio_files' field
    files = request.files.getlist("audio_files")

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

        # Send the vectors directly to the existing vox_key
        success = db.send_vox_vectors(vox_key_id, normalized_vectors)

        if not success:
            return jsonify({"error": "Failed to save vectors to database"}), 500

        print(f"✅ Calibration successful for vox_key_id: {vox_key_id}")
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
            "vox_key_id": vox_key_id,
            "files_received": len(files),
            "normalized_avg_distance": avg_euclidean_distance,
        }
    )


# TODO: A LOT OF THIS STUFF NEEDS TO BE FIXED, BECAUSE IT'S NOT ACTUALLY INDEXING THROUGH SUPABASE
@app.route("/verify", methods=["POST"])
def verify():
    """
    Verifies a user's voice against their normalized profile.
    Expects 1 .wav file and a id.
    """
    if "id" not in request.form:
        return jsonify({"error": "id is required"}), 400

    id = request.form.get("id")
    files = request.files.getlist("files")

    if len(files) != 1:
        return jsonify({"error": "1 audio file is required for verification"}), 400

    temp_file_path = None
    reference_audio_path = None
    try:
        # Save file temporarily

        # this temp file is the one that we're verifying against the profile, from the suspicious caller
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            files[0].save(temp_file)
            temp_file_path = temp_file.name

        # Fetch user profile from the database
        profile = db.get_profile(
            "63da7120-0f9a-4087-a5bb-fefa574115f6"
        )  # TODO hardcoded for now
        if not profile:
            logger.error(f"ln 186 error could not find {id}")
            return jsonify({"error": "User profile not found"}), 404

        # --- Speaker Verification (Primary) ---
        speaker_verification_result = ("model_not_run", (False, 0.0))
        training_url = profile.get("training_audio_url")

        if training_url:
            reference_audio_path = download_audio_from_url(training_url)
            if reference_audio_path:
                # Placeholder for your actual function call
                speaker_verification_result = verify_speaker_from_data(
                    reference_audio_path, temp_file_path
                )
                print(
                    f"Calling speaker verification with: {reference_audio_path} and {temp_file_path}"
                )
            else:
                print(
                    "Warning: Failed to download reference audio. Skipping speaker verification."
                )
                speaker_verification_result = ("download_failed", (False, 0.0))

        # --- openSMILE Verification (Secondary) ---
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
        # Prediction is True if authenticity score is >= 50
        prediction = True if opensmile_score >= 50 else False

        return jsonify(
            {
                "prediction": prediction,
                "confidence": opensmile_score,
                "details": {
                    "opensmile_score": opensmile_score,
                    "baseline_avg_euclidean_dist": baseline_avg_euclidean_dist,
                    "avg_verification_euclidean_distance": avg_os_distance,
                    "normalization": profile.get(
                        "feature_normalization", "StandardScaler"
                    ),
                    "speaker_verification_model": speaker_verification_result[0],
                    "speaker_verification_result": speaker_verification_result[1],
                },
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if reference_audio_path and os.path.exists(reference_audio_path):
            os.remove(reference_audio_path)


# NOTE lowkey i don't think we need this?
# @app.route("/get_profile/<user_id>", methods=["GET"])
# def get_profile(user_id):
#     """Retrieves a user's profile from the database for debugging."""
#     profile = db.get_profile(user_id)
#     if not profile:
#         logger.error(f"ln 284 error could not find {user_id}")
#         return jsonify({"error": "User profile not found"}), 404

#     # Create a serializable copy of the profile data
#     profile_copy = {
#         "user_id": profile["user_id"],
#         "opensmile_vectors": [v.tolist() for v in profile["opensmile_vectors"]],
#         "avg_euclidean_distance": profile["avg_euclidean_distance"],
#         "feature_normalization": profile.get("feature_normalization", "None"),
#         "has_scaler": "scaler" in profile,
#     }

#     return jsonify(profile_copy)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
