import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle 
} from 'react-native';

interface InstructionsPanelProps {
  callerFirstName?: string;
  step?: 'waiting' | 'ready' | 'recording' | 'processing' | 'complete';
  customMessage?: string;
  style?: ViewStyle;
}

export const InstructionsPanel: React.FC<InstructionsPanelProps> = ({
  callerFirstName,
  step = 'waiting',
  customMessage,
  style,
}) => {
  const getInstructionText = (): string => {
    if (customMessage) return customMessage;
    
    switch (step) {
      case 'waiting':
        return 'Enter the caller\'s name to begin verification';
      case 'ready':
        return callerFirstName 
          ? `Ask ${callerFirstName} to say their Vox Key`
          : 'Ask the caller to say their Vox Key';
      case 'recording':
        return 'Recording... Listen carefully';
      case 'processing':
        return 'Analyzing voice pattern...';
      case 'complete':
        return 'Verification complete';
      default:
        return 'Ready to verify';
    }
  };

  const getIconForStep = (): string => {
    switch (step) {
      case 'waiting':
        return '👤';
      case 'ready':
        return '🎤';
      case 'recording':
        return '🔴';
      case 'processing':
        return '⚡';
      case 'complete':
        return '✅';
      default:
        return '🎤';
    }
  };

  const containerStyle: ViewStyle = {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  };

  const headerStyle: TextStyle = {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  };

  const instructionStyle: TextStyle = {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  };

  const iconStyle: TextStyle = {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 12,
  };

  return (
    <View style={[containerStyle, style]}>
      <Text style={iconStyle}>{getIconForStep()}</Text>
      <Text style={headerStyle}>Voice Verification</Text>
      <Text style={instructionStyle}>{getInstructionText()}</Text>
      
      {step === 'recording' && (
        <View
          style={{
            width: 100,
            height: 4,
            backgroundColor: '#FF3B30',
            borderRadius: 2,
            alignSelf: 'center',
            marginTop: 16,
            opacity: 0.8,
          }}
        />
      )}
    </View>
  );
};
