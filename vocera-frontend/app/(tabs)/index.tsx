import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  runOnJS,
  interpolate,
  FadeIn,
  cancelAnimation
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Mic, Lock, X } from 'lucide-react-native';
import { VoxButton } from '../../components/VoxButton';
import { NameInput } from '../../components/NameInput';
import { InstructionsPanel } from '../../components/InstructionsPanel';
import { TranscriptView } from '../../components/TranscriptView';
import { useVoceraStore } from '../../store/voceraStore';
import { supabaseService } from '../../services/supabaseService';
import { openaiService, herokuService } from '../../services/openaiService';
import { audioUtils } from '../../services/audioUtils';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';

type VerificationStep = 'initial' | 'name-entry' | 'ready' | 'recording' | 'processing' | 'result';

// Wave Animation Component
const WaveAnimation = ({ isActive }: { isActive: boolean }) => {
  const waveValue = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      // Reset to 0 before starting new animation
      waveValue.value = 0;
      waveValue.value = withRepeat(
        withTiming(30, {
          duration: 1200,
          easing: Easing.linear
        }),
        -1,
        false
      );
    } else {
      // Cancel any ongoing animation
      cancelAnimation(waveValue);
      waveValue.value = withTiming(0, { duration: 300 });
    }
    
    // Cleanup function
    return () => {
      cancelAnimation(waveValue);
    };
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
  const [showNameInput, setShowNameInput] = useState(false);
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(5);
  const [showRecordingText, setShowRecordingText] = useState(false);

  // Audio recording
  const audioRecorder = useAudioRecorder({
    extension: '.wav',
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  });
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentTargetUserIdRef = useRef<string | null>(null);

  // Animation values
  const logoTranslateY = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const fadeOutAnimation = useSharedValue(1);
  const middleContentOpacity = useSharedValue(1);
  const nameInputOpacity = useSharedValue(0);
  const instructionsOpacity = useSharedValue(0);
  const xButtonOpacity = useSharedValue(0);
  const xButtonScale = useSharedValue(0.8);
  const recordingTextOpacity = useSharedValue(0);
  const transcriptOpacity = useSharedValue(0);
  const resultOpacity = useSharedValue(0);

  // Entrance animation values
  const entranceProgress = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const micTextOpacity = useSharedValue(0);
  const trustOpacity = useSharedValue(0);

  // Ripple animation values
  const outerRippleScale = useSharedValue(0.8);
  const middleRippleScale = useSharedValue(0.8);
  const innerRippleScale = useSharedValue(0.8);
  const outerRippleOpacity = useSharedValue(0);
  const middleRippleOpacity = useSharedValue(0);
  const innerRippleOpacity = useSharedValue(0);

  const {
    user,
    currentTranscript,
    setCurrentTranscript,
    addSavedCall,
    setTargetUserId,
    targetUserId
  } = useVoceraStore();

  // Entrance animations on mount
  useEffect(() => {

    // Title fades in first
    titleOpacity.value = withTiming(1, { 
      duration: 800,
      easing: Easing.out(Easing.quad)
    });

    // Subtitle follows
    subtitleOpacity.value = withDelay(200, withTiming(1, { 
      duration: 800,
      easing: Easing.out(Easing.quad)
    }));

    // Logo scales up and fades in
    logoOpacity.value = withDelay(400, withTiming(1, { 
      duration: 1000,
      easing: Easing.out(Easing.cubic)
    }));

    // Ripples animate in sequence
    outerRippleScale.value = withDelay(600, withSpring(1, {
      damping: 15,
      stiffness: 100
    }));
    outerRippleOpacity.value = withDelay(600, withTiming(1, { duration: 600 }));

    middleRippleScale.value = withDelay(700, withSpring(1, {
      damping: 15,
      stiffness: 100
    }));
    middleRippleOpacity.value = withDelay(700, withTiming(0.7, { duration: 600 }));

    innerRippleScale.value = withDelay(800, withSpring(1, {
      damping: 15,
      stiffness: 100
    }));
    innerRippleOpacity.value = withDelay(800, withTiming(1, { duration: 600 }));

    // Mic text and trust text fade in last
    micTextOpacity.value = withDelay(1000, withTiming(1, { 
      duration: 600,
      easing: Easing.out(Easing.quad)
    }));

    trustOpacity.value = withDelay(1200, withTiming(1, { 
      duration: 600,
      easing: Easing.out(Easing.quad)
    }));

    // Overall entrance progress
    entranceProgress.value = withTiming(1, { 
      duration: 1500,
      easing: Easing.out(Easing.cubic)
    });
  }, []);

  const handleLogoPress = async () => {
    // Start recording immediately
    try {
      await audioRecorder.prepareToRecordAsync({
        extension: '.wav',
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
        isMeteringEnabled: true,
      });
      audioRecorder.record();
      console.log('Recording started on logo press');
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Could not start recording.');
      return;
    }
    // Smoother ripple effect with better timing
    innerRippleScale.value = withSequence(
      withSpring(1.15, { damping: 8, stiffness: 150 }),
      withSpring(1, { damping: 10, stiffness: 100 })
    );

    setTimeout(() => {
      middleRippleScale.value = withSequence(
        withSpring(1.25, { damping: 8, stiffness: 120 }),
        withSpring(1, { damping: 10, stiffness: 100 })
      );
      middleRippleOpacity.value = withSequence(
        withTiming(0.9, { duration: 300 }),
        withTiming(0.7, { duration: 400 })
      );
    }, 50);

    setTimeout(() => {
      outerRippleScale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 100 }),
        withSpring(1, { damping: 10, stiffness: 100 })
      );
      outerRippleOpacity.value = withSequence(
        withTiming(1.0, { duration: 300 }),
        withTiming(0.9, { duration: 400 })
      );
    }, 100);

    // Smoother fade out and transition
    setTimeout(() => {
      // Fade out all text elements smoothly
      fadeOutAnimation.value = withTiming(0, { 
        duration: 400,
        easing: Easing.in(Easing.quad)
      });
      micTextOpacity.value = withTiming(0, { duration: 300 });
      trustOpacity.value = withTiming(0, { duration: 300 });

      // Move logo with better easing
      setTimeout(() => {
        logoTranslateY.value = withSpring(-320, {
          damping: 20,
          stiffness: 90,
          mass: 1
        });
        logoScale.value = withSpring(0.4, {
          damping: 15,
          stiffness: 100
        });

        // Fade out ripples smoothly
        middleContentOpacity.value = withTiming(0, { 
          duration: 600,
          easing: Easing.out(Easing.quad)
        });

        setTimeout(() => {
          runOnJS(setIsAnimated)(true);
          runOnJS(setShowNameInput)(true);
          
          // Animate X button in
          xButtonOpacity.value = withSpring(1, {
            damping: 15,
            stiffness: 100
          });
          xButtonScale.value = withSpring(1, {
            damping: 12,
            stiffness: 150
          });
          
          // Fade in name input smoothly
          setTimeout(() => {
            nameInputOpacity.value = withSpring(1, {
              damping: 20,
              stiffness: 100
            });
          }, 400);
        }, 100);
      }, 300);
    }, 500);
  };

  const handleResetAnimation = () => {
    // Hide X button immediately
    xButtonOpacity.value = withTiming(0, { duration: 0 });
    xButtonScale.value = withTiming(0.8, { 
      duration: 200,
      easing: Easing.in(Easing.quad)
    });
    
    // Fade out name input and instructions first
    nameInputOpacity.value = withTiming(0, { duration: 300 });
    instructionsOpacity.value = withTiming(0, { duration: 300 });
    
    // Smooth reset with spring animations
    logoTranslateY.value = withSpring(0, {
      damping: 15,
      stiffness: 80
    });
    logoScale.value = withSpring(1, {
      damping: 15,
      stiffness: 80
    });
    
    // Wait for button to return before fading text back in
    setTimeout(() => {
      // Fade elements back in after button is in place
      fadeOutAnimation.value = withTiming(1, { 
        duration: 600,
        easing: Easing.out(Easing.quad)
      });
      middleContentOpacity.value = withTiming(1, { duration: 600 });
      micTextOpacity.value = withTiming(1, { duration: 400 });
      trustOpacity.value = withTiming(1, { duration: 400 });
    }, 800); // Wait for spring animation to mostly complete
    
    setTimeout(() => {
      setIsAnimated(false);
      setShowNameInput(false);
      setCallerName('');
      setNameError('');
      setCurrentTranscript('');
      setNameSubmitted(false);
      setTargetUserId(null);
      currentTargetUserIdRef.current = null;
      setShowRecordingText(false);
      setRecordingTimeLeft(5);
      recordingTextOpacity.value = 0;
      transcriptOpacity.value = 0;
      resultOpacity.value = 0;
      setCurrentStep('initial'); // Reset to initial step so button appears
      
      // Clean up recording if active
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // Stop and cleanup audio recording
      audioRecorder.stop().catch(console.error);
      audioUtils.cleanupTempFiles().catch(console.error);
    }, 300);
  };

  // Animated styles
  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: logoTranslateY.value },
      { scale: logoScale.value }
    ],
    opacity: 1 // Keep logo always visible
  }));

  const animatedTitleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value * fadeOutAnimation.value,
    transform: [{
      translateY: interpolate(titleOpacity.value, [0, 1], [20, 0])
    }]
  }));

  const animatedSubtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value * fadeOutAnimation.value,
    transform: [{
      translateY: interpolate(subtitleOpacity.value, [0, 1], [20, 0])
    }]
  }));

  const animatedMicTextStyle = useAnimatedStyle(() => ({
    opacity: micTextOpacity.value * fadeOutAnimation.value,
    transform: [{
      translateY: interpolate(micTextOpacity.value, [0, 1], [10, 0])
    }]
  }));

  const animatedTrustStyle = useAnimatedStyle(() => ({
    opacity: trustOpacity.value * fadeOutAnimation.value,
    transform: [{
      translateY: interpolate(trustOpacity.value, [0, 1], [10, 0])
    }]
  }));

  const animatedMiddleContentStyle = useAnimatedStyle(() => ({
    opacity: middleContentOpacity.value,
  }));

  const animatedNameInputStyle = useAnimatedStyle(() => ({
    opacity: nameInputOpacity.value,
    transform: [{
      scale: interpolate(nameInputOpacity.value, [0, 1], [0.9, 1])
    }]
  }));

  const animatedInstructionsStyle = useAnimatedStyle(() => ({
    opacity: instructionsOpacity.value,
    transform: [{
      translateY: interpolate(instructionsOpacity.value, [0, 1], [-10, 0])
    }],
    pointerEvents: instructionsOpacity.value > 0 ? 'auto' : 'none',
  }));

  const animatedRecordingTextStyle = useAnimatedStyle(() => ({
    opacity: recordingTextOpacity.value,
    transform: [{
      translateY: interpolate(recordingTextOpacity.value, [0, 1], [10, 0])
    }]
  }));

  const animatedTranscriptStyle = useAnimatedStyle(() => ({
    opacity: transcriptOpacity.value,
    transform: [{
      translateY: interpolate(transcriptOpacity.value, [0, 1], [20, 0])
    }]
  }));

  const animatedResultStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
    transform: [{
      translateY: interpolate(resultOpacity.value, [0, 1], [30, 0])
    }]
  }));

  const animatedOuterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerRippleScale.value }],
    opacity: outerRippleOpacity.value * middleContentOpacity.value,
  }));

  const animatedMiddleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: middleRippleScale.value }],
    opacity: middleRippleOpacity.value * middleContentOpacity.value,
  }));

  const animatedInnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerRippleScale.value }],
    opacity: innerRippleOpacity.value,
  }));

  // Create animated style for X button
  const animatedXButtonStyle = useAnimatedStyle(() => ({
    opacity: xButtonOpacity.value,
    transform: [{
      scale: xButtonScale.value
    }]
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

  const handleNameSubmit = async () => {
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
    
    try {
      // Look up user by name
      const foundUser = await supabaseService.findUserByName(trimmedName);
      
      if (!foundUser) {
        setNameError('No user found with that name');
        return;
      }
      
      // Store the target user ID in both state and ref
      setTargetUserId(foundUser.id);
      currentTargetUserIdRef.current = foundUser.id;
      console.log('Found user:', foundUser.first_name, foundUser.last_name, 'ID:', foundUser.id);
      
      // Slower fade out for name input
      nameInputOpacity.value = withTiming(0, { 
        duration: 500,
        easing: Easing.in(Easing.quad)
      });
      
      setTimeout(() => {
        instructionsOpacity.value = withSpring(1, {
          damping: 20,
          stiffness: 100
        });
        
        // Start 5-second countdown for vox key phrase
        setRecordingTimeLeft(5);
        recordingTimerRef.current = setInterval(() => {
          setRecordingTimeLeft(prev => {
            console.log('Recording time left:', prev);
            
            if (prev <= 1) {
              handleStopRecording();
              return 0;
            }
            
            // Show recording text when 0.5 seconds left (prev will be 1 after decrement)
            if (prev === 2) {
              console.log('Showing recording text');
              setShowRecordingText(true);
              recordingTextOpacity.value = withTiming(1, { duration: 300 });
            }
            
            return prev - 1;
          });
        }, 1000);
      }, 400);

      setNameSubmitted(true);
      
    } catch (error) {
      console.error('Error looking up user:', error);
      setNameError('Error finding user. Please try again.');
    }
  };

  const handleStopRecording = async () => {
    // Clear the timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // Hide recording text when recording stops
    setShowRecordingText(false);
    recordingTextOpacity.value = withTiming(0, { duration: 300 });

    try {
      // Stop the recording
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      
      if (uri) {
        console.log('Recording completed, URI:', uri);
        console.log('Target user ID at recording completion:', targetUserId);
        
        // Debug: Check file extension - we can see it's .m4a
        console.log('File extension from URI:', uri.split('.').pop());
        
        // Create a RecordingResult-like object for processing
        const result = { uri };
        handleRecordingComplete(result);
      } else {
        throw new Error('No recording URI available');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to complete recording. Please try again.');
    }
  };

  const handleEditName = () => {
    instructionsOpacity.value = withTiming(0, { 
      duration: 300,
      easing: Easing.in(Easing.quad)
    });
    
    setTimeout(() => {
      nameInputOpacity.value = withSpring(1, {
        damping: 20,
        stiffness: 100
      });
    }, 200);

    setNameSubmitted(false);
  };

  const handleRecordingComplete = async (result: { uri: string }) => {
    setCurrentStep('result');
    
    // Fade in transcript area
    transcriptOpacity.value = withTiming(1, { 
      duration: 600,
      easing: Easing.out(Easing.quad)
    });

    const currentTargetUserId = currentTargetUserIdRef.current;
    if (!currentTargetUserId) {
      Alert.alert('Error', 'No target user found. Please try again.');
      setCurrentStep('ready');
      return;
    }

    try {
      // Start both processes concurrently
      const [last5SecondsSegment, fullTranscript] = await Promise.all([
        // Extract last 5 seconds for verification API using audioUtils
        audioUtils.extractLast5Seconds(result.uri),
        // Get full transcript from Whisper
        openaiService.transcribeAudio(result.uri).catch((error) => {
          console.warn('Whisper transcription failed:', error);
          return 'Transcription failed';
        })
      ]);

      if (!last5SecondsSegment) {
        throw new Error('Failed to extract audio segment for verification');
      }

      // Send wav file to Heroku /verify endpoint
      console.log('Sending audio to Heroku verification API...');
      console.log('Target user ID:', currentTargetUserId);
      console.log('Caller name:', callerName);
      console.log('Audio file URI:', last5SecondsSegment.uri);
      
      // Call Heroku /verify endpoint with wav file and target.id
      const verificationResult = await herokuService.uploadWavFile(
        last5SecondsSegment.uri,
        '/verify',
        {
          target_id: currentTargetUserId,
          user_id: user?.id
        }
      );
      
      console.log('Heroku verification result:', verificationResult);

      // Set the transcript from Whisper only
      const finalTranscript = fullTranscript !== 'Transcription failed' ? fullTranscript : 'Transcription unavailable';
      setCurrentTranscript(finalTranscript);
      console.log('Final transcript from Whisper:', finalTranscript);

      // Create final result object using API response
      const finalResult = {
        match: !verificationResult.prediction || false,
        confidence: verificationResult.confidence || 0,
        transcript: finalTranscript
      };
      setVerificationResult(finalResult);

      // Show prediction and confidence to user
      console.log(`Verification completed - Prediction: ${verificationResult.prediction}, Confidence: ${verificationResult.confidence}%`);

      // Auto-save the result to Supabase results table
      try {
        await supabaseService.createResult({
          prediction: finalResult.match,
          confidence: finalResult.confidence,
          transcript: finalTranscript,
          target: currentTargetUserId, // Use UUID instead of name
          saved_by: user?.id
        });
        console.log('Result auto-saved to database');
      } catch (saveError) {
        console.error('Failed to save result to database:', saveError);
        // Don't fail the whole flow if saving fails
      }

      // Auto-save call to local storage
      addSavedCall({
        id: Date.now().toString(),
        name: callerName,
        timestamp: new Date().toISOString(),
        audioUri: result.uri,
        transcript: finalTranscript,
        confidence: finalResult.confidence,
        verified: finalResult.match,
      });

      setCurrentStep('result');

      // Wait 1 second then fade in both transcript and verification together
      setTimeout(() => {
        transcriptOpacity.value = withTiming(1, { 
          duration: 800,
          easing: Easing.out(Easing.quad)
        });
        resultOpacity.value = withTiming(1, { 
          duration: 800,
          easing: Easing.out(Easing.quad)
        });
      }, 1000);

      // Cleanup temporary audio files using audioUtils
      await audioUtils.cleanupTempFiles();

    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert('Error', 'Failed to verify voice. Please try again.');
      setCurrentStep('ready');
      
      // Cleanup on error using audioUtils
      await audioUtils.cleanupTempFiles();
    }
  };

  const handleStartOver = () => {
    handleResetAnimation();
    setCurrentStep('initial');
    setCallerName('');
    setNameError('');
    setVerificationResult(null);
    setCurrentTranscript('');
    setShowNameInput(false);
    setTargetUserId(null);
  };


  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['transparent', 'rgba(37, 139, 182, 0.08)', 'rgba(37, 139, 182, 0.18)', 'rgba(37, 139, 182, 0.3)']}
        locations={[0, 0.4, 0.8, 1]}
        style={styles.gradientContainer}
      >
        {/* X Button - Fixed position with animation */}
        {isAnimated && (
          <Animated.View
            style={[styles.resetButton, animatedXButtonStyle]}
          >
            <TouchableOpacity onPress={handleResetAnimation}>
              <X size={24} color="#000000" />
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.content}>
          {/* Header - Animated entrance */}
          <View style={styles.header}>
            <Animated.Text style={[styles.title, animatedTitleStyle]}>Vocera</Animated.Text>
            <Animated.Text style={[styles.subtitle, animatedSubtitleStyle]}>Authenticate with a voice</Animated.Text>
          </View>

          {/* Tap to begin text - Animated entrance */}
          <Animated.View style={[{ alignItems: 'center', marginTop: 4, marginBottom: 0 }, animatedMicTextStyle]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Mic size={20} color="#258bb6" style={{ marginRight: 8 }} />
              <Text style={styles.beginButtonText}>Tap to begin voice verification</Text>
            </View>
          </Animated.View>

          {/* Animated button container */}
          <Animated.View style={styles.buttonContainer}>
            {currentStep === 'initial' && (
              <>
                {/* Circular Logo Design - Animated entrance */}
                <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
                  <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.8}>
                    <View style={styles.circleStack}>
                      {/* Outer Circle */}
                      <Animated.View style={[styles.outerCircle, styles.absoluteCircle, animatedOuterStyle]} />

                      {/* Middle Circle */}
                      <Animated.View style={[styles.middleCircle, styles.absoluteCircle, animatedMiddleStyle]} />

                      {/* Inner Circle */}
                      <Animated.View style={[styles.innerCircle, styles.absoluteCircle, animatedInnerStyle]}>
                        <Animated.View style={[styles.waveContainer, animatedMiddleContentStyle]}>
                          <WaveAnimation isActive={currentStep === 'initial' && !isAnimated} />
                        </Animated.View>
                        <Text style={styles.logoV}>V</Text>
                      </Animated.View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              </>
            )}

            {/* Simple Name Input - appears right below the V button after transition */}
            {showNameInput && (
              <>
                {/* Always render BOTH components, control visibility with opacity only */}
                <Animated.View style={[styles.nameInputBelowButton, animatedNameInputStyle]}>
                  <TextInput
                    style={styles.nameTextInput}
                    value={callerName}
                    onChangeText={setCallerName}
                    placeholder="Enter name of caller"
                    placeholderTextColor="#999"
                    autoFocus={!nameSubmitted}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={handleNameSubmit}
                    editable={!nameSubmitted}
                    pointerEvents={nameSubmitted ? 'none' : 'auto'}
                  />
                  {nameError ? <Text style={styles.nameError}>{nameError}</Text> : null}
                </Animated.View>

                <Animated.View style={[styles.instructions, animatedInstructionsStyle]}>
                  <Text style={styles.instructionsText}>
                    Ask for {callerName || 'the caller'}'s next words to be their Vox Key phrase
                  </Text>
                  
                  {/* Recording validation text */}
                  <Animated.View style={[styles.recordingTextContainer, animatedRecordingTextStyle]}>
                    <Text style={styles.recordingText}>Recording for validation...</Text>
                  </Animated.View>
                </Animated.View>
                
                {/* Transcript - Below Vox Key instruction */}
                {currentStep === 'result' && currentTranscript && (
                  <Animated.View style={[styles.transcriptContainer, animatedTranscriptStyle]}>
                    <View style={styles.transcriptCard}>
                      <Text style={styles.transcriptLabel}>Transcript</Text>
                      <ScrollView style={styles.transcriptScrollView} showsVerticalScrollIndicator={false}>
                        <Text style={styles.transcriptText}>{currentTranscript}</Text>
                      </ScrollView>
                    </View>
                  </Animated.View>
                )}
                
                {/* Verification Result - Below transcript */}
                {currentStep === 'result' && verificationResult && (
                  <Animated.View style={[styles.resultContainer, animatedResultStyle]}>
                    <View style={styles.verificationCard}>
                      <Text style={styles.verificationLabel}>Verification Result</Text>
                      <Text style={[
                        styles.verificationStatus,
                        { color: verificationResult.match ? '#258bb6' : '#FF3B30' }
                      ]}>
                        {verificationResult.match ? 'Verified' : 'Not Verified'}
                      </Text>
                      <Text style={styles.confidenceText}>
                        Confidence: {Math.round(verificationResult.confidence)}%
                      </Text>
                      <Text style={styles.callerNameText}>{callerName}</Text>
                    </View>
                  </Animated.View>
                )}
              </>
            )}

          <Animated.View style={[styles.trustContainer, animatedTrustStyle]}>
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
    marginVertical: 20,
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
    marginTop: 40,
    paddingHorizontal: 20,
  },
  verificationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(37, 139, 182, 0.1)',
  },
  verificationLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  verificationStatus: {
    fontFamily: 'GeorgiaPro-CondBlack',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  confidenceText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  callerNameText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
  },
  simpleNameInput: {
    marginTop: 20,
    alignItems: 'center',
  },
  nameInputBelowButton: {
    marginTop: -350,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  nameTextInput: {
    backgroundColor: '#E8E8E8',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 0,
    minWidth: 280,
    textAlign: 'center',
    shadowColor: '#258bb6',      // Your blue glow
    shadowOffset: { width: 0, height: 0 },  // Even glow all around
    shadowOpacity: 0.6,          // Visible glow
    shadowRadius: 12,            // Size of glow
    elevation: 8,
  },
  nameError: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  instructions: {
    position: 'absolute',
    top: 50, // Much higher up
    left: 20,
    right: 20,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  instructionsText: {
    fontFamily: 'GeorgiaPro-CondRegular', // Changed to Georgia Pro
    fontSize: 30,
    fontWeight: '600',
    color: '#258bb6',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 16,
  },
  recordingTextContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  recordingText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    fontWeight: '500',
    color: '#FF6B6B',
    textAlign: 'center',
  },
  transcriptContainer: {
    marginTop: 500,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  transcriptCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(37, 139, 182, 0.1)',
    maxHeight: 150,
  },
  transcriptScrollView: {
    maxHeight: 120,
  },
  transcriptLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  transcriptText: {
    fontFamily: 'GeorgiaPro-CondRegular',
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    lineHeight: 24,
  },
});