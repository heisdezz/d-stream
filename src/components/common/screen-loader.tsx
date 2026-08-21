import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  DimensionValue,
} from 'react-native';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

export interface ScreenLoaderProps {
  message?: string;
  subMessage?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  minHeight?: DimensionValue;
}

export const ScreenLoader: React.FC<ScreenLoaderProps> = ({
  message = 'Loading media library...',
  subMessage = 'Retrieving cached items from local SQLite',
  icon = 'perm-media',
  minHeight = 320,
}) => {
  const { colors } = useMaterialTheme();
  const pulseAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.95,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.4,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim, opacityAnim]);

  return (
    <View style={[styles.container, { minHeight }]}>
      <Animated.View
        style={[
          styles.iconRing,
          {
            backgroundColor: colors.primaryContainer,
            borderColor: colors.primary,
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <MaterialIcons name={icon} size={36} color={colors.primary} />
      </Animated.View>

      <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: Spacing.three }} />

      <Text style={[styles.title, { color: colors.onSurface }]}>{message}</Text>
      {subMessage && (
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
          {subMessage}
        </Text>
      )}
    </View>
  );
};

export const ScreenTransition: React.FC<{
  children: React.ReactNode;
  visible: boolean;
  duration?: number;
}> = ({ children, visible, duration = 250 }) => {
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start();
  }, [visible, duration, fadeAnim]);

  if (!visible) return null;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  iconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
