import os
from flask import Flask, request, jsonify
import numpy as np
from scipy.spatial.distance import euclidean, cosine
from itertools import combinations
import tempfile

from feature_extractor import extract_opensmile_features, extract_wav2vec_features
from database import MemoryDatabase

app = Flask(__name__)

# In-memory database
db = MemoryDatabase()

# Tunable parameter for openSMILE scoring
OPEN_SMILE_THRESHOLD_MULTIPLIER = 2.0


@app.route('/calibrate', methods=['POST'])
def calibrate():
    """
    Calibrates a user's voice profile.
    Expects 10 .wav files and a user_id.
    """
    if 'user_id' not in request.form:
        return jsonify({"error": "user_id is required"}), 400

    user_id = request.form.get('user_id')
    files = request.files.getlist('files')

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
        wav2vec_vectors = [extract_wav2vec_features(f) for f in temp_files]

        # Calculate average Euclidean distance for openSMILE
        os_distances = [euclidean(pair[0], pair[1]) for pair in combinations(opensmile_vectors, 2)]
        avg_euclidean_distance = np.mean(os_distances)

        # Calculate average cosine similarity for Wav2Vec
        cos_sims = [1 - cosine(pair[0], pair[1]) for pair in combinations(wav2vec_vectors, 2)]
        avg_cosine_similarity = np.mean(cos_sims)

        # Store in the in-memory database
        db.upsert_profile({
            'user_id': user_id,
            'opensmile_vectors': opensmile_vectors,
            'wav2vec_vectors': wav2vec_vectors,
            'avg_euclidean_distance': avg_euclidean_distance,
            'avg_cosine_similarity': avg_cosine_similarity
        })

    except Exception as e:
        # Clean up temp files in case of error
        for temp_file_path in temp_files:
            os.remove(temp_file_path)
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up temp files
        for temp_file_path in temp_files:
            os.remove(temp_file_path)

    return jsonify({"status": "calibration received", "user_id": user_id, "files_received": len(files)})


@app.route('/verify', methods=['POST'])
def verify():
    """
    Verifies a user's voice against their profile.
    Expects 1 .wav file and a user_id.
    """
    if 'user_id' not in request.form:
        return jsonify({"error": "user_id is required"}), 400

    user_id = request.form.get('user_id')
    files = request.files.getlist('files')

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
        
        baseline_os_vectors = profile['opensmile_vectors']
        baseline_wv_vectors = profile['wav2vec_vectors']
        baseline_avg_euclidean_dist = profile['avg_euclidean_distance']
        baseline_avg_cosine_sim = profile['avg_cosine_similarity']

        # Extract features from verification file
        verify_os_vector = extract_opensmile_features(temp_file_path)
        verify_wv_vector = extract_wav2vec_features(temp_file_path)

        # --- Wav2Vec Verification ---
        wv_similarities = [1 - cosine(verify_wv_vector, v) for v in baseline_wv_vectors]
        avg_wv_similarity = np.mean(wv_similarities)
        
        # Scoring logic for Wav2Vec
        # Score is 100 if similarity is high (close to baseline), 0 if it's low (far from baseline)
        # We define the "far" threshold as 1.5x the average *distance* (1-sim)
        max_dist_threshold = 1.5 * (1 - baseline_avg_cosine_sim)
        # The verification distance is (1 - avg_wv_similarity)
        # We need to be careful with the range.
        # A similarity of 1 gives a distance of 0. A similarity of `baseline_avg_cosine_sim` is the target.
        # Let's define the score as a linear mapping.
        # If avg_wv_similarity is >= baseline_avg_cosine_sim, score is 100.
        # If avg_wv_similarity is at a point that gives `max_dist_threshold`, score is 0.
        # That point is `1 - max_dist_threshold`.
        lower_bound_sim = 1 - max_dist_threshold
        wav2vec_score = 100 * (avg_wv_similarity - lower_bound_sim) / (baseline_avg_cosine_sim - lower_bound_sim)
        wav2vec_score = max(0, min(100, wav2vec_score))


        # --- openSMILE Verification ---
        os_distances = [euclidean(verify_os_vector, v) for v in baseline_os_vectors]
        avg_os_distance = np.mean(os_distances)

        # Scoring logic for openSMILE
        # A lower distance is better.
        opensmile_threshold = OPEN_SMILE_THRESHOLD_MULTIPLIER * baseline_avg_euclidean_dist
        opensmile_score = max(0, 100 * (1 - (avg_os_distance / opensmile_threshold)))
        opensmile_score = max(0, min(100, opensmile_score))

        # --- Final Prediction ---
        final_confidence = (wav2vec_score + opensmile_score) / 2
        prediction = "authentic" if final_confidence >= 50 else "deepfake"

        return jsonify({
            "prediction": prediction,
            "confidence": final_confidence,
            "details": {
                "wav2vec_score": wav2vec_score,
                "opensmile_score": opensmile_score,
                "avg_verification_cosine_similarity": avg_wv_similarity,
                "avg_verification_euclidean_distance": avg_os_distance
            }
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.route('/get_profile/<user_id>', methods=['GET'])
def get_profile(user_id):
    """Retrieves a user's profile from the in-memory database for debugging."""
    profile = db.get_profile(user_id)
    if not profile:
        return jsonify({"error": "User profile not found"}), 404

    # Create a serializable copy of the profile data
    profile_copy = {
        'user_id': profile['user_id'],
        'opensmile_vectors': [v.tolist() for v in profile['opensmile_vectors']],
        'wav2vec_vectors': [v.tolist() for v in profile['wav2vec_vectors']],
        'avg_euclidean_distance': profile['avg_euclidean_distance'],
        'avg_cosine_similarity': profile['avg_cosine_similarity']
    }

    return jsonify(profile_copy)


if __name__ == '__main__':
    app.run(debug=True, port=5001) 