import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

export interface SegmentItem<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  badge?: number;
}

export interface M3SegmentedRowProps<T extends string> {
  items: SegmentItem<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  style?: ViewStyle;
}

export function M3SegmentedRow<T extends string>({
  items,
  selectedValue,
  onSelect,
  style,
}: M3SegmentedRowProps<T>) {
  const { colors } = useMaterialTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: colors.outlineVariant,
        },
        style,
      ]}
    >
      {items.map((item, index) => {
        const isSelected = item.value === selectedValue;
        const isFirst = index === 0;
        const isLast = index === items.length - 1;

        return (
          <Pressable
            key={item.value}
            onPress={() => onSelect(item.value)}
            style={({ pressed }) => [
              styles.segment,
              {
                backgroundColor: isSelected
                  ? colors.secondaryContainer
                  : 'transparent',
                borderTopLeftRadius: isFirst ? Shapes.full : 0,
                borderBottomLeftRadius: isFirst ? Shapes.full : 0,
                borderTopRightRadius: isLast ? Shapes.full : 0,
                borderBottomRightRadius: isLast ? Shapes.full : 0,
                borderRightWidth: !isLast ? 1 : 0,
                borderRightColor: colors.outlineVariant,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            {item.icon && (
              <MaterialIcons
                name={item.icon}
                size={16}
                color={
                  isSelected
                    ? colors.onSecondaryContainer
                    : colors.onSurfaceVariant
                }
                style={{ marginRight: Spacing.half }}
              />
            )}
            <Text
              style={[
                styles.label,
                {
                  color: isSelected
                    ? colors.onSecondaryContainer
                    : colors.onSurfaceVariant,
                  fontWeight: isSelected ? '700' : '500',
                },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {item.badge !== undefined && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isSelected
                      ? colors.secondary
                      : colors.surfaceContainerHighest,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: isSelected
                        ? colors.onSecondary
                        : colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {item.badge}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 38,
    borderRadius: Shapes.full,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 13,
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Shapes.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
