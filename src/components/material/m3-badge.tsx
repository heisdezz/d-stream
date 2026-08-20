import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing } from '@/constants/theme';

export interface M3BadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'surface';
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'small' | 'medium';
}

export const M3Badge: React.FC<M3BadgeProps> = ({
  label,
  variant = 'secondary',
  style,
  textStyle,
  size = 'medium',
}) => {
  const { colors } = useMaterialTheme();

  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return { bg: colors.primaryContainer, text: colors.onPrimaryContainer };
      case 'tertiary':
        return { bg: colors.tertiaryContainer, text: colors.onTertiaryContainer };
      case 'error':
        return { bg: colors.errorContainer, text: colors.onErrorContainer };
      case 'surface':
        return { bg: colors.surfaceContainerHighest, text: colors.onSurfaceVariant };
      case 'secondary':
      default:
        return { bg: colors.secondaryContainer, text: colors.onSecondaryContainer };
    }
  };

  const { bg, text } = getVariantColors();
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingHorizontal: isSmall ? 6 : 8,
          paddingVertical: isSmall ? 1 : 3,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: text,
            fontSize: isSmall ? 10 : 12,
          },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: Shapes.full,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
