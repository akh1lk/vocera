import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, ActivityIndicator, Alert } from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { useAudioRecorderState } from 'expo-audio';

export default function RecordClipsScreen() {
  const totalClips = 10;
  const userId = 'user-123'; // Replace with real user ID

  const [recordedClips, setRecordedClips] = useState<string[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5);
  const [isUploading, setIsUploading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 100); // Update every 100ms

  useEffect(() => {
    // Request permissions on mount
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission required', 'Microphone access is needed to record.');
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
        const newClips = [...recordedClips, uri];
        setRecordedClips(newClips);
        setCurrentClipIndex(prev => prev + 1);
        
        if (newClips.length === totalClips) {
          await sendClipsToBackend(newClips);
        }
      }

      setIsRecording(false);
      setTimeLeft(5);
      scale.value = withSpring(1);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Could not stop recording.');
    }
  };

  const sendClipsToBackend = async (uris: string[]) => {
    setIsUploading(true);
    const formData = new FormData();

    uris.forEach((uri, i) => {
      formData.append('clips', {
        uri,
        name: `clip${i + 1}.wav`,
        type: 'audio/wav',
      } as any);
    });

    formData.append('userId', userId);

    try {
      const response = await fetch('https://your-api.com/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();
      console.log('Upload result:', result);
      Alert.alert('Success', 'Your voice data has been submitted!');
      
      // Reset after successful upload
      setRecordedClips([]);
      setCurrentClipIndex(0);
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert('Error', 'Failed to upload clips. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.instructions}>
          Please record 10 voice clips (5 seconds each) so our model can analyze your speech.
        </Text>

        <View style={styles.voxKeyContainer}>
          <Text style={styles.voxKeyLabel}>Say this phrase clearly:</Text>
          <Text style={styles.voxKeyText}>"The quick brown fox jumps over the lazy dog"</Text>
        </View>

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

        {isRecording && (
          <View style={styles.recordingContainer}>
            <Text style={styles.timer}>{timeLeft}s</Text>
            <View style={styles.waveformContainer}>
              {[...Array(7)].map((_, i) => {
                const meterValue = recorderState.metering ?? -60;
                const normalizedValue = Math.max(0, Math.min(1, (meterValue + 60) / 60));
                const barHeight = 10 + normalizedValue * 30;
                
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveformBar,
                      {
                        height: barHeight + (Math.random() * 10 - 5),
                        backgroundColor: normalizedValue > 0.5 ? '#ff4444' : '#ff8888',
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
          disabled={isRecording || isUploading || currentClipIndex >= totalClips}
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

        <Text style={styles.instructionText}>
          {currentClipIndex >= totalClips 
            ? 'All clips recorded! Uploading...' 
            : 'Press and hold to record'}
        </Text>

        {currentClipIndex >= totalClips && !isUploading && (
          <Text style={styles.completeText}>✓ Upload complete!</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f9f6f0' 
  },
  content: { 
    flex: 1, 
    padding: 20, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  instructions: { 
    fontSize: 18, 
    textAlign: 'center', 
    marginBottom: 20, 
    color: '#333',
    paddingHorizontal: 20,
  },
  voxKeyContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  voxKeyLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  voxKeyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    lineHeight: 28,
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
    backgroundColor: '#4CAF50', 
    borderRadius: 4 
  },
  progressText: { 
    textAlign: 'center', 
    color: '#666',
    fontSize: 14,
  },
  recordingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timer: { 
    fontSize: 48, 
    fontWeight: 'bold', 
    color: '#ff4444',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    marginVertical: 10,
    gap: 4,
  },
  waveformBar: {
    width: 6,
    backgroundColor: '#ff4444',
    borderRadius: 3,
    marginHorizontal: 2,
  },
  recordingText: {
    fontSize: 16,
    color: '#ff4444',
    marginTop: 8,
  },
  pressableContainer: {
    marginBottom: 20,
  },
  pressed: {
    opacity: 0.8,
  },
  recordButton: {
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: '#ff4444',
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
    backgroundColor: '#ff8888' 
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
  },
  completeText: { 
    fontSize: 16, 
    color: '#4CAF50', 
    marginTop: 20, 
    fontWeight: 'bold' 
  },
});