import opensmile

# Initialize openSMILE
smile = opensmile.Smile(
    feature_set=opensmile.FeatureSet.eGeMAPSv02,
    feature_level=opensmile.FeatureLevel.Functionals,
)

def extract_opensmile_features(audio_file_path):
    """Extracts openSMILE features from an audio file."""
    features = smile.process_file(audio_file_path)
    return features.to_numpy().flatten() 