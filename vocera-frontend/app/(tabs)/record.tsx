import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, ActivityIndicator, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { useAudioRecorderState } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { claudeAPI, ClaudePhrase } from '../../services/claudeAPI';
import { useVoceraStore } from '../../store/voceraStore';
import { supabaseService } from '../../services/supabaseService';

export default function RecordClipsScreen() {
  const totalClips = 10;
  const { user, setUser } = useVoceraStore();

  const [recordedClips, setRecordedClips] = useState<string[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5);
  const [isUploading, setIsUploading] = useState(false);
  
  // Dynamic phrase state
  const [currentPhrase, setCurrentPhrase] = useState<ClaudePhrase | null>(null);
  const [isLoadingPhrase, setIsLoadingPhrase] = useState(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 100); // Update every 100ms

  useEffect(() => {
    // Request permissions and generate phrases on mount
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission required', 'Microphone access is needed to record.');
      }
      
      // Generate one phrase for the entire session
      try {
        setIsLoadingPhrase(true);
        const phrase = await claudeAPI.generateDynamicPhrase();
        setCurrentPhrase(phrase);
      } catch (error) {
        console.error('Failed to generate phrase:', error);
        Alert.alert('Error', 'Failed to generate dynamic phrase. Using fallback.');
        // Set fallback phrase
        const fallback: ClaudePhrase = {
          passphrase: "Cheerful butterflies demolished Tuesday's melancholy expectations",
          instructions: "Say this in a cheerful tone."
        };
        setCurrentPhrase(fallback);
      } finally {
        setIsLoadingPhrase(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isRecording && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRecording) {
      handleStopRecording();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording, timeLeft]);

  const handleStartRecording = async () => {
    try {
      // Prepare with metering enabled for waveform
      await audioRecorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      audioRecorder.record();
      
      setIsRecording(true);
      setTimeLeft(5);
      scale.value = withSpring(0.9);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const handleStopRecording = async () => {
    try {
      // Stop the recording
      await audioRecorder.stop();
      
      // The uri is available on the recorder after stopping
      const uri = audioRecorder.uri;
      
      if (uri) {
        console.log('Recording saved to:', uri);
        
        // Don't add more clips if we already have 10
        if (recordedClips.length >= totalClips) {
          console.log('Already have maximum clips, ignoring additional recording');
          return;
        }
        
        const newClips = [...recordedClips, uri];
        setRecordedClips(newClips);
        setCurrentClipIndex(prev => Math.min(prev + 1, totalClips));
        
        console.log('Total clips recorded:', newClips.length);
        
        if (newClips.length >= totalClips) {
          console.log('All clips recorded, sending to backend...');
          await sendClipsToBackend(newClips, currentPhrase);
        }
      } else {
        console.error('No URI returned from recording');
        Alert.alert('Error', 'Recording failed - no file was created');
      }

      setIsRecording(false);
      setTimeLeft(5);
      scale.value = withSpring(1);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Could not stop recording.');
    }
  };

  const sendClipsToBackend = async (uris: string[], phrase: ClaudePhrase | null) => {
    if (!user) {
      Alert.alert('Error', 'User not found. Please sign in again.');
      return;
    }

    setIsUploading(true);

    try {
      // Step 1: Create vox key in Supabase
      console.log('Creating vox key for user:', user.id);
      const voxKey = await supabaseService.createVoxKey(
        user.id,
        phrase?.passphrase || 'Default passphrase',
        phrase?.instructions || 'Say this in a normal tone.'
      );
      console.log('Vox key created:', voxKey);

      // Step 2: Upload audio files to Supabase storage
      const uploadedFiles = [];
      const folderName = `vox_key_${voxKey.id}`;
      
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i];
        const fileName = `clip_${i + 1}.wav`;
        const filePath = `${folderName}/${fileName}`;
        
        try {
          // Check if file exists
          const fileInfo = await FileSystem.getInfoAsync(uri);
          if (!fileInfo.exists) {
            throw new Error(`Audio file ${fileName} does not exist`);
          }
          
          // Read file as base64 for Supabase storage
          const fileContent = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Convert base64 to array buffer for upload
          const bytes = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));
          
          // Upload to Supabase storage
          console.log(`Uploading ${fileName} to Supabase storage...`);
          const audioUrl = await supabaseService.uploadAudioFile(filePath, bytes);
          
          uploadedFiles.push({
            fileName,
            url: audioUrl,
            size: fileInfo.size
          });
          
          console.log(`Uploaded ${fileName} to: ${audioUrl} (${fileInfo.size} bytes)`);
        } catch (fileError) {
          console.error(`Error uploading file ${fileName}:`, fileError);
          throw new Error(`Failed to upload audio file ${fileName}`);
        }
      }
      
      console.log(`All ${uploadedFiles.length} files uploaded to folder: ${folderName}`);

      // Step 3: Send file URLs to your training API
      console.log('Sending', uploadedFiles.length, 'file URLs to training API for vox key:', voxKey.id);
      
      // For demo: simulate API call instead of real upload
      const USE_REAL_API = true; // Set to true when you have your training API ready
      
      let result;
      if (USE_REAL_API) {
        // TODO: Replace with your actual API endpoint
        const apiResponse = await fetch('https://vocera.herokuapp.com/calibrate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vox_key_id: voxKey.id,
            user_id: user.id,
            phrase_data: phrase,
            audio_files: uploadedFiles,
            storage_folder: folderName
          }),
        });

        if (!apiResponse.ok) {
          throw new Error(`API request failed: ${apiResponse.status}`);
        }

        result = await apiResponse.json();
      } else {
        // Simulate API response for demo
        console.log('Simulating API training with file URLs...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay
        result = {
          success: true,
          vox_key_id: voxKey.id,
          training_data_url: `https://storage.example.com/voice-models/${voxKey.id}.model`,
          message: 'Voice model trained successfully',
          files_processed: uploadedFiles.length,
          storage_folder: folderName
        };
      }
      
      console.log('Training API response:', result);

      // // Step 4: Update vox key with training data URL if provided
      // if (result.training_data_url) {
      //   await supabaseService.updateVoxKeyAudioUrl(voxKey.id, result.training_data_url);
      // }

      // Step 5: Update user state to reflect they now have a vox key
      setUser({
        ...user,
        hasVoxKey: true,
      });

      Alert.alert('Success', 'Your voice data has been submitted and your Vox Key is ready!');
      
      // Reset after successful upload
      setRecordedClips([]);
      setCurrentClipIndex(0);

    } catch (error) {
      console.error('Upload failed:', error);
      
      // More specific error handling
      if (error instanceof Error) {
        if (error.message.includes('API request failed')) {
          Alert.alert('Training Error', 'Failed to train voice model. Please try again.');
        } else if (error.message.includes('duplicate key')) {
          Alert.alert('Error', 'You already have a Vox Key. Please reset it first in Settings.');
        } else {
          Alert.alert('Error', `Failed to create Vox Key: ${error.message}`);
        }
      } else {
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['transparent', 'rgba(37, 139, 182, 0.08)', 'rgba(37, 139, 182, 0.18)', 'rgba(37, 139, 182, 0.3)']}
        locations={[0, 0.4, 0.8, 1]}
        style={styles.gradientContainer}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Voice Embedder</Text>
          </View>
        <Text style={styles.instructions}>
          Please record 10 voice clips (5 seconds each) so our model can analyze your speech.
        </Text>

        {isLoadingPhrase ? (
          <View style={styles.voxKeyContainer}>
            <ActivityIndicator size="small" color="#258bb6" />
            <Text style={styles.voxKeyLabel}>Generating your unique phrase...</Text>
          </View>
        ) : currentPhrase ? (
          <View style={styles.voxKeyContainer}>
            <Text style={styles.voxKeyLabel}>Say this phrase clearly:</Text>
            <Text style={styles.voxKeyText}>"{currentPhrase.passphrase}"</Text>
            <Text style={styles.instructionsText}>{currentPhrase.instructions}</Text>
          </View>
        ) : (
          <View style={styles.voxKeyContainer}>
            <Text style={styles.voxKeyLabel}>Loading phrase...</Text>
          </View>
        )}

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(currentClipIndex / totalClips) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {currentClipIndex} / {totalClips} clips recorded
          </Text>
        </View>


        <View style={styles.buttonContainer}>
          {isRecording && (
            <View style={styles.recordingContainer}>
              <Text style={styles.timer}>{timeLeft}s</Text>
              <View style={styles.waveformContainer}>
                {[...Array(7)].map((_, i) => {
                  const meterValue = recorderState.metering ?? -60;
                  const normalizedValue = Math.max(0, Math.min(1, (meterValue + 60) / 60));
                  const barHeight = 8 + normalizedValue * 20;
                  
                  return (
                    <Animated.View
                      key={i}
                      style={[
                        styles.waveformBar,
                        {
                          height: barHeight + (Math.random() * 10 - 5),
                          backgroundColor: normalizedValue > 0.5 ? '#258bb6' : '#5ca3c7',
                        },
                      ]}
                    />
                  );
                })}
              </View>
              <Text style={styles.recordingText}>Recording... Speak clearly!</Text>
            </View>
          )}
          
          <Pressable
            onPressIn={handleStartRecording}
            onPressOut={handleStopRecording}
            disabled={isRecording || isUploading || currentClipIndex >= totalClips || isLoadingPhrase || !currentPhrase}
            style={({ pressed }) => [
              styles.pressableContainer,
              pressed && styles.pressed,
            ]}
          >
            <Animated.View style={[styles.recordButton, animatedStyle]}>
              <View
                style={[
                  styles.innerButton,
                  isRecording && styles.innerButtonRecording,
                ]}
              />
              {isUploading && (
                <ActivityIndicator size="small" color="#fff" style={styles.uploadingIndicator} />
              )}
            </Animated.View>
          </Pressable>
        </View>

        <Text style={styles.instructionText}>
          {currentClipIndex >= totalClips 
            ? 'All clips recorded! Uploading...' 
            : 'Press and hold to record'}
        </Text>

        {currentClipIndex >= totalClips && !isUploading && (
          <Text style={styles.completeText}>✓ Upload complete!</Text>
        )}

        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f9f6f0' 
  },
  gradientContainer: {
    flex: 1,
  },
  content: { 
    flex: 1, 
    padding: 20, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 40,
  },
  title: {
    fontFamily: 'GeorgiaPro-CondBlack',
    fontSize: 40,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 18,
    color: '#333333',
    fontWeight: '500',
    textAlign: 'center',
  },
  instructions: { 
    fontSize: 16, 
    textAlign: 'center', 
    marginBottom: 30, 
    color: '#333',
    paddingHorizontal: 20,
    fontFamily: 'Inter-Regular',
    lineHeight: 24,
  },
  voxKeyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(37, 139, 182, 0.1)',
  },
  voxKeyLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  voxKeyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    lineHeight: 28,
    fontFamily: 'GeorgiaPro-CondBlack',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#258bb6',
    textAlign: 'center',
    fontFamily: 'Inter-Medium',
  },
  progressContainer: { 
    width: '100%', 
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  progressBar: { 
    height: 8, 
    backgroundColor: '#e0e0e0', 
    borderRadius: 4, 
    overflow: 'hidden', 
    marginBottom: 8 
  },
  progressFill: { 
    height: '100%', 
    backgroundColor: '#258bb6', 
    borderRadius: 4 
  },
  progressText: { 
    textAlign: 'center', 
    color: '#666',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  recordingContainer: {
    position: 'absolute',
    top: 20,
    alignItems: 'center',
    width: '100%',
  },
  timer: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#258bb6',
    fontFamily: 'GeorgiaPro-CondBlack',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 35,
    marginVertical: 8,
    gap: 3,
  },
  waveformBar: {
    width: 4,
    backgroundColor: '#258bb6',
    borderRadius: 2,
    marginHorizontal: 1,
  },
  recordingText: {
    fontSize: 14,
    color: '#258bb6',
    marginTop: 6,
    fontFamily: 'Inter-Medium',
  },
  buttonContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 240,
    marginBottom: 20,
  },
  pressableContainer: {
    position: 'absolute',
    bottom: 0,
  },
  pressed: {
    opacity: 0.8,
  },
  recordButton: {
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: '#258bb6',
    justifyContent: 'center', 
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, 
    shadowRadius: 6, 
    elevation: 6,
  },
  innerButton: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#fff' 
  },
  innerButtonRecording: { 
    backgroundColor: '#5ca3c7' 
  },
  uploadingIndicator: { 
    position: 'absolute', 
    top: '50%', 
    left: '50%',
    marginTop: -10,
    marginLeft: -10,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    fontFamily: 'Inter-Regular',
  },
  completeText: { 
    fontSize: 16, 
    color: '#258bb6', 
    marginTop: 20, 
    fontWeight: 'bold',
    fontFamily: 'Inter-SemiBold',
  },
});