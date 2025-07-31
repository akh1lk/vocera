import os
import sys
from openai import OpenAI
import string
from dotenv import load_dotenv
from typing import IO

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
# The ground truth text that we expect the audio to contain.
#TODO Change this to retrieve actual text from the supabase database
EXPECTED_TRANSCRIPTION = "Akhil ate the lonely pizza with oranges"

# --- API Client ---
# Initialize the client once to reuse the connection.
client = OpenAI()


def transcribe_audio(audio_stream: IO[bytes], filename: str) -> str:
    """
    Transcribes the given audio stream using OpenAI's Whisper model.

    Args:
        audio_stream: An open file-like object containing the audio data in binary mode.
        filename: The name of the file, including its extension (e.g., "audio.wav").

    Returns:
        The transcribed text as a string.
    
    Raises:
        Exception: Propagates exceptions from the OpenAI API call.
    """
    print("Transcribing audio stream...")
    try:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, audio_stream)
        )
        return transcript.text
    except Exception as e:
        raise e


def compare_transcriptions(whisper_text: str, expected_text: str) -> bool:
    """
    Compares two strings for semantic equivalence using the OpenAI API.
    """

    try:
        # Define the prompt for the API call
        system_prompt = (
            "You are a strict semantic-equivalence judge.\n"
            "Return exactly ONE token:\n"
            "• 1.0  → sentences mean the same thing "
            "(punctuation, minor spelling variants, filler words).\n"
            "• 0.0  → any meaningful difference.\n\n"
            "No other text."
        )
        
        user_message = (
            f'reference = "{expected_text}"\n'
            f'candidate  = "{whisper_text}"'
        )

        # Call the OpenAI API directly
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=1,
            temperature=0,
        )

        answer = resp.choices[0].message.content.strip()
        score = float(answer)
        
        print(f"OpenAI's semantic score: {score}")
        return score == 1.0

    except Exception as e:
        print(f"An error occurred during OpenAI API call: {e}")
        raise e


def main():
    """
    Main function to run the transcription and comparison process from a file path.
    This serves as a command-line test utility for the transcription functions.
    """
    if len(sys.argv) < 2:
        sys.exit(1)

    audio_file_path = sys.argv[1]
    
    if not os.path.exists(audio_file_path):
        print(f"Error: The file was not found at: {audio_file_path}")
        sys.exit(1)

    try:
        # Open the file and pass its stream and name to the transcription function
        with open(audio_file_path, "rb") as audio_file:
            # 1. Get the transcription from Whisper
            filename = os.path.basename(audio_file_path)
            transcribed_text = transcribe_audio(audio_file, filename)

        # 2. Compare it to the hardcoded text
        is_match = compare_transcriptions(transcribed_text, EXPECTED_TRANSCRIPTION)


    except Exception as e:
        print(f"\nAn error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
