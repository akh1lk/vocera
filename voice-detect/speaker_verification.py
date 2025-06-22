import sys
import os
import torchaudio
from speechbrain.inference.speaker import SpeakerRecognition
import tempfile
import io

def verify_speaker_from_data(baseline_data: bytes, verification_data: bytes):
    """
    Verifies if two audio streams (in bytes) belong to the same speaker.
    This function saves the audio bytes to temporary files and uses
    SpeechBrain's file-based verification to avoid tensor-related result discrepancies.

    Args:
        baseline_data: The bytes of the baseline audio file.
        verification_data: The bytes of the audio file to be verified.

    Returns:
        A tuple containing the score (float) and the prediction (bool).
    """
    verifier = SpeakerRecognition.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir="pretrained_models/spkrec-ecapa-voxceleb",
    )

    # Create temporary files to hold the audio data
    baseline_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    verification_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)

    try:
        # Load the in-memory audio data to get waveform and sample rate
        baseline_waveform, baseline_sr = torchaudio.load(io.BytesIO(baseline_data))
        verification_waveform, verification_sr = torchaudio.load(io.BytesIO(verification_data))

        # Save the audio to the temporary files
        torchaudio.save(baseline_tmp.name, baseline_waveform, baseline_sr)
        torchaudio.save(verification_tmp.name, verification_waveform, verification_sr)
        
        # Close the files before letting speechbrain open them
        baseline_tmp.close()
        verification_tmp.close()

        # Perform verification using the paths to the temporary files
        score, prediction = verifier.verify_files(baseline_tmp.name, verification_tmp.name)

        # The output is a tensor, so we get the single value
        return prediction.squeeze().bool().item(), score.squeeze().item()

    finally:
        # Ensure the temporary files are deleted
        os.unlink(baseline_tmp.name)
        os.unlink(verification_tmp.name)


def main():
    """
    Main function to handle command-line arguments and perform speaker verification.
    """
    if len(sys.argv) != 3:
        print("\nUsage: python speaker_verification.py <path_to_baseline_wav> <path_to_verification_wav>\n")
        print("Example:")
        print("  python speaker_verification.py ../srikarsampledata/calib/srikar_0.wav ../srikarsampledata/real/srikar_real.wav")
        sys.exit(1)

    baseline_path = sys.argv[1]
    verification_path = sys.argv[2]
    
    # --- Input Validation ---
    if not os.path.exists(baseline_path):
        print(f"Error: Baseline file not found at '{baseline_path}'")
        sys.exit(1)

    if not os.path.exists(verification_path):
        print(f"Error: Verification file not found at '{verification_path}'")
        sys.exit(1)
        
    print(f"\nComparing '{os.path.basename(baseline_path)}' with '{os.path.basename(verification_path)}'...")
    print("Loading Speaker Recognition model (this may take a moment on first run)...")
    
    try:
        # Read file contents as bytes
        with open(baseline_path, "rb") as f:
            baseline_bytes = f.read()
        with open(verification_path, "rb") as f:
            verification_bytes = f.read()

        # Perform verification on the byte data
        score_val, pred_val = verify_speaker_from_data(baseline_bytes, verification_bytes)

        print("\n--- Verification Results ---")
        print(f"cosine score: {score_val:.4f}")
        print("same speaker?", pred_val)

        if pred_val:
            print("\n✅ Verdict: SAME SPEAKER")
        else:
            print("\n❌ Verdict: DIFFERENT SPEAKER")

    except Exception as e:
        print(f"An error occurred during verification: {e}")
        return

if __name__ == "__main__":
    main() 