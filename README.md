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
