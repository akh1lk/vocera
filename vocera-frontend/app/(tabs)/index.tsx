import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import Animated, { FadeInUp, FadeIn, SlideInRight, SlideInLeft, ZoomIn } from 'react-native-reanimated';
import { VoxButton } from '../../components/VoxButton';
import { NameInput } from '../../components/NameInput';
import { InstructionsPanel } from '../../components/InstructionsPanel';
import { TranscriptView } from '../../components/TranscriptView';
import { Recorder } from '../../components/Recorder';
import { useVoceraStore } from '../../store/voceraStore';
import { voceraAPI } from '../../services/api';
import { RecordingResult } from '../../hooks/useAudioRecorder';

type VerificationStep = 'initial' | 'name-entry' | 'ready' | 'recording' | 'processing' | 'result';

export default function HomeScreen() {
  const [currentStep, setCurrentStep] = useState<VerificationStep>('initial');
  const [callerName, setCallerName] = useState('');
  const [nameError, setNameError] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    match: boolean;
    confidence: number;
    transcript: string;
  } | null>(null);

  const { 
    user, 
    currentTranscript, 
    setCurrentTranscript,
    addSavedCall 
  } = useVoceraStore();

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
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.delay(100)} style={styles.header}>
          <Text style={styles.title}>Vocera</Text>
          <Text style={styles.subtitle}>Voice Verification</Text>
        </Animated.View>

        <InstructionsPanel
          callerFirstName={callerName ? getFirstName(callerName) : undefined}
          step={getInstructionStep()}
        />

        {currentStep === 'initial' && (
          <Animated.View entering={ZoomIn.delay(200)} style={styles.mainButton}>
            <VoxButton
              title="Tap to Verify"
              onPress={handleStartVerification}
              size="xl"
            />
          </Animated.View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666666',
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
});
