#!/usr/bin/env python3
"""
Full end-to-end test runner for voice detection system.
Combines calibration and verification testing with proper timing.
"""

import os
import sys
import subprocess
import time
import requests
from pathlib import Path


def check_server_status(base_url="http://localhost:5001", max_retries=5):
    """Check if the Flask server is running."""
    for i in range(max_retries):
        try:
            response = requests.get(f"{base_url}/get_profile/test", timeout=5)
            print("✅ Server is running and responsive")
            return True
        except requests.exceptions.RequestException:
            if i < max_retries - 1:
                print(
                    f"⏳ Server not ready, retrying in 2 seconds... ({i+1}/{max_retries})"
                )
                time.sleep(2)
            else:
                print("❌ Server is not responding")
                return False
    return False


def run_calibration(user_ids=None):
    """Run calibration for specified users or all users."""
    print("🎯 Starting calibration phase...")
    print("-" * 50)

    if user_ids is None or "all" in user_ids:
        cmd = ["python", "test_calibration.py", "all"]
    else:
        success_count = 0
        for user_id in user_ids:
            print(f"\n📋 Calibrating {user_id}...")
            cmd = ["python", "test_calibration.py", user_id]
            result = subprocess.run(cmd, capture_output=False)
            if result.returncode == 0:
                success_count += 1
            time.sleep(1)  # Brief pause between calibrations

        print(
            f"\n🏁 Calibration phase completed: {success_count}/{len(user_ids)} users successful"
        )
        return success_count == len(user_ids)

    result = subprocess.run(cmd, capture_output=False)
    return result.returncode == 0


def run_verification(user_ids=None, delay=2):
    """Run verification tests for specified users or all users."""
    print(f"\n⏳ Waiting {delay} seconds for calibration to settle...")
    time.sleep(delay)

    print("🔍 Starting verification phase...")
    print("-" * 50)

    if user_ids is None or "all" in user_ids:
        cmd = ["python", "test_verification.py", "all"]
    else:
        for user_id in user_ids:
            print(f"\n📋 Testing verification for {user_id}...")
            cmd = ["python", "test_verification.py", user_id]
            subprocess.run(cmd, capture_output=False)
            time.sleep(1)  # Brief pause between users
        return True

    result = subprocess.run(cmd, capture_output=False)
    return result.returncode == 0


def show_server_instructions():
    """Show instructions for starting the server."""
    print("🚀 TO START THE VOICE DETECTION SERVER:")
    print("-" * 50)
    print("1. Open a new terminal window")
    print("2. Navigate to the voice-detect directory:")
    print("   cd voice-detect")
    print("3. Start the Flask server:")
    print("   python app.py")
    print(
        "4. Wait for the server to start (you should see 'Running on http://127.0.0.1:5001')"
    )
    print("5. Return to this terminal and run the test again")
    print()


def main():
    print("🎙️  VOCERA VOICE DETECTION - FULL TEST SUITE")
    print("=" * 60)

    if len(sys.argv) > 1 and sys.argv[1] in ["-h", "--help"]:
        print("Usage: python run_full_test.py [user_ids...]")
        print("       python run_full_test.py")
        print("       python run_full_test.py laerdon srikar")
        print("       python run_full_test.py laerdon")
        print("\nIf no user_ids specified, tests all users.")
        print("\nThis script will:")
        print("1. Check if the server is running")
        print("2. Run calibration for specified users")
        print("3. Run verification tests")
        print("4. Provide detailed accuracy metrics")
        sys.exit(0)

    # Parse user IDs
    if len(sys.argv) > 1:
        user_ids = sys.argv[1:]
    else:
        user_ids = ["all"]

    print(f"🎯 Target users: {', '.join(user_ids)}")
    print()

    # Check if server is running
    if not check_server_status():
        print()
        show_server_instructions()
        sys.exit(1)

    print()

    # Run calibration
    start_time = time.time()
    calibration_success = run_calibration(user_ids)

    if not calibration_success:
        print("\n❌ Calibration failed. Aborting verification tests.")
        sys.exit(1)

    # Run verification tests
    verification_success = run_verification(user_ids)

    end_time = time.time()
    total_time = end_time - start_time

    print(f"\n🏁 FULL TEST SUITE COMPLETED")
    print("=" * 60)
    print(f"⏱️  Total execution time: {total_time:.1f} seconds")

    if calibration_success and verification_success:
        print("✅ All tests completed successfully!")
        sys.exit(0)
    else:
        print("❌ Some tests failed. Check the output above for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
