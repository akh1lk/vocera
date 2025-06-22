#!/usr/bin/env python3
"""
Script to insert gold.json OpenSMILE vectors into the vox_vectors table in Supabase.
Uses "laerdon_best" as the vox_key_id.
"""

import json
import numpy as np
import os
import random
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_SERVICE_KEY")


def load_gold_vectors():
    """Load OpenSMILE vectors from gold.json file."""
    try:
        with open("user_profiles/gold.json", "r") as f:
            gold_data = json.load(f)

        # Extract OpenSMILE vectors and convert to numpy arrays
        vectors = [np.array(vector) for vector in gold_data["opensmile_vectors"]]
        print(f"Loaded {len(vectors)} vectors from gold.json")
        return vectors

    except FileNotFoundError:
        print("Error: gold.json file not found in user_profiles directory")
        return None
    except json.JSONDecodeError:
        print("Error: Invalid JSON format in gold.json")
        return None
    except KeyError:
        print("Error: 'opensmile_vectors' key not found in gold.json")
        return None


def setup_supabase_client():
    """Set up Supabase client using environment variables."""
    try:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            print(
                "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set"
            )
            return None

        client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        return client

    except Exception as e:
        print(f"Error creating Supabase client: {e}")
        return None


def main():
    """Main function to insert gold vectors into Supabase."""
    print("Starting script to insert gold.json vectors into Supabase...")

    # Load vectors from gold.json
    vectors = load_gold_vectors()
    if vectors is None:
        return False

    # Set up Supabase client
    supabase_client = setup_supabase_client()
    if supabase_client is None:
        return False

    # Generate a random bigint for vox_key_id (PostgreSQL bigint range: 0 to 2^63-1)
    vox_key_id = 36
    print(f"Inserting {len(vectors)} vectors with vox_key_id: {vox_key_id}")

    try:
        # Combine all vectors into a single 2D array
        combined_vectors = np.array(vectors)  # Shape will be (10, 88) for your data
        print(f"Combined vectors shape: {combined_vectors.shape}")

        # Insert as a single entry with 2D array
        vector_entry = {
            "vox_key_id": vox_key_id,
            "embedding": combined_vectors.tolist(),  # Convert to nested list for JSON storage
        }

        response = supabase_client.table("vox_vectors").insert(vector_entry).execute()

        if response.data:
            print("✅ Successfully inserted 2D vector array into vox_vectors table!")
            print(f"Inserted record with ID: {response.data[0].get('id', 'unknown')}")
            return True
        else:
            print("❌ Failed to insert vectors - no data returned")
            return False

    except Exception as e:
        print(f"❌ Error during insertion: {e}")
        return False


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
