import numpy as np
from supabase import Client
import logging

logger = logging.getLogger(__name__)
# Set up file logging
file_handler = logging.FileHandler("database.log")
file_handler.setLevel(logging.INFO)
file_formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
file_handler.setFormatter(file_formatter)
logger.addHandler(file_handler)


class SupabaseDatabase:
    """A database that uses Supabase to store and retrieve user profiles."""

    def __init__(self, supabase_client: Client):
        if not supabase_client:
            raise ValueError("Supabase client is required.")
        self.client = supabase_client

    def get_profile(self, id):
        """Retrieves the most recent, active user profile from Supabase."""
        try:
            logger.info(f"DEBUG: Looking for id: {id}")

            # 1. Get the most recent active vox_key for the user
            key_response = (
                self.client.table("vox_keys")
                .select("*")
                .eq("user_id", id)
                .eq("is_active", True)
                .order("created_at", desc=True)
                .limit(1)
                .single()
                .execute()
            )

            logger.info(f"DEBUG: Supabase response: {key_response}")
            logger.info(f"DEBUG: Response data: {key_response.data}")

            # The new supabase-py v2 library doesn't have an 'error' attribute.
            # It raises an exception on network/server errors and returns empty data if not found.
            # We check for data to see if a profile was found.
            if not key_response.data:
                logger.error(f"No active profile found for user {id}")
                return None

            vox_key_data = key_response.data
            vox_key_id = vox_key_data["id"]

            logger.info(f"DEBUG: Found vox_key_id: {vox_key_id}")

            # 2. Get all associated vox_samples (the vectors)
            vectors_response = (
                self.client.table("vox_vectors")
                .select("embedding")
                .eq("vox_key_id", vox_key_id)
                .execute()
            )

            logger.info(f"DEBUG: Vectors response: {vectors_response.data}")

            # This would be an inconsistent state, but handle it.
            if not vectors_response.data:
                logger.error(f"No vectors found for vox_key_id: {vox_key_id}")
                return None

            # 3. Construct the profile object in the format app.py expects
            profile = {
                "user_id": vox_key_data["user_id"],
                "training_audio_url": vox_key_data.get("training_audio_url"),
                "opensmile_vectors": [
                    np.array(vector["embedding"]) for vector in vectors_response.data
                ],
                # TODO: Store and retrieve these from vox_keys table
                "avg_euclidean_distance": vox_key_data.get("avg_distance"),
                "scaler": vox_key_data.get("scaler_data"),
                "feature_normalization": "StandardScaler",
            }

            logger.info(f"DEBUG: Successfully constructed profile for user {id}")
            return profile

        except Exception as e:
            logger.error(f"ERROR: Exception in get_profile for user {id}: {e}")
            logger.error(f"ERROR: Exception type: {type(e)}")
            import traceback

            logger.error(f"ERROR: Full traceback: {traceback.format_exc()}")
            return None

    def send_vox_vectors(self, vox_key_id, vectors):
        """
        Sends voice vectors to the vox_vectors table in Supabase.

        Args:
            vox_key_id (str): The UUID of the vox_key these vectors belong to
            vectors (list): List of numpy arrays representing the voice feature vectors

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            logger.info(
                f"DEBUG: Sending {len(vectors)} vectors for vox_key_id: {vox_key_id}"
            )

            # Prepare the vectors for insertion
            vectors_to_insert = [
                {
                    "vox_key_id": vox_key_id,
                    "embedding": vector.tolist(),  # Convert numpy array to list
                }
                for vector in vectors
            ]

            # Insert all vectors at once
            response = (
                self.client.table("vox_vectors").insert(vectors_to_insert).execute()
            )

            if response.data:
                logger.info(
                    f"DEBUG: Successfully inserted {len(response.data)} vectors"
                )
                return True
            else:
                logger.error(f"ERROR: Failed to insert vectors - no data returned")
                return False

        except Exception as e:
            logger.error(
                f"ERROR: Exception in send_vox_vectors for vox_key_id {vox_key_id}: {e}"
            )
            logger.error(f"ERROR: Exception type: {type(e)}")
            import traceback

            logger.error(f"ERROR: Full traceback: {traceback.format_exc()}")
            return False

    def upsert_profile(self, profile_data):
        """Creates a new user profile in Supabase by adding a new vox_key and its vectors."""
        user_id = profile_data.get("user_id")
        if not user_id:
            raise ValueError("user_id is required to upsert a profile.")

        try:
            # 1. Insert a new record into vox_keys
            # TODO: Add 'avg_distance' and 'scaler_data' to this dict when the
            # schema is updated with the new columns.
            new_vox_key_data = {
                "user_id": user_id,
                "training_audio_url": profile_data.get("training_audio_url"),
                "is_active": True,
            }

            key_insert_response = (
                self.client.table("vox_keys").insert(new_vox_key_data).execute()
            )

            if not key_insert_response.data:
                raise Exception("Failed to insert new vox_key into Supabase.")

            new_vox_key_id = key_insert_response.data[0]["id"]

            # 2. Use the new send_vox_vectors function to insert the vectors
            vectors = profile_data.get("opensmile_vectors", [])
            if vectors:
                success = self.send_vox_vectors(new_vox_key_id, vectors)
                if not success:
                    raise Exception("Failed to insert vectors into vox_vectors.")

            return profile_data

        except Exception as e:
            raise IOError(f"Error saving profile for user {user_id} to Supabase: {e}")

    def delete_profile(self, user_id):
        """Deletes all vox_keys and associated vox_vectors for a user."""
        try:
            # The ON DELETE CASCADE on the foreign key should handle deleting vox_vectors
            self.client.table("vox_keys").delete().eq("user_id", user_id).execute()
            return True
        except Exception as e:
            logger.error(
                f"Error deleting profile for user {user_id} from Supabase: {e}"
            )
            return False

    def list_users(self):
        """Returns a list of all unique user IDs that have profiles."""
        try:
            response = self.client.table("vox_keys").select("user_id").execute()
            if response.data:
                user_ids = {item["user_id"] for item in response.data}
                return list(user_ids)
            return []
        except Exception as e:
            logger.error(f"Error listing users from Supabase: {e}")
            return []

    def update_vox_key_training_url_by_user(self, user_id, training_audio_url):
        """
        Updates the training_audio_url field for the most recent active vox_key of a user.

        Args:
            user_id (str): The user ID whose vox_key to update
            training_audio_url (str): The URL of the training audio file

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            logger.info(f"DEBUG: Updating training_audio_url for user_id: {user_id}")

            # Update the most recent active vox_key for this user
            response = (
                self.client.table("vox_keys")
                .update({"training_audio_url": training_audio_url})
                .eq("user_id", user_id)
                .eq("is_active", True)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )

            if response.data:
                logger.info(
                    f"DEBUG: Successfully updated training_audio_url for user_id: {user_id}"
                )
                return True
            else:
                logger.error(
                    f"ERROR: Failed to update training_audio_url for user_id: {user_id} - no active vox_key found"
                )
                return False

        except Exception as e:
            logger.error(
                f"ERROR: Exception updating training_audio_url for user_id {user_id}: {e}"
            )
            return False
