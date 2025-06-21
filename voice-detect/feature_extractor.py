import opensmile
import torch
import librosa
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

# Initialize openSMILE
smile = opensmile.Smile(
    feature_set=opensmile.FeatureSet.eGeMAPSv02,
    feature_level=opensmile.FeatureLevel.Functionals,
)

# Initialize Wav2Vec2 model and processor
processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h", output_hidden_states=True)

def extract_opensmile_features(audio_file_path):
    """Extracts openSMILE features from an audio file."""
    features = smile.process_file(audio_file_path)
    return features.to_numpy().flatten()

def extract_wav2vec_features(audio_file_path):
    """Extracts Wav2Vec features from an audio file."""
    speech, sample_rate = librosa.load(audio_file_path, sr=16000)
    input_values = processor(speech, return_tensors="pt", sampling_rate=sample_rate).input_values
    with torch.no_grad():
        outputs = model(input_values)
        hidden_states = outputs.hidden_states[-1]  # Get the last hidden state
    # Mean pool the hidden states to get a single vector
    return torch.mean(hidden_states, dim=1).squeeze().numpy() 