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

    def get_profile(self, user_id):
        """Retrieves the most recent, active user profile from Supabase."""
        try:
            logger.info(f"DEBUG: Looking for user_id: {user_id}")

            key_response = (
                self.client.table("users")
                .select("*")
                .eq("user_id", user_id)
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
                print(f"No active profile found for user {user_id}")
                return None

            vox_key_data = key_response.data
            vox_key_id = vox_key_data["id"]

            print(f"DEBUG: Found vox_key_id: {vox_key_id}")

            # 2. Get all associated vox_samples (the vectors)
            vectors_response = (
                self.client.table("vox_samples")
                .select("embedding")
                .eq("vox_key_id", vox_key_id)
                .execute()
            )

            print(f"DEBUG: Vectors response: {vectors_response.data}")

            # This would be an inconsistent state, but handle it.
            if not vectors_response.data:
                print(f"No vectors found for vox_key_id: {vox_key_id}")
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

            print(f"DEBUG: Successfully constructed profile for user {user_id}")
            return profile

        except Exception as e:
            print(f"ERROR: Exception in get_profile for user {user_id}: {e}")
            print(f"ERROR: Exception type: {type(e)}")
            import traceback

            print(f"ERROR: Full traceback: {traceback.format_exc()}")
            return None

    def upsert_profile(self, profile_data):
        """Creates a new user profile in Supabase by adding a new vox_key and its samples."""
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

            # 2. Prepare and insert all the vectors into vox_samples
            vectors_to_insert = [
                {
                    "vox_key_id": new_vox_key_id,
                    "embedding": vector.tolist(),  # Convert numpy array to list
                }
                for vector in profile_data.get("opensmile_vectors", [])
            ]

            if vectors_to_insert:
                self.client.table("vox_samples").insert(vectors_to_insert).execute()

            return profile_data

        except Exception as e:
            raise IOError(f"Error saving profile for user {user_id} to Supabase: {e}")

    def delete_profile(self, user_id):
        """Deletes all vox_keys and associated vox_samples for a user."""
        try:
            # The ON DELETE CASCADE on the foreign key should handle deleting vox_samples
            self.client.table("vox_keys").delete().eq("user_id", user_id).execute()
            return True
        except Exception as e:
            print(f"Error deleting profile for user {user_id} from Supabase: {e}")
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
            print(f"Error listing users from Supabase: {e}")
            return []
