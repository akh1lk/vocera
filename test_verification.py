#!/usr/bin/env python3
"""
Verification testing script for voice detection system.
Tests model accuracy on real and fake audio files with detailed metrics.
"""

import os
import sys
import requests
import json
from pathlib import Path
import statistics
import time


def verify_audio(user_id, audio_file, base_url="http://localhost:5001"):
    """Verify a single audio file against a user profile."""
    try:
        with open(audio_file, "rb") as f:
            files = [("files", (audio_file.name, f, "audio/wav"))]
            data = {"user_id": user_id}

            response = requests.post(f"{base_url}/verify", data=data, files=files)

            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ Verification failed for {audio_file.name}")
                print(f"   Status: {response.status_code}, Response: {response.text}")
                return None

    except Exception as e:
        print(f"❌ Error verifying {audio_file.name}: {str(e)}")
        return None


def analyze_results(results, expected_authentic=True, label=""):
    """Analyze verification results and calculate metrics."""
    if not results:
        return None

    # Extract predictions and confidence scores
    predictions = []
    confidences = []
    correct = 0

    for result in results:
        if result is None:
            continue

        prediction = result.get("prediction")
        confidence = result.get("confidence", 0)

        predictions.append(prediction)
        confidences.append(confidence)

        # Check if prediction matches expected result
        if (prediction == True and expected_authentic) or (
            prediction == False and not expected_authentic
        ):
            correct += 1

    total = len([r for r in results if r is not None])
    if total == 0:
        return None

    accuracy = correct / total
    avg_confidence = statistics.mean(confidences) if confidences else 0
    confidence_std = statistics.stdev(confidences) if len(confidences) > 1 else 0

    # Calculate uncertainty metrics
    uncertain_predictions = [
        c for c in confidences if 40 <= c <= 60
    ]  # Close to decision boundary
    uncertainty_rate = len(uncertain_predictions) / total if total > 0 else 0

    return {
        "label": label,
        "total_files": total,
        "correct_predictions": correct,
        "accuracy": accuracy,
        "avg_confidence": avg_confidence,
        "confidence_std": confidence_std,
        "uncertainty_rate": uncertainty_rate,
        "min_confidence": min(confidences) if confidences else 0,
        "max_confidence": max(confidences) if confidences else 0,
        "expected_authentic": expected_authentic,
    }


def test_user_verification(
    user_id, real_dir, fake_dir, base_url="http://localhost:5001"
):
    """Test verification for a user on both real and fake audio files."""
    print(f"🎯 Testing verification for user '{user_id}'...")

    results = {
        "user_id": user_id,
        "real_files": [],
        "fake_files": [],
        "real_results": [],
        "fake_results": [],
    }

    # Test real files (should be authenticated)
    real_path = Path(real_dir)
    if real_path.exists():
        real_files = list(real_path.glob("*.wav")) + list(real_path.glob("*.mp3"))
        real_files.sort()

        print(f"  📁 Testing {len(real_files)} real files...")
        for audio_file in real_files:
            print(f"    🔍 {audio_file.name}... ", end="", flush=True)
            result = verify_audio(user_id, audio_file, base_url)

            if result:
                prediction = result.get("prediction")
                confidence = result.get("confidence", 0)
                status = "✅ PASS" if prediction else "❌ FAIL"
                print(f"{status} (confidence: {confidence:.1f})")
            else:
                print("❌ ERROR")

            results["real_files"].append(str(audio_file))
            results["real_results"].append(result)

    # Test fake files (should be rejected)
    fake_path = Path(fake_dir)
    if fake_path.exists():
        fake_files = list(fake_path.glob("*.wav")) + list(fake_path.glob("*.mp3"))
        fake_files.sort()

        print(f"  📁 Testing {len(fake_files)} fake files...")
        for audio_file in fake_files:
            print(f"    🔍 {audio_file.name}... ", end="", flush=True)
            result = verify_audio(user_id, audio_file, base_url)

            if result:
                prediction = result.get("prediction")
                confidence = result.get("confidence", 0)
                status = "✅ PASS" if not prediction else "❌ FAIL"
                print(f"{status} (confidence: {confidence:.1f})")
            else:
                print("❌ ERROR")

            results["fake_files"].append(str(audio_file))
            results["fake_results"].append(result)

    return results


def print_metrics(metrics_list):
    """Print detailed metrics in a formatted table."""
    print("\n" + "=" * 80)
    print("📊 DETAILED METRICS")
    print("=" * 80)

    for metrics in metrics_list:
        if metrics is None:
            continue

        print(f"\n🎯 {metrics['label']}")
        print(f"   Total files: {metrics['total_files']}")
        print(f"   Correct predictions: {metrics['correct_predictions']}")
        print(f"   Accuracy: {metrics['accuracy']:.2%}")
        print(f"   Average confidence: {metrics['avg_confidence']:.1f}")
        print(f"   Confidence std dev: {metrics['confidence_std']:.1f}")
        print(
            f"   Uncertainty rate (40-60% confidence): {metrics['uncertainty_rate']:.2%}"
        )
        print(
            f"   Confidence range: {metrics['min_confidence']:.1f} - {metrics['max_confidence']:.1f}"
        )


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_verification.py <user_id> [<real_dir>] [<fake_dir>]")
        print("       python test_verification.py all")
        print("\nExamples:")
        print("  python test_verification.py laerdon")
        print("  python test_verification.py srikar")
        print("  python test_verification.py all")
        sys.exit(1)

    user_id = sys.argv[1]
    base_url = "http://localhost:5001"

    if user_id == "all":
        # Test all users
        users = [
            ("laerdon", "laerdonsampledata/real", "laerdonsampledata/fake"),
            ("srikar", "srikarsampledata/real", "srikarsampledata/fake"),
            ("gold", "goldsampledata/real", "goldsampledata/fake"),
        ]

        all_metrics = []
        overall_results = []

        for uid, real_dir, fake_dir in users:
            print(f"\n{'='*60}")
            print(f"Testing user: {uid}")
            print("=" * 60)

            results = test_user_verification(uid, real_dir, fake_dir, base_url)
            overall_results.append(results)

            # Calculate metrics for this user
            real_metrics = analyze_results(
                results["real_results"], True, f"{uid} - Real Files"
            )
            fake_metrics = analyze_results(
                results["fake_results"], False, f"{uid} - Fake Files"
            )

            if real_metrics:
                all_metrics.append(real_metrics)
            if fake_metrics:
                all_metrics.append(fake_metrics)

        # Print overall metrics
        print_metrics(all_metrics)

        # Calculate and print overall system metrics
        all_real_results = []
        all_fake_results = []

        for result in overall_results:
            all_real_results.extend(
                [r for r in result["real_results"] if r is not None]
            )
            all_fake_results.extend(
                [r for r in result["fake_results"] if r is not None]
            )

        overall_real_metrics = analyze_results(
            all_real_results, True, "Overall - Real Files"
        )
        overall_fake_metrics = analyze_results(
            all_fake_results, False, "Overall - Fake Files"
        )

        print(f"\n{'='*80}")
        print("🏆 OVERALL SYSTEM PERFORMANCE")
        print("=" * 80)

        if overall_real_metrics and overall_fake_metrics:
            total_files = (
                overall_real_metrics["total_files"]
                + overall_fake_metrics["total_files"]
            )
            total_correct = (
                overall_real_metrics["correct_predictions"]
                + overall_fake_metrics["correct_predictions"]
            )
            overall_accuracy = total_correct / total_files if total_files > 0 else 0

            print(f"Total files tested: {total_files}")
            print(f"Overall accuracy: {overall_accuracy:.2%}")
            print(f"Real file accuracy: {overall_real_metrics['accuracy']:.2%}")
            print(f"Fake file accuracy: {overall_fake_metrics['accuracy']:.2%}")

            print_metrics([overall_real_metrics, overall_fake_metrics])

    else:
        # Test specific user
        if len(sys.argv) >= 4:
            real_dir = sys.argv[2]
            fake_dir = sys.argv[3]
        else:
            real_dir = f"{user_id}sampledata/real"
            fake_dir = f"{user_id}sampledata/fake"

        results = test_user_verification(user_id, real_dir, fake_dir, base_url)

        # Calculate and print metrics
        real_metrics = analyze_results(
            results["real_results"], True, f"{user_id} - Real Files"
        )
        fake_metrics = analyze_results(
            results["fake_results"], False, f"{user_id} - Fake Files"
        )

        print_metrics([real_metrics, fake_metrics])


if __name__ == "__main__":
    main()
