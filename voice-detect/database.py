class MemoryDatabase:
    """A simple in-memory database for storing user profiles."""
    def __init__(self):
        self.profiles = {}

    def get_profile(self, user_id):
        """Retrieves a user profile by user_id."""
        return self.profiles.get(user_id)

    def upsert_profile(self, profile_data):
        """Creates or updates a user profile."""
        user_id = profile_data.get('user_id')
        if not user_id:
            raise ValueError("user_id is required to upsert a profile.")
        self.profiles[user_id] = profile_data
        return profile_data 