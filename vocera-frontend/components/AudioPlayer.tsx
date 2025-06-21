import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ViewStyle, 
  Alert 
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

interface AudioPlayerProps {
  audioUri: string;
  title?: string;
  duration?: number;
  onDelete?: () => void;
  style?: ViewStyle;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUri,
  title,
  duration,
  onDelete,
  style,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const positionInterval = useRef<NodeJS.Timeout | null>(null);

  const initializeAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Failed to initialize audio mode:', error);
    }
  };

  const startPositionTracking = () => {
    positionInterval.current = setInterval(async () => {
      if (soundRef.current) {
        try {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            setCurrentPosition(status.positionMillis / 1000);
            
            if (status.didJustFinish) {
              handlePlaybackFinished();
            }
          }
        } catch (error) {
          console.error('Error getting playback status:', error);
        }
      }
    }, 100);
  };

  const stopPositionTracking = () => {
    if (positionInterval.current) {
      clearInterval(positionInterval.current);
      positionInterval.current = null;
    }
  };

  const handlePlayPause = async () => {
    try {
      setIsLoading(true);
      await initializeAudio();

      if (!soundRef.current) {
        // Load audio
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: false }
        );
        
        soundRef.current = sound;
        
        // Get duration
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          setTotalDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
        }
      }

      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        stopPositionTracking();
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        startPositionTracking();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaybackFinished = async () => {
    setIsPlaying(false);
    setCurrentPosition(0);
    stopPositionTracking();
    
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(0);
    }
  };

  const handleStop = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.setPositionAsync(0);
      }
      setIsPlaying(false);
      setCurrentPosition(0);
      stopPositionTracking();
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await handleStop();
            if (soundRef.current) {
              await soundRef.current.unloadAsync();
              soundRef.current = null;
            }
            onDelete?.();
          }
        },
      ]
    );
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const containerStyle: ViewStyle = {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  };

  const titleStyle = {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#333333',
    flex: 1,
  };

  const controlsStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const playButtonStyle: ViewStyle = {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    transform: [{ scale: isLoading ? 0.8 : 1 }],
  };

  const progressContainerStyle: ViewStyle = {
    flex: 1,
    marginRight: 12,
  };

  const progressBarStyle: ViewStyle = {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  };

  const progressFillStyle: ViewStyle = {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
    width: `${totalDuration > 0 ? (currentPosition / totalDuration) * 100 : 0}%`,
  };

  const timeStyle = {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  };

  return (
    <View style={[containerStyle, style]}>
      {title && (
        <View style={headerStyle}>
          <Text style={titleStyle} numberOfLines={1}>
            {title}
          </Text>
          {onDelete && (
            <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>
      )}
      
      <View style={controlsStyle}>
        <TouchableOpacity 
          style={playButtonStyle}
          onPress={handlePlayPause}
          disabled={isLoading}
        >
          <Ionicons 
            name={isPlaying ? 'pause' : 'play'} 
            size={20} 
            color="#FFFFFF" 
          />
        </TouchableOpacity>
        
        <View style={progressContainerStyle}>
          <View style={progressBarStyle}>
            <View style={progressFillStyle} />
          </View>
          <Text style={timeStyle}>
            {formatTime(currentPosition)} / {formatTime(totalDuration)}
          </Text>
        </View>
        
        {isPlaying && (
          <TouchableOpacity onPress={handleStop} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="stop" size={24} color="#666666" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
