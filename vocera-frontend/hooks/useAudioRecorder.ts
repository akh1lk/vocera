import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useVoceraStore } from '../store/voceraStore';

export interface RecordingResult {
  uri: string;
  duration: number;
  size: number;
}

export const useAudioRecorder = () => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const { setIsRecording, setRecordingProgress } = useVoceraStore();
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio mode
  const initializeAudio = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch (error) {
      console.error('Failed to initialize audio mode:', error);
    }
  }, []);

  // Check and request permissions
  const ensurePermissions = useCallback(async (): Promise<boolean> => {
    if (permissionResponse?.status !== 'granted') {
      const permission = await requestPermission();
      return permission.status === 'granted';
    }
    return true;
  }, [permissionResponse, requestPermission]);

  // Start recording
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const hasPermission = await ensurePermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      await initializeAudio();

      const { recording: newRecording } = await Audio.Recording.createAsync(
        {
          isMeteringEnabled: true,
          android: {
            extension: '.wav',
            outputFormat: Audio.AndroidOutputFormat.DEFAULT,
            audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        }
      );

      setRecording(newRecording);
      recordingRef.current = newRecording;
      setIsRecording(true);

      // Start progress tracking
      let progress = 0;
      intervalRef.current = setInterval(() => {
        progress += 0.1;
        setRecordingProgress(Math.min(progress, 100));
      }, 100);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      return false;
    }
  }, [ensurePermissions, initializeAudio, setIsRecording, setRecordingProgress]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    try {
      if (!recordingRef.current) {
        throw new Error('No active recording');
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const duration = recordingRef.current._finalDurationMillis || 0;

      // Clean up
      setRecording(null);
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingProgress(0);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      return {
        uri,
        duration: duration / 1000, // Convert to seconds
        size: fileInfo.exists ? fileInfo.size || 0 : 0,
      };
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      setRecordingProgress(0);
      return null;
    }
  }, [setIsRecording, setRecordingProgress]);

  // Cancel recording
  const cancelRecording = useCallback(async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        
        // Delete the file
        if (uri) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    } finally {
      setRecording(null);
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingProgress(0);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [setIsRecording, setRecordingProgress]);

  // Get recording level (for visual feedback)
  const getRecordingLevel = useCallback(async (): Promise<number> => {
    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        return status.metering || 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }, []);

  return {
    recording: recording !== null,
    startRecording,
    stopRecording,
    cancelRecording,
    getRecordingLevel,
    hasPermission: permissionResponse?.status === 'granted',
    requestPermission,
  };
};
