import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle 
} from 'react-native';

interface NameInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  style?: ViewStyle;
  onSubmit?: () => void;
}

export const NameInput: React.FC<NameInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Enter caller\'s full name',
  label = 'Caller Name',
  error,
  disabled = false,
  autoFocus = false,
  style,
  onSubmit,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  const containerStyle: ViewStyle = {
    marginVertical: 8,
  };

  const labelStyle: TextStyle = {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  };

  const inputContainerStyle: ViewStyle = {
    borderWidth: 2,
    borderColor: error ? '#FF3B30' : isFocused ? '#007AFF' : '#E0E0E0',
    borderRadius: 12,
    backgroundColor: disabled ? '#F5F5F5' : '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  };

  const inputStyle: TextStyle = {
    fontSize: 16,
    color: disabled ? '#A0A0A0' : '#333333',
    flex: 1,
  };

  const errorStyle: TextStyle = {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 4,
  };

  return (
    <View style={[containerStyle, style]}>
      {label && <Text style={labelStyle}>{label}</Text>}
      
      <View style={inputContainerStyle}>
        <TextInput
          style={inputStyle}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#A0A0A0"
          editable={!disabled}
          autoFocus={autoFocus}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={onSubmit}
        />
      </View>
      
      {error && (
        <Text style={errorStyle}>{error}</Text>
      )}
    </View>
  );
};
