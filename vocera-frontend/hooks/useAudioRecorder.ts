import { useState, useRef, useCallback } from 'react';
import { AudioModule, useAudioRecorder as useExpoAudioRecorder, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { useVoceraStore } from '../store/voceraStore';

export interface RecordingResult {
  uri: string;
  duration: number;
  size: number;
}

export const useAudioRecorder = () => {
  const [isRecording, setIsRecordingState] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const { setIsRecording, setRecordingProgress } = useVoceraStore();
  
  const audioRecorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Check permissions on mount
  const checkPermissions = useCallback(async () => {
    const permission = await AudioModule.getRecordingPermissionsAsync();
    setPermissionGranted(permission.granted);
    return permission.granted;
  }, []);

  // Request permissions
  const requestPermission = useCallback(async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    setPermissionGranted(permission.granted);
    return permission;
  }, []);

  // Ensure permissions
  const ensurePermissions = useCallback(async (): Promise<boolean> => {
    const hasPermission = await checkPermissions();
    if (!hasPermission) {
      const permission = await requestPermission();
      return permission.granted;
    }
    return true;
  }, [checkPermissions, requestPermission]);

  // Start recording
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const hasPermission = await ensurePermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      // Prepare with metering enabled
      await audioRecorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      
      audioRecorder.record();
      
      setIsRecordingState(true);
      setIsRecording(true);
      startTimeRef.current = Date.now();

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
  }, [ensurePermissions, audioRecorder, setIsRecording, setRecordingProgress]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    try {
      if (!isRecording || !audioRecorder.isRecording) {
        throw new Error('No active recording');
      }

      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      
      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      // Calculate duration
      const duration = (Date.now() - startTimeRef.current) / 1000;

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);

      // Clean up
      setIsRecordingState(false);
      setIsRecording(false);
      setRecordingProgress(0);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      return {
        uri,
        duration,
        size: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0,
      };
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      setRecordingProgress(0);
      return null;
    }
  }, [isRecording, audioRecorder, setIsRecording, setRecordingProgress]);

  // Cancel recording
  const cancelRecording = useCallback(async () => {
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        
        // Delete the file
        if (uri) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    } finally {
      setIsRecordingState(false);
      setIsRecording(false);
      setRecordingProgress(0);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [audioRecorder, setIsRecording, setRecordingProgress]);

  // Get recording level (for visual feedback)
  const getRecordingLevel = useCallback(async (): Promise<number> => {
    // With expo-audio, we would use the useAudioRecorderState hook for real-time metering
    // For now, return a placeholder value
    return 0;
  }, []);

  return {
    recording: isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
    getRecordingLevel,
    hasPermission: permissionGranted,
    requestPermission,
  };
};