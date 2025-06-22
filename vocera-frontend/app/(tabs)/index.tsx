import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  runOnJS
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Mic, Lock, X } from 'lucide-react-native';
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
  const [isAnimated, setIsAnimated] = useState(false);

  // Animation values
  const logoTranslateY = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const fadeOutAnimation = useSharedValue(1);

  // Ripple animation values
  const outerRippleScale = useSharedValue(1);
  const middleRippleScale = useSharedValue(1);
  const innerRippleScale = useSharedValue(1);
  const outerRippleOpacity = useSharedValue(1);
  const middleRippleOpacity = useSharedValue(0.7);

  const {
    user,
    currentTranscript,
    setCurrentTranscript,
    addSavedCall
  } = useVoceraStore();

  const handleLogoPress = () => {
    // First do the ripple effect
    innerRippleScale.value = withSequence(
      withTiming(1.1, { duration: 300 }),
      withTiming(1, { duration: 400 })
    );

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

    // After ripple completes, fade out text, then move logo
    setTimeout(() => {
      // Fade out header and trusted text (but don't remove from layout)
      fadeOutAnimation.value = withTiming(0, { duration: 600 }); // fade earlier & faster

      // Move logo to top and shrink AFTER fade completes
      setTimeout(() => {
        logoTranslateY.value = withTiming(-320, { // move not as high
          duration: 1600,
          easing: Easing.out(Easing.cubic)
        });
        logoScale.value = withTiming(0.4, {
          duration: 2000,
          easing: Easing.out(Easing.cubic)
        });

        // Set animated state after animation starts
        setTimeout(() => {
          runOnJS(setIsAnimated)(true);
        }, 100);
      }, 600); // wait for fade to finish
    }, 700);
  };

  const handleResetAnimation = () => {
    // Reset all animations with smooth easing
    logoTranslateY.value = withTiming(0, {
      duration: 1000,
      easing: Easing.out(Easing.cubic)
    });
    logoScale.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.cubic)
    });
    fadeOutAnimation.value = withTiming(1, { duration: 800 });
    setIsAnimated(false);
  };

  // Animated styles
  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: logoTranslateY.value },
      { scale: logoScale.value }
    ],
  }));

  // Add fade out to all text except the animated button
  const animatedFadeOutStyle = useAnimatedStyle(() => ({
    opacity: fadeOutAnimation.value,
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
    handleResetAnimation();
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

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['transparent', 'rgba(37, 139, 182, 0.08)', 'rgba(37, 139, 182, 0.18)', 'rgba(37, 139, 182, 0.3)']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradientContainer}
      >
        {/* X Button - Fixed position */}
        {isAnimated && (
          <TouchableOpacity onPress={handleResetAnimation} style={styles.resetButton}>
            <X size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}

        <View style={styles.content}>
          {/* Header - ALWAYS present, just fades */}
          <Animated.View style={[styles.header, animatedFadeOutStyle]}>
            <Text style={styles.title}>Vocera</Text>
            <Text style={styles.subtitle}>Authenticate with a voice</Text>
          </Animated.View>

          {/* Move the 'Tap to begin voice verification' text above the button */}
          <Animated.View style={[{ alignItems: 'center', marginTop: 4, marginBottom: 0 }, animatedFadeOutStyle]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Mic size={20} color="#258bb6" style={{ marginRight: 8 }} />
              <Text style={styles.beginButtonText}>Tap to begin voice verification</Text>
            </View>
          </Animated.View>

          {/* Animated button container */}
          <Animated.View style={styles.buttonContainer}>
            {currentStep === 'initial' && (
              <>
                {/* Circular Logo Design - Moves and shrinks */}
                <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
                  <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.8}>
                    <View style={styles.circleStack}>
                      {/* Outer Circle */}
                      <Animated.View style={[styles.outerCircle, styles.absoluteCircle, animatedOuterStyle]} />

                      {/* Middle Circle */}
                      <Animated.View style={[styles.middleCircle, styles.absoluteCircle, animatedMiddleStyle]} />

                      {/* Inner Circle */}
                      <Animated.View style={[styles.innerCircle, styles.absoluteCircle, animatedInnerStyle]}>
                        <View style={styles.waveContainer}>
                          <WaveAnimation isActive={true} />
                        </View>
                        <Text style={styles.logoV}>V</Text>
                      </Animated.View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              </>
            )}

          <Animated.View style={[styles.trustContainer, animatedFadeOutStyle]}>
            <View style={styles.trustRow}>
              <Text style={styles.trustText}>Trusted and secure </Text>
              <Lock size={16} color="#666666" />
            </View>
          </Animated.View>

            {/* Other steps */}
            {currentStep === 'name-entry' && (
              <View>
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
              </View>
            )}

            {(currentStep === 'ready' || currentStep === 'recording') && (
              <View>
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
              </View>
            )}

            {currentStep === 'processing' && (
              <View style={styles.processingContainer}>
                <VoxButton
                  title="Analyzing..."
                  onPress={() => { }}
                  size="xl"
                  loading
                  disabled
                />
              </View>
            )}

            {(currentStep === 'recording' || currentStep === 'processing' || currentStep === 'result') && (
              <TranscriptView
                transcript={currentTranscript}
                isLive={currentStep === 'recording'}
                confidence={verificationResult?.confidence}
              />
            )}

            {currentStep === 'result' && verificationResult && (
              <View style={styles.resultContainer}>
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
              </View>
            )}
          </Animated.View>
        </View>
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
  content: {
    flex: 1,
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
  buttonContainer: {
    paddingHorizontal: 20,
    marginVertical: 20,
    marginBottom: 10,
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
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
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
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
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
    backgroundColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10,
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
  resetButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
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
});