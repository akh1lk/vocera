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
=======
# Vocera - Voice Authentication + DeepFake Detection System

A sophisticated voice verification platform combining React Native mobile app, FastAPI backend, and advanced machine learning for secure biometric authentication. 

## 🎯 Overview

  <img src="https://github.com/user-attachments/assets/bbc22cbe-8984-4ba7-9945-e842779a1af7" height="500"/>
  <img src="https://github.com/user-attachments/assets/8f6b4c57-47d3-4953-8296-00051cc7b170" height="500"/>
  <img src="https://github.com/user-attachments/assets/74209a11-7df8-490f-bef7-576690a5299a" height="500"/>

Vocera is a comprehensive voice authentication system that uses multiple AI models to verify user identity through voice analysis. In a world of deepfakes that are difficult for the human eyes and ears to discern, Vocera provides you with a way to verify the world around you. Specifically, it helps you prevent deepfake calls from scammers, who pose as family & friends asking for money.
The platform employs a dual-verification approach using both traditional signal processing (openSMILE) and modern deep learning (SpeechBrain ECAPA-VOXCELEB) for robust speaker verification.

## ✨ Features

### 🔊 **Advanced Voice Authentication**
- **Dual Verification System**: Combines openSMILE feature extraction with SpeechBrain deep learning
- **Anti-Deepfake Protection**: Sophisticated algorithms to detect synthetic voice generation
- **Confidence Scoring**: Sigmoid-based confidence calculation with tunable thresholds
- **Feature Normalization**: StandardScaler preprocessing for consistent analysis

### 📱 **Cross-Platform Mobile App**
- **Universal Support**: iOS, Android, and Web deployment
- **Real-time Recording**: High-quality voice capture with waveform visualization
- **Auth Integration**: Supabase Email Sign-In authentication
- **Cloud Sync**: Supabase backend integration for data persistence

### 🤖 **Machine Learning Pipeline**
- **openSMILE Feature Extraction**: 88-dimensional eGeMAPSv02 feature vectors
- **SpeechBrain ECAPA-VOXCELEB**: State-of-the-art speaker verification model
- **Textual Verification**: OpenAI Whisper transcription with GPT-4 semantic analysis
- **Euclidean Distance Analysis**: Normalized distance calculations for authenticity scoring

## 🛠️ Tech Stack

### Frontend (vocera-frontend) + Backend
- **Framework**: React Native & Expo
- **Styling**: TailwindCSS with NativeWind
- **Audio**: Expo Audio for recording and playback
- **State Management**: Zustand
- **Backend**: Supabase client integration, Supabase Buckets Storage
- **AI Integration**: OpenAI & Anthropic APIs

### ML Models (voice-detect)
- **Server**: Flask with Python 3.9
- **ML Libraries**: 
  - openSMILE (feature extraction)
  - SpeechBrain (speaker verification)
  - scikit-learn (StandardScaler normalization)
  - NumPy/SciPy (numerical computation)
- **Database**: Supabase (PostgreSQL-based)
- **AI Services**: OpenAI Whisper, GPT-4
- **Deployment**: Docker containerization ready

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- Expo CLI
- iOS Simulator or Android emulator

### Installation

1. **Clone Repository**
```bash
git clone <repository-url>
cd vocera
```

2. **Install Dependencies**
```bash
# Install all dependencies
npm run install:all

# Or install individually
cd vocera-frontend && npm install
cd ../voice-detect && pip install -r requirements.txt
cd ../api && pip install -r requirements.txt
```

3. **Environment Setup**

Create `vocera-frontend/.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_key
EXPO_PUBLIC_ANTHROPIC_API_KEY=your_anthropic_key
```

Create `voice-detect/.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
OPENAI_API_KEY=your_openai_key
```

### Development

**Start Voice Detection Server:**
```bash
cd voice-detect
python app.py
# Server runs on http://localhost:5001
```

**Start Frontend:**
```bash
cd vocera-frontend
npm run start
# Then choose your platform:
# - Press 'i' for iOS simulator
# - Press 'a' for Android emulator  
# - Press 'w' for web browser
```

```

## 🔬 Voice Authentication Process

### 1. Calibration Phase
```bash
# Calibrate user profile with 10 voice samples
curl -X POST http://localhost:5001/calibrate \
  -F "user_id=username" \
  -F "files=@sample1.wav" \
  -F "files=@sample2.wav" \
  # ... (all 10 calibration files)
```

### 2. Verification Phase
```bash
# Verify voice sample against user profile
curl -X POST http://localhost:5001/verify \
  -F "user_id=username" \
  -F "files=@test_voice.wav"
```