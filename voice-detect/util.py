import requests
import tempfile
import os


def download_audio_from_url(audio_url):
    """
    Downloads an audio file from a URL and saves it to a temporary local file.

    Args:
        audio_url (str): The URL of the .wav file in your Supabase bucket.

    Returns:
        str: The file path to the downloaded temporary audio file, or None on failure.
    """
    try:
        print(f"Attempting to download audio from: {audio_url}")
        # Create a temporary file to store the audio
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")

        # Make the request to the URL
        response = requests.get(audio_url, stream=True)
        response.raise_for_status()  # This will raise an error for bad status codes (4xx or 5xx)

        # Write the content to the temporary file
        for chunk in response.iter_content(chunk_size=8192):
            temp_file.write(chunk)

        temp_file.close()
        print(f"Successfully downloaded audio to temporary file: {temp_file.name}")

        return temp_file.name

    except requests.exceptions.RequestException as e:
        print(f"Error: Failed to download file from URL. {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None
