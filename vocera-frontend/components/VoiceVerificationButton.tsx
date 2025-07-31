import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Theme';
import { getFontFamily } from '../constants/FontHelper';

interface VoiceVerificationButtonProps {
  onPress: () => void;
  isAnimating?: boolean;
}

export const VoiceVerificationButton: React.FC<VoiceVerificationButtonProps> = ({
  onPress,
  isAnimating = false,
}) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const WaveRing = ({ delay = 0 }: { delay?: number }) => (
    <MotiView
      from={{
        scale: 1,
        opacity: 0.6,
      }}
      animate={{
        scale: isAnimating ? 2.5 : 1,
        opacity: isAnimating ? 0 : 0.6,
      }}
      transition={{
        type: 'timing',
        duration: 1000,
        delay,
        repeatReverse: false,
        loop: isAnimating,
      }}
      style={[styles.waveRing, { borderColor: Colors.primary }]}
    />
  );

  return (
    <View style={styles.container}>
      {/* Wave rings */}
      <WaveRing delay={0} />
      <WaveRing delay={200} />
      <WaveRing delay={400} />
      
      {/* Main button */}
      <MotiView
        from={{ scale: 1 }}
        animate={{ scale: isAnimating ? 0.85 : 1 }}
        transition={{
          type: 'timing',
          duration: 400,
        }}
        style={styles.buttonContainer}
      >
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.button,
            { transform: [{ scale: pressed ? 0.95 : 1 }] }
          ]}
        >
          <View style={styles.outerRing}>
            <View style={styles.innerRing}>
              <View style={styles.centerButton}>
                <View style={styles.logoContainer}>
                  <Text style={styles.logoText}>V</Text>
                </View>
              </View>
            </View>
          </View>
        </Pressable>
      </MotiView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
  },
  waveRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    opacity: 0.3,
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  innerRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.white,
    fontFamily: getFontFamily('logo'),
  },
});