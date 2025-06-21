import json
import os
import numpy as np


class FileDatabase:
    """A file-based database that stores user profiles as JSON files."""

    def __init__(self, data_folder="user_profiles"):
        self.data_folder = data_folder
        # Create the data folder if it doesn't exist
        os.makedirs(self.data_folder, exist_ok=True)

    def _get_profile_path(self, user_id):
        """Returns the file path for a user's profile."""
        return os.path.join(self.data_folder, f"{user_id}.json")

    def get_profile(self, user_id):
        """Retrieves a user profile by user_id from the JSON file."""
        profile_path = self._get_profile_path(user_id)

        if not os.path.exists(profile_path):
            return None

        try:
            with open(profile_path, "r") as f:
                profile_data = json.load(f)

            # Convert opensmile_vectors back to numpy arrays
            if "opensmile_vectors" in profile_data:
                profile_data["opensmile_vectors"] = [
                    np.array(vector) for vector in profile_data["opensmile_vectors"]
                ]

            return profile_data
        except (json.JSONDecodeError, IOError) as e:
            print(f"Error reading profile for user {user_id}: {e}")
            return None

    def upsert_profile(self, profile_data):
        """Creates or updates a user profile by saving to a JSON file."""
        user_id = profile_data.get("user_id")
        if not user_id:
            raise ValueError("user_id is required to upsert a profile.")

        profile_path = self._get_profile_path(user_id)

        # Create a serializable copy of the profile data
        serializable_data = profile_data.copy()

        # Convert numpy arrays to lists for JSON serialization
        if "opensmile_vectors" in serializable_data:
            serializable_data["opensmile_vectors"] = [
                vector.tolist() for vector in serializable_data["opensmile_vectors"]
            ]

        try:
            with open(profile_path, "w") as f:
                json.dump(serializable_data, f, indent=2)
            return profile_data
        except IOError as e:
            raise IOError(f"Error saving profile for user {user_id}: {e}")

    def delete_profile(self, user_id):
        """Deletes a user profile by removing the JSON file."""
        profile_path = self._get_profile_path(user_id)

        if os.path.exists(profile_path):
            try:
                os.remove(profile_path)
                return True
            except IOError as e:
                print(f"Error deleting profile for user {user_id}: {e}")
                return False
        return False

    def list_users(self):
        """Returns a list of all user IDs that have profiles."""
        users = []
        try:
            for filename in os.listdir(self.data_folder):
                if filename.endswith(".json"):
                    users.append(filename[:-5])  # Remove .json extension
        except OSError:
            pass
        return users
