import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    'SpaceMono-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'),
    // Georgia Pro fonts
    'GeorgiaPro-CondBlack': require('../assets/fonts/GeorgiaPro-CondBlack.ttf'),
    'GeorgiaPro-CondRegular': require('../assets/fonts/GeorgiaPro-CondRegular.ttf'),
    'GeorgiaPro-Bold': require('../assets/fonts/GeorgiaPro-Bold.ttf'),
    'GeorgiaPro-BoldItalic': require('../assets/fonts/GeorgiaPro-BoldItalic.ttf'),
    'GeorgiaPro-Black': require('../assets/fonts/GeorgiaPro-Black.ttf'),
    // Inter fonts
    'Inter-Regular': require('../assets/fonts/Inter_28pt-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter_28pt-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter_28pt-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter_18pt-Bold.ttf'),
    'Inter-Black': require('../assets/fonts/Inter_18pt-Black.ttf'),
    'Inter-BoldItalic': require('../assets/fonts/Inter_18pt-BoldItalic.ttf'),
    'Inter-Italic': require('../assets/fonts/Inter_18pt-Italic.ttf'),
    'Inter-SemiBoldItalic': require('../assets/fonts/Inter_28pt-SemiBoldItalic.ttf'),
    // Legacy font names for compatibility
    'Inter_18pt-Black': require('../assets/fonts/Inter_18pt-Black.ttf'),
    'Inter_18pt-Bold': require('../assets/fonts/Inter_18pt-Bold.ttf'),
    'Inter_18pt-BoldItalic': require('../assets/fonts/Inter_18pt-BoldItalic.ttf'),
    'Inter_18pt-Italic': require('../assets/fonts/Inter_18pt-Italic.ttf'),
    'Inter_28pt-BoldItalic': require('../assets/fonts/Inter_28pt-BoldItalic.ttf'),
    'Inter_28pt-Medium': require('../assets/fonts/Inter_28pt-Medium.ttf'),
    'Inter_28pt-SemiBold': require('../assets/fonts/Inter_28pt-SemiBold.ttf'),
    'Inter_28pt-SemiBoldItalic': require('../assets/fonts/Inter_28pt-SemiBoldItalic.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="voxkey-wizard" 
          options={{ 
            headerShown: false,
            presentation: 'modal',
          }} 
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
