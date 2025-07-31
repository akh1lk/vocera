import opensmile
import numpy as np
from sklearn.preprocessing import StandardScaler
import pickle
import base64

# Initialize openSMILE
smile = opensmile.Smile(
    feature_set=opensmile.FeatureSet.eGeMAPSv02,
    feature_level=opensmile.FeatureLevel.Functionals,
)


def extract_opensmile_features(audio_file_path, scaler=None, fit_scaler=False):
    """
    Extracts and optionally normalizes openSMILE features from an audio file.

    Args:
        audio_file_path: Path to audio file
        scaler: StandardScaler object for normalization
        fit_scaler: If True, fits the scaler on this data

    Returns:
        features_array: Normalized feature vector
    """
    features = smile.process_file(audio_file_path)
    features_array = features.to_numpy().flatten()

    if scaler is not None:
        if fit_scaler:
            # Fit the scaler on calibration data (reshape for sklearn)
            features_array = scaler.fit_transform(
                features_array.reshape(1, -1)
            ).flatten()
        else:
            # Transform using existing scaler
            features_array = scaler.transform(features_array.reshape(1, -1)).flatten()

    return features_array


def create_scaler_from_features(feature_vectors):
    """
    Create and fit a StandardScaler from multiple feature vectors.

    Args:
        feature_vectors: List of feature vectors from calibration files

    Returns:
        fitted_scaler: StandardScaler fitted on the feature vectors
    """
    if len(feature_vectors) < 2:
        raise ValueError("Need at least 2 feature vectors to create scaler")

    # Stack vectors into 2D array
    feature_matrix = np.array(feature_vectors)

    # Check for zero variance features
    variances = np.var(feature_matrix, axis=0)
    zero_var_features = np.where(variances < 1e-8)[0]

    if len(zero_var_features) > 0:
        print(f"Warning: {len(zero_var_features)} features have near-zero variance")

    # Create and fit scaler
    scaler = StandardScaler()
    scaler.fit(feature_matrix)

    return scaler


def serialize_scaler(scaler):
    """Serialize scaler to base64 string for JSON storage."""
    scaler_bytes = pickle.dumps(scaler)
    return base64.b64encode(scaler_bytes).decode("utf-8")


def deserialize_scaler(scaler_string):
    """Deserialize scaler from base64 string."""
    scaler_bytes = base64.b64decode(scaler_string.encode("utf-8"))
    return pickle.loads(scaler_bytes)
