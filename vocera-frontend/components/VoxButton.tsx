import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface VoxButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const VoxButton: React.FC<VoxButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const handlePress = () => {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: size === 'xl' ? 100 : 12,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    };

    // Size styles
    switch (size) {
      case 'small':
        baseStyle.paddingVertical = 8;
        baseStyle.paddingHorizontal = 16;
        baseStyle.minHeight = 36;
        break;
      case 'medium':
        baseStyle.paddingVertical = 12;
        baseStyle.paddingHorizontal = 24;
        baseStyle.minHeight = 48;
        break;
      case 'large':
        baseStyle.paddingVertical = 16;
        baseStyle.paddingHorizontal = 32;
        baseStyle.minHeight = 56;
        break;
      case 'xl':
        baseStyle.width = 200;
        baseStyle.height = 200;
        baseStyle.padding = 0;
        break;
    }

    // Variant styles
    switch (variant) {
      case 'primary':
        baseStyle.backgroundColor = disabled ? '#CCE7FF' : '#007AFF';
        break;
      case 'secondary':
        baseStyle.backgroundColor = disabled ? '#F5F5F5' : '#F0F0F0';
        baseStyle.borderWidth = 1;
        baseStyle.borderColor = disabled ? '#E0E0E0' : '#D0D0D0';
        break;
      case 'danger':
        baseStyle.backgroundColor = disabled ? '#FFE6E6' : '#FF3B30';
        break;
    }

    return baseStyle;
  };

  const getTextStyle = (): TextStyle => {
    const baseTextStyle: TextStyle = {
      fontWeight: '600',
      textAlign: 'center',
    };

    // Size text styles
    switch (size) {
      case 'small':
        baseTextStyle.fontSize = 14;
        break;
      case 'medium':
        baseTextStyle.fontSize = 16;
        break;
      case 'large':
        baseTextStyle.fontSize = 18;
        break;
      case 'xl':
        baseTextStyle.fontSize = 24;
        break;
    }

    // Variant text styles
    switch (variant) {
      case 'primary':
        baseTextStyle.color = disabled ? '#8BB5E8' : '#FFFFFF';
        break;
      case 'secondary':
        baseTextStyle.color = disabled ? '#A0A0A0' : '#333333';
        break;
      case 'danger':
        baseTextStyle.color = disabled ? '#E89999' : '#FFFFFF';
        break;
    }

    return baseTextStyle;
  };

  return (
    <Pressable 
      onPress={handlePress} 
      disabled={disabled || loading}
      style={({ pressed }) => [
        getButtonStyle(),
        {
          transform: [{ scale: pressed ? 0.95 : 1 }],
          opacity: disabled ? 0.6 : 1,
        },
        style
      ]}
    >
      <Text style={[getTextStyle(), textStyle]}>
        {loading ? '⟳' : title}
      </Text>
    </Pressable>
  );
};
