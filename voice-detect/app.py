import os
from flask import Flask, request, jsonify
import numpy as np
from scipy.spatial.distance import euclidean
from itertools import combinations
import tempfile
from sklearn.preprocessing import StandardScaler
import requests
from dotenv import load_dotenv
from pydub import AudioSegment

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

# from speaker_verification import verify_speaker_from_data  # COMMENTED OUT FOR MINIMAL DEPLOYMENT

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


def convert_audio_to_wav(input_path):
    """
    Converts any audio file to WAV format using pydub.

    Args:
        input_path (str): Path to input audio file

    Returns:
        str: Path to converted WAV file, or None if conversion failed
    """
    try:
        # Detect format from file header
        with open(input_path, "rb") as f:
            header = f.read(16)

        # Determine input format
        if b"ftyp" in header and b"M4A" in header:
            input_format = "m4a"
        elif header.startswith(b"RIFF") and b"WAVE" in header:
            # Already WAV format
            return input_path
        elif header.startswith(b"\xff\xfb") or header.startswith(b"ID3"):
            input_format = "mp3"
        else:
            # Try to auto-detect
            input_format = None

        # Load audio with pydub
        if input_format:
            audio = AudioSegment.from_file(input_path, format=input_format)
        else:
            audio = AudioSegment.from_file(input_path)

        # Create new temp file for WAV output
        wav_temp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        wav_path = wav_temp.name
        wav_temp.close()

        # Export as WAV
        audio.export(wav_path, format="wav")

        logger.info(f"Successfully converted audio file to WAV: {wav_path}")
        return wav_path

    except Exception as e:
        logger.error(f"Error converting audio file {input_path}: {e}")
        return None


def download_audio_from_url(audio_url):
    """
    Downloads an audio file from the supabase bucket URL and saves it to a temporary local file.
    """
    try:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".m4a", mode="wb")
        response = requests.get(audio_url, stream=True)
        response.raise_for_status()
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:  # filter out keep-alive chunks
                temp_file.write(chunk)
        temp_file.close()
        return temp_file.name
    except requests.exceptions.RequestException as e:
        print(f"Error: Failed to download file from URL. {e}")
        return None


def download_multiple_files_from_urls(file_urls):
    """
    Downloads multiple audio files from Supabase storage URLs and saves them to temporary local files.

    Args:
        file_urls (list): List of Supabase storage URLs to download

    Returns:
        list: List of local temporary file paths, or empty list if failed
    """
    if not file_urls or not isinstance(file_urls, list):
        logger.error("file_urls must be a non-empty list")
        return []

    temp_files = []
    failed_downloads = []

    try:
        for i, url in enumerate(file_urls):
            try:
                temp_file = tempfile.NamedTemporaryFile(
                    delete=False, suffix=".m4a", mode="wb"
                )
                response = requests.get(url, stream=True)
                response.raise_for_status()

                bytes_written = 0
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:  # filter out keep-alive chunks
                        temp_file.write(chunk)
                        bytes_written += len(chunk)
                temp_file.close()

                logger.info(
                    f"Successfully downloaded file {i+1}/{len(file_urls)}, {bytes_written} bytes"
                )

                # Convert to WAV format
                wav_path = convert_audio_to_wav(temp_file.name)
                if wav_path:
                    # Clean up original file and use converted WAV
                    os.remove(temp_file.name)
                    temp_files.append(wav_path)
                    logger.info(f"File {i+1} converted to WAV successfully")
                else:
                    logger.error(f"Failed to convert file {i+1} to WAV")
                    # Clean up the failed file
                    if os.path.exists(temp_file.name):
                        os.remove(temp_file.name)
                    failed_downloads.append(url)

            except requests.exceptions.RequestException as e:
                logger.error(f"Error downloading file {i+1} from URL {url}: {e}")
                failed_downloads.append(url)
                # Clean up the failed temp file if it was created
                if "temp_file" in locals() and hasattr(temp_file, "name"):
                    try:
                        os.remove(temp_file.name)
                    except:
                        pass

        if failed_downloads:
            logger.warning(
                f"Failed to download {len(failed_downloads)} files: {failed_downloads}"
            )

        if not temp_files:
            logger.error("No files were successfully downloaded")
            return []

        logger.info(
            f"Successfully downloaded {len(temp_files)} out of {len(file_urls)} files"
        )
        return temp_files

    except Exception as e:
        logger.error(f"Error in download_multiple_files_from_urls: {e}")
        # Clean up any successfully downloaded files in case of error
        for temp_file_path in temp_files:
            try:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
            except:
                pass
        return []


def download_files_from_vox_key_folder(vox_key_id, expected_count=10):
    """
    Downloads all audio files from a specific vox_key folder in Supabase storage.

    Args:
        vox_key_id (str): The vox_key identifier (e.g., "vox_key_7")
        expected_count (int): Expected number of files (default 10 for calibration)

    Returns:
        list: List of local temporary file paths, or empty list if failed
    """
    try:
        # List files in the vox_key folder
        files = supabase.storage.from_("vocera-audiostore").list(vox_key_id)

        if not files:
            logger.error(f"No files found in folder {vox_key_id}")
            return []

        # Filter for .wav files and sort them
        wav_files = [f for f in files if f["name"].endswith(".wav")]
        wav_files.sort(key=lambda x: x["name"])  # Sort by filename

        if len(wav_files) != expected_count:
            logger.warning(
                f"Expected {expected_count} files, found {len(wav_files)} in {vox_key_id}"
            )

        # Generate signed URLs for each file
        file_urls = []
        for file_info in wav_files:
            file_path = f"{vox_key_id}/{file_info['name']}"
            signed_url = get_file_url_from_supabase_storage(
                "vocera-audiostore", file_path
            )
            if signed_url:
                file_urls.append(signed_url)
            else:
                logger.error(f"Failed to get signed URL for {file_path}")

        if not file_urls:
            logger.error(f"No valid URLs generated for files in {vox_key_id}")
            return []

        # Download all files
        return download_multiple_files_from_urls(file_urls)

    except Exception as e:
        logger.error(f"Error downloading files from vox_key folder {vox_key_id}: {e}")
        return []


def download_file_from_supabase_storage(bucket_name, file_path):
    """
    Downloads a file from Supabase storage using the Supabase client.

    Args:
        bucket_name (str): Name of the Supabase storage bucket
        file_path (str): Path to the file in the bucket (e.g., "audio/user123/sample.wav")

    Returns:
        str: Local temporary file path, or None if failed
    """
    try:
        # Download file from Supabase storage
        file_data = supabase.storage.from_(bucket_name).download(file_path)

        # Save to temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_file.write(file_data)
        temp_file.close()

        logger.info(f"Successfully downloaded {file_path} from bucket {bucket_name}")
        return temp_file.name

    except Exception as e:
        logger.error(f"Error downloading file from Supabase storage: {e}")
        return None


def get_file_url_from_supabase_storage(bucket_name, file_path, expires_in=3600):
    """
    Gets a signed URL for a file in Supabase storage.

    Args:
        bucket_name (str): Name of the Supabase storage bucket
        file_path (str): Path to the file in the bucket
        expires_in (int): URL expiration time in seconds (default 1 hour)

    Returns:
        str: Signed URL or None if failed
    """
    try:
        signed_url = supabase.storage.from_(bucket_name).create_signed_url(
            file_path, expires_in
        )
        return signed_url.get("signedURL")

    except Exception as e:
        logger.error(f"Error creating signed URL: {e}")
        return None


def upload_file_to_supabase_storage(bucket_name, file_path, local_file_path):
    """
    Uploads a file to Supabase storage.

    Args:
        bucket_name (str): Name of the Supabase storage bucket
        file_path (str): Destination path in the bucket
        local_file_path (str): Local file to upload

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        with open(local_file_path, "rb") as file:
            file_data = file.read()

        result = supabase.storage.from_(bucket_name).upload(
            file_path, file_data, file_options={"content-type": "audio/wav"}
        )

        logger.info(
            f"Successfully uploaded {local_file_path} to {bucket_name}/{file_path}"
        )
        return True

    except Exception as e:
        logger.error(f"Error uploading file to Supabase storage: {e}")
        return False


@app.route("/calibrate", methods=["POST"])
def calibrate():
    """
    Calibrates a user's voice profile with StandardScaler normalization.
    Expects JSON with:
    - vox_key_id: integer
    - user_id: string
    - audio_files: array of objects with fileName, url, size
    - Optional: phrase_data, storage_folder
    """
    try:
        # Parse JSON data
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        # Validate required fields
        if "vox_key_id" not in data:
            return jsonify({"error": "vox_key_id is required"}), 400

        if "audio_files" not in data:
            return jsonify({"error": "audio_files array is required"}), 400

        vox_key_id = data["vox_key_id"]
        user_id = data.get("user_id")
        audio_files = data["audio_files"]

        # Validate audio_files structure
        if not isinstance(audio_files, list) or len(audio_files) != 10:
            return (
                jsonify(
                    {"error": "audio_files must be an array of exactly 10 objects"}
                ),
                400,
            )

        # Extract URLs from audio_files
        file_urls = []
        for audio_file in audio_files:
            if not isinstance(audio_file, dict) or "url" not in audio_file:
                return (
                    jsonify(
                        {"error": "Each audio_file must be an object with 'url' field"}
                    ),
                    400,
                )
            file_urls.append(audio_file["url"])

        logger.info(
            f"Starting calibration for vox_key_id: {vox_key_id} with {len(file_urls)} files"
        )

        # Download files from URLs
        temp_files = download_multiple_files_from_urls(file_urls)
        if not temp_files:
            return (
                jsonify({"error": "Failed to download files from provided URLs"}),
                400,
            )

        if len(temp_files) != 10:
            return (
                jsonify(
                    {
                        "error": f"Expected 10 files for calibration, got {len(temp_files)}"
                    }
                ),
                400,
            )

        # Extract raw features first (without normalization)
        logger.info("Extracting features from audio files...")
        raw_feature_vectors = []
        for i, temp_file_path in enumerate(temp_files):
            try:
                # Debug: Check file size and first few bytes
                file_size = os.path.getsize(temp_file_path)
                logger.info(
                    f"Processing file {i+1}: {temp_file_path}, size: {file_size} bytes"
                )

                # Read first 16 bytes to check file header (for debugging)
                with open(temp_file_path, "rb") as f:
                    header = f.read(16)
                    logger.info(f"File {i+1} header (hex): {header.hex()}")
                    logger.info(f"File {i+1} header (text): {header}")

                features = extract_opensmile_features(temp_file_path)
                raw_feature_vectors.append(features)
                logger.info(f"Successfully extracted features from file {i+1}")
            except Exception as e:
                logger.error(f"Error processing file {i+1} ({temp_file_path}): {e}")
                raise

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

        # Send the vectors to the database
        logger.info("Saving vectors to database...")
        success = db.send_vox_vectors(vox_key_id, normalized_vectors)
        if not success:
            return jsonify({"error": "Failed to save vectors to database"}), 500

        # Update training_audio_url as requested
        # Use the first audio file URL as the training_audio_url
        training_audio_url = audio_files[0]["url"]

        logger.info("Updating training_audio_url...")
        url_update_success = db.update_vox_key_training_url_by_user(
            user_id=user_id, training_audio_url=training_audio_url
        )

        if not url_update_success:
            logger.warning(
                "Failed to update training_audio_url, but vectors were saved successfully"
            )

        logger.info(f"✅ Calibration successful for vox_key_id: {vox_key_id}")
        logger.info(f"   Normalized avg distance: {avg_euclidean_distance:.4f}")
        logger.info(
            f"   Raw avg distance would have been: {np.mean([euclidean(pair[0], pair[1]) for pair in combinations(raw_feature_vectors, 2)]):.4f}"
        )
        logger.info(f"   Training audio URL set to: {training_audio_url}")

        return jsonify(
            {
                "status": "calibration successful with StandardScaler normalization",
                "vox_key_id": vox_key_id,
                "user_id": user_id,
                "files_processed": len(temp_files),
                "normalized_avg_distance": avg_euclidean_distance,
                "training_audio_url": training_audio_url,
                "vectors_saved": len(normalized_vectors),
                "training_url_updated": url_update_success,
            }
        )

    except Exception as e:
        logger.error(f"Error in calibrate endpoint: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        # Clean up temp files
        if "temp_files" in locals():
            for temp_file_path in temp_files:
                try:
                    if os.path.exists(temp_file_path):
                        os.remove(temp_file_path)
                except Exception as cleanup_error:
                    logger.warning(
                        f"Failed to cleanup temp file {temp_file_path}: {cleanup_error}"
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

        # --- Speaker Verification (Primary) --- COMMENTED OUT FOR MINIMAL DEPLOYMENT
        speaker_verification_result = ("model_not_deployed", (False, 0.0))
        # training_url = profile.get("training_audio_url")

        # if training_url:
        #     reference_audio_path = download_audio_from_url(training_url)
        #     if reference_audio_path:
        #         # Placeholder for your actual function call
        #         speaker_verification_result = verify_speaker_from_data(
        #             reference_audio_path, temp_file_path
        #         )
        #         print(
        #             f"Calling speaker verification with: {reference_audio_path} and {temp_file_path}"
        #         )
        #     else:
        #         print(
        #             "Warning: Failed to download reference audio. Skipping speaker verification."
        #         )
        #         speaker_verification_result = ("download_failed", (False, 0.0))

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
# Force rebuild for ffmpeg
