import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  Alert 
} from 'react-native';
import { VoxButton } from './VoxButton';
import { useAudioRecorder, RecordingResult } from '../hooks/useAudioRecorder';
import { useVoceraStore } from '../store/voceraStore';

interface RecorderProps {
  onRecordingComplete: (result: RecordingResult) => void;
  onRecordingStart?: () => void;
  onRecordingCancel?: () => void;
  disabled?: boolean;
  maxDuration?: number; // in seconds
  style?: ViewStyle;
}

export const Recorder: React.FC<RecorderProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingCancel,
  disabled = false,
  maxDuration = 30,
  style,
}) => {
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingLevel, setRecordingLevel] = useState(0);
  
  const { 
    recording, 
    startRecording, 
    stopRecording, 
    cancelRecording,
    getRecordingLevel,
    hasPermission,
    requestPermission,
  } = useAudioRecorder();
  
  const { recordingProgress } = useVoceraStore();

  // Duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (recording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 0.1;
          
          // Auto-stop at max duration
          if (newDuration >= maxDuration) {
            handleStopRecording();
            return maxDuration;
          }
          
          return newDuration;
        });
      }, 100);
    } else {
      setRecordingDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recording, maxDuration]);

  // Recording level monitoring
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (recording) {
      interval = setInterval(async () => {
        const level = await getRecordingLevel();
        setRecordingLevel(level);
      }, 100);
    } else {
      setRecordingLevel(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recording, getRecordingLevel]);

  const handleStartRecording = async () => {
    if (!hasPermission) {
      Alert.alert(
        'Microphone Permission',
        'Please allow microphone access to record audio.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Settings', 
            onPress: () => requestPermission() 
          },
        ]
      );
      return;
    }

    const success = await startRecording();
    if (success) {
      onRecordingStart?.();
    } else {
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const handleStopRecording = async () => {
    const result = await stopRecording();
    if (result) {
      onRecordingComplete(result);
    } else {
      Alert.alert('Error', 'Failed to complete recording. Please try again.');
    }
  };

  const handleCancelRecording = async () => {
    await cancelRecording();
    onRecordingCancel?.();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const containerStyle: ViewStyle = {
    alignItems: 'center',
    padding: 20,
  };

  const levelIndicatorStyle: ViewStyle = {
    width: 200,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginVertical: 16,
    overflow: 'hidden',
  };

  const levelBarStyle: ViewStyle = {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
    width: `${Math.min(recordingLevel * 100, 100)}%`,
  };

  const durationStyle = {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#333333',
    marginBottom: 16,
  };

  const instructionStyle = {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center' as const,
    marginTop: 12,
  };

  return (
    <View style={[containerStyle, style]}>
      {!recording ? (
        <VoxButton
          title="Tap to Record"
          onPress={handleStartRecording}
          size="xl"
          disabled={disabled}
        />
      ) : (
        <>
          <VoxButton
            title="Recording..."
            onPress={handleStopRecording}
            size="xl"
            variant="danger"
          />
          
          <Text style={durationStyle}>
            {formatDuration(recordingDuration)} / {formatDuration(maxDuration)}
          </Text>
          
          {/* Audio level indicator */}
          <View style={levelIndicatorStyle}>
            <View style={levelBarStyle} />
          </View>
          
          <VoxButton
            title="Cancel"
            onPress={handleCancelRecording}
            variant="secondary"
            size="medium"
          />
        </>
      )}
      
      {!recording && (
        <Text style={instructionStyle}>
          Tap and hold to record your voice for verification
        </Text>
      )}
    </View>
  );
};
