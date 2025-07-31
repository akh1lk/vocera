export const Colors = {
  // Brand Colors
  primary: '#258bb6',
  background: '#f9f6f0',
  
  // Neutral Colors
  black: '#000000',
  white: '#FFFFFF',
  gray: {
    50: '#F8F9FA',
    100: '#E8E8E8',
    200: '#D0D0D0',
    300: '#B8B8B8',
    400: '#A0A0A0',
    500: '#666666',
    600: '#4A4A4A',
    700: '#333333',
    800: '#1A1A1A',
    900: '#0D0D0D',
  },
  
  // Semantic Colors
  success: '#D4F4DD',
  error: '#FFE6E6',
  warning: '#FFF3CD',
  
  // Component Colors
  button: {
    primary: '#258bb6',
    secondary: '#F0F0F0',
    danger: '#FF3B30',
  },
  
  // Legacy (keeping for compatibility)
  blue: '#258bb6',
  lightGray: '#F0F0F0',
};

export const Typography = {
  fonts: {
    // Georgia Pro fonts for logos and headers
    logo: 'GeorgiaPro-CondBlack', // Georgia Pro Condensed Black for main logo
    logoBold: 'GeorgiaPro-Bold',
    
    // Inter fonts for body text
    body: 'Inter-Regular', // Regular weight for body text
    bodyMedium: 'Inter-Medium',
    bodySemiBold: 'Inter-SemiBold', 
    bodyBold: 'Inter-Bold',
    bodyItalic: 'Inter-Italic',
    mono: 'SpaceMono-Regular',
    
    // Legacy names for compatibility
    'Inter_28pt-Medium': 'Inter-Medium',
    'Inter_28pt-SemiBold': 'Inter-SemiBold',
    'Inter_18pt-Bold': 'Inter-Bold',
  },
  
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
    '7xl': 72,
  },
  
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
  '4xl': 80,
};

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
};