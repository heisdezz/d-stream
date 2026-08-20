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
      padding="two"
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon} size={20} color={iconColor} />
        </View>
        <Text style={[styles.title, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>

      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.outline }]} numberOfLines={1}>
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
    marginBottom: Spacing.one,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.one,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: Spacing.half,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
