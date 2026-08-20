import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { MaterialIcons } from '@expo/vector-icons';

export const SplashView: React.FC<{ onFinish?: () => void }> = ({ onFinish }) => {
  const { colors } = useMaterialTheme();
  const [fadeAnim] = useState(new Animated.Value(1));
  const [scaleAnim] = useState(new Animated.Value(0.92));
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    async function hideNativeSplash() {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Ignored
      }
    }
    hideNativeSplash();

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setIsDone(true);
      onFinish?.();
    });
  }, [fadeAnim, scaleAnim, onFinish]);

  if (isDone) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.container,
        {
          backgroundColor: colors.background,
          opacity: fadeAnim,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: colors.primaryContainer,
              borderColor: colors.primary,
            },
          ]}
        >
          <MaterialIcons name="storage" size={54} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.onBackground }]}>
          d-stream
        </Text>

        <Text style={[styles.subtitle, { color: colors.outline }]}>
          External Drive Media Organizer
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
