import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  BackHandler,
} from 'react-native';
import { router } from 'expo-router';
import { VoxButton } from '../components/VoxButton';
import { Recorder } from '../components/Recorder';
import { NameInput } from '../components/NameInput';
import { useVoceraStore } from '../store/voceraStore';
import { voceraAPI } from '../services/api';
import { RecordingResult } from '../hooks/useAudioRecorder';

export default function VoxKeyWizardScreen() {
  const [currentStep, setCurrentStep] = useState(0); // 0 = intro, 1-10 = recording steps, 11 = complete
  const [userName, setUserName] = useState('');
  const [nameError, setNameError] = useState('');
  const [recordings, setRecordings] = useState<RecordingResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const { setUser, setVoxKeyProgress } = useVoceraStore();

  // Prevent back navigation during wizard
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentStep > 0) {
        handleBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [currentStep]);

  const handleNameSubmit = () => {
    const trimmedName = userName.trim();
    
    if (!trimmedName) {
      setNameError('Please enter your full name');
      return;
    }
    
    if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    
    setNameError('');
    setCurrentStep(1);
  };

  const handleRecordingComplete = (result: RecordingResult) => {
    const newRecordings = [...recordings, result];
    setRecordings(newRecordings);
    setVoxKeyProgress(newRecordings.length);
    
    if (newRecordings.length === 10) {
      // All recordings complete, upload to server
      uploadVoxKey(newRecordings);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const uploadVoxKey = async (allRecordings: RecordingResult[]) => {
    setIsUploading(true);
    setCurrentStep(11); // Show completion step
    
    try {
      const audioFiles = allRecordings.map((recording, index) => ({
        uri: recording.uri,
        name: `voxkey_sample_${index}.wav`,
        type: 'audio/wav',
      }));

      const response = await voceraAPI.createVoxKey(audioFiles, userName);
      
      if (response.success) {
        // Update user state
        setUser({
          id: response.userId || Date.now().toString(),
          hasVoxKey: true,
          lastUpdated: new Date().toISOString(),
          autoResetAfterVerification: false,
        });
        
        setVoxKeyProgress(10);
        
        Alert.alert(
          'Success!',
          'Your Vox Key has been created successfully. You can now verify callers using voice recognition.',
          [
            {
              text: 'Get Started',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      } else {
        throw new Error(response.message || 'Failed to create Vox Key');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert(
        'Upload Failed',
        'Failed to create your Vox Key. Please try again.',
        [
          {
            text: 'Retry',
            onPress: () => {
              setIsUploading(false);
              setCurrentStep(10); // Go back to last recording
            },
          },
          {
            text: 'Start Over',
            onPress: handleStartOver,
          },
        ]
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      router.back();
    } else if (currentStep === 1) {
      setCurrentStep(0);
    } else if (currentStep <= 10) {
      setCurrentStep(currentStep - 1);
      // Remove last recording
      const newRecordings = recordings.slice(0, -1);
      setRecordings(newRecordings);
      setVoxKeyProgress(newRecordings.length);
    }
  };

  const handleStartOver = () => {
    Alert.alert(
      'Start Over',
      'Are you sure you want to start over? This will delete all your current recordings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Over',
          style: 'destructive',
          onPress: () => {
            setCurrentStep(0);
            setRecordings([]);
            setUserName('');
            setNameError('');
            setVoxKeyProgress(0);
          },
        },
      ]
    );
  };

  const getStepTitle = (): string => {
    if (currentStep === 0) return 'Create Your Vox Key';
    if (currentStep <= 10) return `Recording ${currentStep} of 10`;
    return 'Creating Vox Key...';
  };

  const getStepDescription = (): string => {
    if (currentStep === 0) {
      return 'Your Vox Key is a unique voice profile that allows secure caller verification. We\'ll need 10 voice samples to create it.';
    }
    if (currentStep <= 10) {
      return 'Please say the following phrase clearly and naturally:';
    }
    return 'Processing your voice samples and creating your secure Vox Key...';
  };

  const getRecordingPhrase = (): string => {
    const phrases = [
      'My voice is my password, verify me.',
      'Voice authentication is the future of security.',
      'This is my unique voice signature.',
      'I am who I say I am through my voice.',
      'Vocal patterns are as unique as fingerprints.',
      'My speech characteristics identify me.',
      'Voice biometrics provide secure access.',
      'This recording creates my voice profile.',
      'Acoustic features define my identity.',
      'My voice is the key to verification.',
    ];
    return phrases[(currentStep - 1) % phrases.length];
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{getStepTitle()}</Text>
        {currentStep > 0 && currentStep <= 10 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(recordings.length / 10) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {recordings.length} / 10 complete
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>{getStepDescription()}</Text>

        {currentStep === 0 && (
          <View style={styles.nameInputContainer}>
            <NameInput
              value={userName}
              onChangeText={setUserName}
              label="Your Full Name"
              placeholder="Enter your full name"
              error={nameError}
              autoFocus
              onSubmit={handleNameSubmit}
            />
            <VoxButton
              title="Start Recording"
              onPress={handleNameSubmit}
              size="large"
              style={styles.actionButton}
            />
          </View>
        )}

        {currentStep >= 1 && currentStep <= 10 && (
          <View style={styles.recordingContainer}>
            <View style={styles.phraseContainer}>
              <Text style={styles.phraseLabel}>Say this phrase:</Text>
              <Text style={styles.phraseText}>{getRecordingPhrase()}</Text>
            </View>
            
            <Recorder
              onRecordingComplete={handleRecordingComplete}
              maxDuration={15}
            />
            
            <Text style={styles.recordingTip}>
              Speak clearly and naturally. Each recording should be 3-10 seconds long.
            </Text>
          </View>
        )}

        {currentStep === 11 && (
          <View style={styles.completionContainer}>
            <Text style={styles.completionIcon}>🎤</Text>
            <Text style={styles.completionTitle}>
              {isUploading ? 'Creating Your Vox Key...' : 'Almost Done!'}
            </Text>
            <VoxButton
              title={isUploading ? 'Processing...' : 'Complete'}
              onPress={() => {}}
              size="xl"
              loading={isUploading}
              disabled={isUploading}
            />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {currentStep > 0 && currentStep <= 10 && (
          <View style={styles.buttonRow}>
            <VoxButton
              title="Back"
              onPress={handleBack}
              variant="secondary"
              size="medium"
              style={styles.backButton}
            />
            <VoxButton
              title="Start Over"
              onPress={handleStartOver}
              variant="danger"
              size="medium"
              style={styles.startOverButton}
            />
          </View>
        )}
        
        {currentStep === 0 && (
          <VoxButton
            title="Cancel"
            onPress={() => router.back()}
            variant="secondary"
            size="medium"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f6f0',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontFamily: 'GeorgiaPro-CondBlack',
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666666',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  nameInputContainer: {
    alignItems: 'center',
  },
  actionButton: {
    marginTop: 24,
    minWidth: 200,
  },
  recordingContainer: {
    alignItems: 'center',
  },
  phraseContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: '100%',
  },
  phraseLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  phraseText: {
    fontFamily: 'GeorgiaPro-CondBlack',
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    lineHeight: 28,
  },
  recordingTip: {
    fontFamily: 'Inter-Italic',
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  completionContainer: {
    alignItems: 'center',
  },
  completionIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  completionTitle: {
    fontFamily: 'GeorgiaPro-CondBlack',
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 32,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  startOverButton: {
    flex: 1,
  },
});
