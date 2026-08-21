import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { M3Card } from './m3-card';

export interface M3StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  variant?: 'primary' | 'secondary' | 'tertiary';
  style?: ViewStyle;
  onPress?: () => void;
}

export const M3StatCard: React.FC<M3StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'primary',
  style,
  onPress,
}) => {
  const { colors } = useMaterialTheme();

  const getAccentColors = () => {
    switch (variant) {
      case 'secondary':
        return {
          iconBg: colors.secondaryContainer,
          iconColor: colors.onSecondaryContainer,
          valueColor: colors.onSurface,
        };
      case 'tertiary':
        return {
          iconBg: colors.tertiaryContainer,
          iconColor: colors.onTertiaryContainer,
          valueColor: colors.onSurface,
        };
      case 'primary':
      default:
        return {
          iconBg: colors.primaryContainer,
          iconColor: colors.onPrimaryContainer,
          valueColor: colors.onSurface,
        };
    }
  };

  const { iconBg, iconColor, valueColor } = getAccentColors();

  return (
    <M3Card
      variant="filled"
      onPress={onPress}
      style={[{ flex: 1, minWidth: 140 }, style]}
      padding="three"
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon} size={22} color={iconColor} />
        </View>
        <Text style={[styles.title, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>

      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </M3Card>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Shapes.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
    flex: 1,
  },
  value: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
