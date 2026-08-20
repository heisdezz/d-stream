import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  ViewStyle,
  Platform,
} from 'react-native';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

export interface M3ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
  count?: number;
  colorHex?: string;
  style?: ViewStyle;
}

export const M3Chip: React.FC<M3ChipProps> = ({
  label,
  selected = false,
  onPress,
  icon,
  count,
  colorHex,
  style,
}) => {
  const { colors } = useMaterialTheme();

  const containerBg = selected
    ? colorHex ? colorHex + '25' : colors.secondaryContainer
    : colors.surfaceContainerLow;

  const textColor = selected
    ? colorHex || colors.onSecondaryContainer
    : colors.onSurfaceVariant;

  const borderColor = selected
    ? colorHex || colors.secondary
    : colors.outlineVariant;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: containerBg,
          borderColor,
        },
        pressed && { opacity: Platform.OS === 'ios' ? 0.7 : 0.9 },
        style,
      ]}
      android_ripple={{
        color: (colorHex || colors.primary) + '20',
        borderless: false,
      }}
    >
      {icon && (
        <MaterialIcons
          name={icon}
          size={16}
          color={textColor}
          style={{ marginRight: Spacing.one }}
        />
      )}
      {colorHex && !icon && (
        <View
          style={[
            styles.dot,
            { backgroundColor: colorHex },
          ]}
        />
      )}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      {count !== undefined && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: selected
                ? colorHex || colors.secondary
                : colors.surfaceContainerHighest,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: selected
                  ? colors.onSecondary
                  : colors.onSurfaceVariant,
              },
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 12,
    borderRadius: Shapes.small,
    borderWidth: 1,
    marginRight: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.one,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Shapes.full,
    marginLeft: Spacing.one,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
