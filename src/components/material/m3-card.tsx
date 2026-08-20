import React from 'react';
import {
  View,
  ViewStyle,
  StyleProp,
  Pressable,
  Platform,
} from 'react-native';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Elevation, Shapes, Spacing } from '@/constants/theme';

export interface M3CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'filled' | 'outlined';
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padding?: keyof typeof Spacing;
}

export const M3Card: React.FC<M3CardProps> = ({
  children,
  variant = 'filled',
  style,
  onPress,
  padding = 'three',
}) => {
  const { colors } = useMaterialTheme();

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.surfaceContainerLow,
          ...Elevation.level1,
        };
      case 'outlined':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        };
      case 'filled':
      default:
        return {
          backgroundColor: colors.surfaceContainer,
        };
    }
  };

  const cardBaseStyle: ViewStyle = {
    borderRadius: Shapes.large,
    padding: Spacing[padding],
    overflow: 'hidden',
    ...getVariantStyles(),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardBaseStyle,
          style,
          pressed && { opacity: Platform.OS === 'ios' ? 0.7 : 0.9 },
        ]}
        android_ripple={{
          color: colors.primary + '1A',
          borderless: false,
        }}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[cardBaseStyle, style]}>{children}</View>;
};
