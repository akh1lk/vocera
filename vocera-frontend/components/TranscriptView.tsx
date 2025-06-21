import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  ViewStyle, 
  TextStyle 
} from 'react-native';

interface TranscriptViewProps {
  transcript: string;
  isLive?: boolean;
  confidence?: number;
  style?: ViewStyle;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  transcript,
  isLive = false,
  confidence,
  style,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when transcript updates
  useEffect(() => {
    if (transcript && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [transcript]);

  const containerStyle: ViewStyle = {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    maxHeight: 200,
    marginVertical: 16,
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  };

  const titleStyle: TextStyle = {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  };

  const liveIndicatorStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
  };

  const liveDotStyle: ViewStyle = {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 6,
  };

  const liveTextStyle: TextStyle = {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '500',
  };

  const confidenceStyle: TextStyle = {
    fontSize: 12,
    color: '#8E8E93',
  };

  const transcriptTextStyle: TextStyle = {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
    minHeight: 60,
  };

  const placeholderStyle: TextStyle = {
    ...transcriptTextStyle,
    color: '#8E8E93',
    fontStyle: 'italic',
  };

  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.8) return '#34C759';
    if (conf >= 0.6) return '#FF9500';
    return '#FF3B30';
  };

  return (
    <View style={[containerStyle, style]}>
      <View style={headerStyle}>
        <Text style={titleStyle}>Live Transcript</Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {typeof confidence === 'number' && (
            <Text style={[confidenceStyle, { color: getConfidenceColor(confidence) }]}>
              {Math.round(confidence * 100)}%
            </Text>
          )}
          
          {isLive && (
            <View style={liveIndicatorStyle}>
              <View style={liveDotStyle} />
              <Text style={liveTextStyle}>LIVE</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {transcript ? (
          <Text style={transcriptTextStyle}>{transcript}</Text>
        ) : (
          <Text style={placeholderStyle}>
            {isLive ? 'Listening...' : 'No transcript available'}
          </Text>
        )}
        
        {isLive && transcript && (
          <View
            style={{
              width: 2,
              height: 20,
              backgroundColor: '#FFFFFF',
              marginLeft: 2,
              marginTop: 4,
              opacity: 0.8,
            }}
          />
        )}
      </ScrollView>
    </View>
  );
};
