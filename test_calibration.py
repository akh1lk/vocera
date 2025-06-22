#!/usr/bin/env python3
"""
Calibration script for voice detection system.
Automatically calibrates user profiles using their calibration audio files.
"""

import os
import sys
import requests
import json
from pathlib import Path


def calibrate_user(user_id, calib_dir, base_url="http://localhost:5001"):
    """Calibrate a user profile using their calibration files."""
    calib_path = Path(calib_dir)

    if not calib_path.exists():
        print(f"❌ Calibration directory not found: {calib_dir}")
        return False

    # Get all .wav files in calibration directory
    audio_files = list(calib_path.glob("*.wav"))

    if len(audio_files) != 10:
        print(
            f"❌ Expected 10 calibration files, found {len(audio_files)} in {calib_dir}"
        )
        return False

    # Sort files to ensure consistent ordering
    audio_files.sort()

    print(f"🎯 Calibrating user '{user_id}' with {len(audio_files)} files...")

    # Prepare files for upload
    files = []
    file_handles = []

    try:
        for audio_file in audio_files:
            file_handle = open(audio_file, "rb")
            file_handles.append(file_handle)
            files.append(("files", (audio_file.name, file_handle, "audio/wav")))

        # Make calibration request
        data = {"user_id": user_id}
        response = requests.post(f"{base_url}/calibrate", data=data, files=files)

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Calibration successful for {user_id}")
            print(f"   Status: {result.get('status')}")
            print(f"   Files processed: {result.get('files_received')}")
            return True
        else:
            print(f"❌ Calibration failed for {user_id}")
            print(f"   Status code: {response.status_code}")
            print(f"   Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error calibrating {user_id}: {str(e)}")
        return False
    finally:
        # Close all file handles
        for file_handle in file_handles:
            file_handle.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_calibration.py <user_id> [<calibration_directory>]")
        print("       python test_calibration.py all")
        print("\nExamples:")
        print("  python test_calibration.py laerdon")
        print("  python test_calibration.py srikar")
        print("  python test_calibration.py all")
        sys.exit(1)

    user_id = sys.argv[1]

    if user_id == "all":
        # Calibrate all users
        users = [
            ("laerdon", "laerdonsampledata/calib"),
            ("srikar", "srikarsampledata/calib"),
            ("gold", "goldsampledata/calib"),
        ]

        success_count = 0
        for uid, calib_dir in users:
            if calibrate_user(uid, calib_dir):
                success_count += 1
            print()  # Empty line between users

        print(
            f"🏁 Calibration completed: {success_count}/{len(users)} users successful"
        )

    else:
        # Calibrate specific user
        if len(sys.argv) >= 3:
            calib_dir = sys.argv[2]
        else:
            calib_dir = f"{user_id}sampledata/calib"

        success = calibrate_user(user_id, calib_dir)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
