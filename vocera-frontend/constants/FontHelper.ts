import { Typography } from './Theme';

// Helper function to get font family based on weight and type
export const getFontFamily = (
  type: 'logo' | 'body' = 'body', 
  weight: 'regular' | 'medium' | 'semibold' | 'bold' | 'italic' = 'regular'
) => {
  if (type === 'logo') {
    return Typography.fonts.logo; // Always use Georgia Condensed for logos
  }
  
  switch (weight) {
    case 'medium':
      return Typography.fonts.bodyMedium;
    case 'semibold':
      return Typography.fonts.bodySemiBold;
    case 'bold':
      return Typography.fonts.bodyBold;
    case 'italic':
      return Typography.fonts.bodyItalic;
    default:
      return Typography.fonts.body;
  }
};

// Predefined text styles for common use cases
export const textStyles = {
  // Logo styles
  logo: {
    fontFamily: Typography.fonts.logo,
    fontSize: 42,
    fontWeight: '700' as const,
  },
  logoSmall: {
    fontFamily: Typography.fonts.logo,
    fontSize: 28,
    fontWeight: '700' as const,
  },
  
  // Header styles
  header1: {
    fontFamily: Typography.fonts.logo,
    fontSize: 32,
    fontWeight: '700' as const,
  },
  header2: {
    fontFamily: Typography.fonts.logo,
    fontSize: 24,
    fontWeight: '600' as const,
  },
  header3: {
    fontFamily: Typography.fonts.logo,
    fontSize: 20,
    fontWeight: '600' as const,
  },
  
  // Body text styles
  bodyLarge: {
    fontFamily: Typography.fonts.body,
    fontSize: 18,
    fontWeight: '400' as const,
  },
  body: {
    fontFamily: Typography.fonts.body,
    fontSize: 16,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontFamily: Typography.fonts.bodyMedium,
    fontSize: 16,
    fontWeight: '500' as const,
  },
  bodySemiBold: {
    fontFamily: Typography.fonts.bodySemiBold,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  bodySmall: {
    fontFamily: Typography.fonts.body,
    fontSize: 14,
    fontWeight: '400' as const,
  },
  caption: {
    fontFamily: Typography.fonts.body,
    fontSize: 12,
    fontWeight: '400' as const,
  },
};