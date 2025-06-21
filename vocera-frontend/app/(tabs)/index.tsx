import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  FadeInUp, 
  FadeIn, 
  SlideInRight, 
  SlideInLeft, 
  ZoomIn, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Mic, Lock } from 'lucide-react-native';
import { VoxButton } from '../../components/VoxButton';
import { NameInput } from '../../components/NameInput';
import { InstructionsPanel } from '../../components/InstructionsPanel';
import { TranscriptView } from '../../components/TranscriptView';
import { Recorder } from '../../components/Recorder';
import { useVoceraStore } from '../../store/voceraStore';
import { voceraAPI } from '../../services/api';
import { RecordingResult } from '../../hooks/useAudioRecorder';

type VerificationStep = 'initial' | 'name-entry' | 'ready' | 'recording' | 'processing' | 'result';

// Wave Animation Component
const WaveAnimation = ({ isActive }: { isActive: boolean }) => {
  const waveValue = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      waveValue.value = withRepeat(
        withTiming(30, { 
          duration: 1200,
          easing: Easing.linear
        }),
        -1,
        false
      );
    } else {
      waveValue.value = withTiming(0, { duration: 300 });
    }
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -waveValue.value }],
  }));

  return (
    <View style={{ width: 120, height: 60, overflow: 'hidden' }}>
      <Animated.View style={[animatedStyle]}>
        <Svg width="180" height="60" viewBox="0 0 180 60">
          <Path
            d="M0 30 Q7.5 10, 15 30 T30 30 T45 30 T60 30 T75 30 T90 30 T105 30 T120 30 T135 30 T150 30 T165 30 T180 30"
            stroke="#258bb6"
            strokeWidth="3"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

export default function HomeScreen() {
  const [currentStep, setCurrentStep] = useState<VerificationStep>('initial');
  const [callerName, setCallerName] = useState('');
  const [nameError, setNameError] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    match: boolean;
    confidence: number;
    transcript: string;
  } | null>(null);

  // Ripple animation values
  const rippleScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(1);
  const outerRippleScale = useSharedValue(1);
  const middleRippleScale = useSharedValue(1);
  const innerRippleScale = useSharedValue(1);
  const outerRippleOpacity = useSharedValue(1);
  const middleRippleOpacity = useSharedValue(1);
  const innerRippleOpacity = useSharedValue(1);

  const { 
    user, 
    currentTranscript, 
    setCurrentTranscript,
    addSavedCall 
  } = useVoceraStore();

  const handleLogoPress = () => {
    // Create wave effect - each circle starts at a different time like ripples in a pond
    // Inner black circle stays at full opacity, only outer circles animate
    
    // Inner circle only scales (no opacity change)
    innerRippleScale.value = withSequence(
      withTiming(1.1, { duration: 300 }),
      withTiming(1, { duration: 400 })
    );
    
    // Middle circle starts slightly after - becomes more visible
    setTimeout(() => {
      middleRippleScale.value = withSequence(
        withTiming(1.2, { duration: 400 }),
        withTiming(1, { duration: 500 })
      );
      middleRippleOpacity.value = withSequence(
        withTiming(0.9, { duration: 400 }),
        withTiming(0.7, { duration: 500 })
      );
    }, 100);
    
    // Outer circle starts last - becomes more visible
    setTimeout(() => {
      outerRippleScale.value = withSequence(
        withTiming(1.15, { duration: 500 }),
        withTiming(1, { duration: 600 })
      );
      outerRippleOpacity.value = withSequence(
        withTiming(1.0, { duration: 500 }),
        withTiming(0.9, { duration: 600 })
      );
    }, 200);
  };

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const animatedOuterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerRippleScale.value }],
    opacity: outerRippleOpacity.value,
  }));

  const animatedMiddleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: middleRippleScale.value }],
    opacity: middleRippleOpacity.value,
  }));

  const animatedInnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerRippleScale.value }],
    // Removed opacity - inner circle stays 100% opaque
  }));

  const handleStartVerification = () => {
    if (!user?.hasVoxKey) {
      Alert.alert(
        'No Vox Key',
        'You need to set up your Vox Key first. Go to Settings to create one.',
        [{ text: 'OK' }]
      );
      return;
    }
    setCurrentStep('name-entry');
  };

  const handleNameSubmit = () => {
    const trimmedName = callerName.trim();
    
    if (!trimmedName) {
      setNameError('Please enter the caller\'s name');
      return;
    }
    
    if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    
    setNameError('');
    setCurrentStep('ready');
  };

  const handleRecordingStart = () => {
    setCurrentStep('recording');
    setCurrentTranscript('');
  };

  const handleRecordingComplete = async (result: RecordingResult) => {
    setCurrentStep('processing');
    
    try {
      const response = await voceraAPI.verifyVoxKey(
        {
          uri: result.uri,
          name: 'verification.wav',
          type: 'audio/wav',
        },
        callerName,
        user?.id
      );
      
      setVerificationResult(response);
      setCurrentTranscript(response.transcript);
      setCurrentStep('result');
      
      // Save call if verified
      if (response.match) {
        addSavedCall({
          id: Date.now().toString(),
          name: callerName,
          timestamp: new Date().toISOString(),
          audioUri: result.uri,
          transcript: response.transcript,
          confidence: response.confidence,
          verified: true,
        });
      }
      
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert('Error', 'Failed to verify voice. Please try again.');
      setCurrentStep('ready');
    }
  };

  const handleRecordingCancel = () => {
    setCurrentStep('ready');
  };

  const handleStartOver = () => {
    setCurrentStep('initial');
    setCallerName('');
    setNameError('');
    setVerificationResult(null);
    setCurrentTranscript('');
  };

  const handleSaveCall = () => {
    Alert.alert('Success', 'Call has been saved to your records.');
    handleStartOver();
  };

  const getFirstName = (fullName: string): string => {
    return fullName.trim().split(' ')[0];
  };

  const getInstructionStep = (): 'waiting' | 'ready' | 'recording' | 'processing' | 'complete' => {
    switch (currentStep) {
      case 'initial':
      case 'name-entry':
        return 'waiting';
      case 'ready':
        return 'ready';
      case 'recording':
        return 'recording';
      case 'processing':
        return 'processing';
      case 'result':
        return 'complete';
      default:
        return 'waiting';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['transparent', 'rgba(37, 139, 182, 0.08)', 'rgba(37, 139, 182, 0.18)', 'rgba(37, 139, 182, 0.3)']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradientContainer}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.header}>
          <Text style={styles.title}>Vocera</Text>
          <Text style={styles.subtitle}>Authenticate with a voice</Text>
        </Animated.View>

        {currentStep === 'initial' && (
          <>
            {/* Blue Button */}
            <Animated.View entering={FadeInUp.delay(300)} style={styles.buttonContainer}>
              <TouchableOpacity style={styles.beginButton} onPress={handleStartVerification}>
                <Mic size={20} color="#258bb6" />
                <Text style={styles.beginButtonText}>Tap to begin voice verification</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Circular Logo Design */}
            <Animated.View entering={ZoomIn.delay(500)} style={styles.logoContainer}>
              <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.8}>
                <View style={styles.circleStack}>
                  {/* Outer Circle - Behind everything */}
                  <Animated.View style={[styles.outerCircle, styles.absoluteCircle, animatedOuterStyle]} />
                  
                  {/* Middle Circle - Middle layer */}
                  <Animated.View style={[styles.middleCircle, styles.absoluteCircle, animatedMiddleStyle]} />
                  
                  {/* Inner Circle - Front layer with wave animation */}
                  <Animated.View style={[styles.innerCircle, styles.absoluteCircle, animatedInnerStyle]}>
                    <View style={styles.waveContainer}>
                      <WaveAnimation isActive={true} />
                    </View>
                    <Text style={styles.logoV}>V</Text>
                  </Animated.View>
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Trusted and Secure */}
            <Animated.View entering={FadeInUp.delay(700)} style={styles.trustContainer}>
              <View style={styles.trustRow}>
                <Text style={styles.trustText}>Trusted and secure </Text>
                <Lock size={16} color="#666666" />
              </View>
            </Animated.View>
          </>
        )}

        {currentStep === 'name-entry' && (
          <Animated.View entering={SlideInRight.delay(100)}>
            <NameInput
              value={callerName}
              onChangeText={setCallerName}
              error={nameError}
              autoFocus
              onSubmit={handleNameSubmit}
            />
            <View style={styles.buttonRow}>
              <VoxButton
                title="Back"
                onPress={() => setCurrentStep('initial')}
                variant="secondary"
                size="medium"
                style={styles.backButton}
              />
              <VoxButton
                title="Continue"
                onPress={handleNameSubmit}
                size="medium"
                style={styles.continueButton}
              />
            </View>
          </Animated.View>
        )}

        {(currentStep === 'ready' || currentStep === 'recording') && (
          <Animated.View entering={FadeIn.delay(100)}>
            <Recorder
              onRecordingComplete={handleRecordingComplete}
              onRecordingStart={handleRecordingStart}
              onRecordingCancel={handleRecordingCancel}
              maxDuration={10}
            />
            <VoxButton
              title="Change Name"
              onPress={() => setCurrentStep('name-entry')}
              variant="secondary"
              size="small"
              style={styles.changeNameButton}
            />
          </Animated.View>
        )}

        {currentStep === 'processing' && (
          <Animated.View entering={FadeIn} style={styles.processingContainer}>
            <VoxButton
              title="Analyzing..."
              onPress={() => {}}
              size="xl"
              loading
              disabled
            />
          </Animated.View>
        )}

        {(currentStep === 'recording' || currentStep === 'processing' || currentStep === 'result') && (
          <TranscriptView
            transcript={currentTranscript}
            isLive={currentStep === 'recording'}
            confidence={verificationResult?.confidence}
          />
        )}

        {currentStep === 'result' && verificationResult && (
          <Animated.View entering={SlideInLeft.delay(200)} style={styles.resultContainer}>
            <View style={[
              styles.resultCard,
              { backgroundColor: verificationResult.match ? '#D4F4DD' : '#FFE6E6' }
            ]}>
              <Text style={styles.resultIcon}>
                {verificationResult.match ? '✅' : '❌'}
              </Text>
              <Text style={styles.resultTitle}>
                {verificationResult.match ? 'Verified' : 'Not Verified'}
              </Text>
              <Text style={styles.resultDetails}>
                Confidence: {Math.round(verificationResult.confidence * 100)}%
              </Text>
              <Text style={styles.callerName}>{callerName}</Text>
            </View>

            <View style={styles.resultButtons}>
              {verificationResult.match && (
                <VoxButton
                  title="Save Call"
                  onPress={handleSaveCall}
                  size="medium"
                  style={styles.saveButton}
                />
              )}
              <VoxButton
                title="Verify Another"
                onPress={handleStartOver}
                variant="secondary"
                size="medium"
                style={styles.anotherButton}
              />
            </View>
          </Animated.View>
        )}
      </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f6f0',
  },
  gradientContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40,
  },
  title: {
    fontFamily: 'GeorgiaPro-CondBlack',
    fontSize: 64,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 18,
    color: '#333333',
    fontWeight: '500',
  },
  mainButton: {
    alignItems: 'center',
    marginVertical: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  continueButton: {
    flex: 2,
  },
  changeNameButton: {
    alignSelf: 'center',
    marginTop: 16,
  },
  processingContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  resultContainer: {
    marginTop: 24,
  },
  resultCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  resultIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  resultDetails: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4,
  },
  callerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  resultButtons: {
    gap: 12,
  },
  saveButton: {
    marginBottom: 8,
  },
  anotherButton: {
    marginBottom: 8,
  },
  // New styles for the updated design
  buttonContainer: {
    paddingHorizontal: 20,
    marginVertical: 20,
    marginBottom: 10, // Reduced bottom margin to bring closer to logo
  },
  beginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 8,
  },
  beginButtonText: {
    color: '#258bb6',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  circleStack: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  absoluteCircle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerCircle: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // More white, subtle
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  middleCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.7)', // Much more white
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  innerCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#000000', // Pure black to match PNG logo
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
    // Enhanced inner glow effect
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10, // Ensure it's on top
  },
  logoImage: {
    width: 90,
    height: 90,
  },
  logoV: {
    fontSize: 64,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'GeorgiaPro-CondRegular',
    position: 'absolute',
    zIndex: 2,
  },
  waveContainer: {
    position: 'absolute',
    zIndex: 1,
  },
  waveform: {
    fontSize: 20,
    color: '#007AFF',
    marginTop: -5,
  },
  trustContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Inter-Medium',
  },
});
