# Vocera Voice Detection System - Testing Guide

This guide provides streamlined commands for end-to-end testing of the voice detection system, including calibration, verification, and accuracy metrics.

## 🎯 Quick Start

### 1. Start the Voice Detection Server

```bash
cd voice-detect
python app.py
```

The server will start on `http://localhost:5001`

### 2. Run Full Test Suite

```bash
# Test all users (recommended)
python run_full_test.py

# Test specific users
python run_full_test.py laerdon srikar
python run_full_test.py laerdon
```

## 📁 Data Structure

The project contains sample data organized as follows:

```
├── laerdonsampledata/
│   ├── calib/          # 10 calibration files (vox_calib_0.wav to vox_calib_9.wav)
│   ├── real/           # 4 authentic voice files
│   └── fake/           # 8 deepfake/synthetic voice files
├── srikarsampledata/
│   ├── calib/          # 10 calibration files (srikar_0.wav to srikar_9.wav)
│   ├── real/           # 3 authentic voice files
│   └── fake/           # 2 deepfake/synthetic voice files
```

## 🔧 Individual Testing Commands

### Calibration Only

```bash
# Calibrate all users
python test_calibration.py all

# Calibrate specific user
python test_calibration.py laerdon
python test_calibration.py srikar

# Calibrate with custom directory
python test_calibration.py laerdon laerdonsampledata/calib
```

### Verification Only

```bash
# Test all users (requires prior calibration)
python test_verification.py all

# Test specific user
python test_verification.py laerdon
python test_verification.py srikar

# Test with custom directories
python test_verification.py laerdon laerdonsampledata/real laerdonsampledata/fake
```

## 📊 Understanding the Metrics

The testing scripts provide comprehensive accuracy metrics:

### Core Metrics

- **Accuracy**: Percentage of correct predictions (authentic vs. fake)
- **Total Files**: Number of test files processed
- **Correct Predictions**: Number of files correctly classified

### Confidence Analysis

- **Average Confidence**: Mean confidence score across all predictions
- **Confidence Std Dev**: Standard deviation of confidence scores
- **Confidence Range**: Min and max confidence values observed

### Uncertainty Metrics

- **Uncertainty Rate**: Percentage of predictions with confidence between 40-60%
  - These are "close calls" where the model is least certain
  - High uncertainty rates may indicate need for model tuning
  - Useful for identifying edge cases and potential false positives/negatives

### Interpretation Guide

#### Good Performance Indicators:

- **High Accuracy (>90%)**: Model correctly identifies most authentic/fake voices
- **Low Uncertainty Rate (<20%)**: Model makes confident decisions
- **High Average Confidence (>70)**: Model is generally confident in predictions
- **Clear Separation**: Real files have high confidence (>70), fake files have low confidence (<30)

#### Areas for Improvement:

- **High Uncertainty Rate (>30%)**: Many borderline predictions, model may need tuning
- **Low Confidence Standard Deviation**: All predictions similar confidence, may indicate poor discrimination
- **Mid-range Average Confidence (40-60)**: Model struggling to differentiate

## 🎙️ API Endpoints Reference

### Calibration

```bash
curl -X POST http://localhost:5001/calibrate \
  -F "user_id=laerdon" \
  -F "files=@laerdonsampledata/calib/vox_calib_0.wav" \
  -F "files=@laerdonsampledata/calib/vox_calib_1.wav" \
  # ... (all 10 calibration files)
```

### Verification

```bash
curl -X POST http://localhost:5001/verify \
  -F "user_id=laerdon" \
  -F "files=@laerdonsampledata/real/realfile.wav"
```

### Get Profile

```bash
curl http://localhost:5001/get_profile/laerdon
```

## 🔬 Advanced Testing Scenarios

### Testing Individual Files

```bash
# Test a specific audio file
curl -X POST http://localhost:5001/verify \
  -F "user_id=laerdon" \
  -F "files=@path/to/audio.wav"
```

### Batch Testing Custom Files

```bash
# Create custom test directory structure
mkdir -p custom_test/real custom_test/fake

# Copy your test files
cp authentic_sample.wav custom_test/real/
cp synthetic_sample.wav custom_test/fake/

# Run verification
python test_verification.py laerdon custom_test/real custom_test/fake
```

### Performance Benchmarking

```bash
# Time the full test suite
time python run_full_test.py

# Test with verbose logging
cd voice-detect
FLASK_ENV=development python app.py
```

## 🐛 Troubleshooting

### Server Not Responding

```bash
# Check if server is running
curl http://localhost:5001/get_profile/test

# Check server logs
cd voice-detect
tail -f voice_detect.log
```

### File Format Issues

- Ensure audio files are in `.wav` format
- Some `.mp3` files are supported but `.wav` is recommended
- Verify file paths are correct and files exist

### Calibration Failures

- Verify exactly 10 calibration files exist
- Check file permissions and accessibility
- Ensure server has sufficient disk space for temporary files

### Low Accuracy Issues

- Review confidence scores to identify systematic issues
- Check if textual verification is working (transcription matching)
- Consider adjusting `OPEN_SMILE_THRESHOLD_MULTIPLIER` in `voice-detect/app.py`

## 📈 Metrics Analysis Examples

### Example: Good Performance

```
🎯 laerdon - Real Files
   Total files: 4
   Correct predictions: 4
   Accuracy: 100.00%
   Average confidence: 85.3
   Uncertainty rate: 0.00%
   Confidence range: 72.1 - 94.5

🎯 laerdon - Fake Files
   Total files: 8
   Correct predictions: 7
   Accuracy: 87.50%
   Average confidence: 25.4
   Uncertainty rate: 12.50%
   Confidence range: 15.2 - 48.3
```

### Example: Needs Improvement

```
🎯 srikar - Real Files
   Total files: 3
   Correct predictions: 2
   Accuracy: 66.67%
   Average confidence: 52.1
   Uncertainty rate: 66.67%
   Confidence range: 43.2 - 58.9
```

## 🚀 Automated CI/CD Integration

For continuous testing, you can integrate these scripts into your CI/CD pipeline:

```bash
#!/bin/bash
# ci_test.sh - Automated testing script

# Start server in background
cd voice-detect
python app.py &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Run full test suite
cd ..
python run_full_test.py

# Capture exit code
TEST_RESULT=$?

# Clean up
kill $SERVER_PID

# Exit with test result
exit $TEST_RESULT
```

## 📝 Notes

- The system uses openSMILE features for voice analysis
- Textual verification ensures spoken content matches expected phrases
- User profiles are stored as JSON files in `voice-detect/user_profiles/`
- Temporary files are automatically cleaned up after processing
- All confidence scores are normalized to 0-100 scale where >50 indicates authentic voice

## 🔧 Dependencies

Ensure all required packages are installed:

```bash
cd voice-detect
pip install -r requirements.txt
```

Required packages:

- Flask (web server)
- numpy, scipy (numerical computation)
- opensmile (audio feature extraction)
- requests (for testing scripts)
- openai (for transcription)
- python-dotenv (environment variables)
