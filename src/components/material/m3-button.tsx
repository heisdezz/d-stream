import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Platform,
  View,
} from 'react-native';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Elevation, Shapes, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

export interface M3ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'fab';
  icon?: keyof typeof MaterialIcons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  size?: 'small' | 'medium' | 'large';
}

export const M3Button: React.FC<M3ButtonProps> = ({
  label,
  onPress,
  variant = 'filled',
  icon,
  loading = false,
  disabled = false,
  style,
  labelStyle,
  size = 'medium',
}) => {
  const { colors } = useMaterialTheme();

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle; iconColor: string } => {
    switch (variant) {
      case 'tonal':
        return {
          container: {
            backgroundColor: disabled ? colors.surfaceContainerHighest : colors.secondaryContainer,
          },
          text: {
            color: disabled ? colors.outline : colors.onSecondaryContainer,
          },
          iconColor: disabled ? colors.outline : colors.onSecondaryContainer,
        };
      case 'outlined':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: disabled ? colors.outlineVariant : colors.outline,
          },
          text: {
            color: disabled ? colors.outline : colors.primary,
          },
          iconColor: disabled ? colors.outline : colors.primary,
        };
      case 'text':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: {
            color: disabled ? colors.outline : colors.primary,
          },
          iconColor: disabled ? colors.outline : colors.primary,
        };
      case 'fab':
        return {
          container: {
            backgroundColor: colors.primaryContainer,
            borderRadius: Shapes.large,
            ...Elevation.level3,
          },
          text: {
            color: colors.onPrimaryContainer,
            fontWeight: '600',
          },
          iconColor: colors.onPrimaryContainer,
        };
      case 'filled':
      default:
        return {
          container: {
            backgroundColor: disabled ? colors.surfaceContainerHighest : colors.primary,
          },
          text: {
            color: disabled ? colors.outline : colors.onPrimary,
          },
          iconColor: disabled ? colors.outline : colors.onPrimary,
        };
    }
  };

  const getSizeStyles = (): { height: number; paddingHorizontal: number; fontSize: number; iconSize: number } => {
    switch (size) {
      case 'small':
        return { height: 36, paddingHorizontal: 12, fontSize: 13, iconSize: 16 };
      case 'large':
        return { height: 48, paddingHorizontal: 24, fontSize: 16, iconSize: 22 };
      case 'medium':
      default:
        return { height: 42, paddingHorizontal: 18, fontSize: 14, iconSize: 18 };
    }
  };

  const { container: vContainer, text: vText, iconColor } = getVariantStyles();
  const sizeConfig = getSizeStyles();

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.baseButton,
        {
          height: sizeConfig.height,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          borderRadius: variant === 'fab' ? Shapes.large : Shapes.full,
        },
        vContainer,
        pressed && !disabled && { opacity: Platform.OS === 'ios' ? 0.75 : 0.9 },
        disabled && { opacity: 0.6 },
        style,
      ]}
      android_ripple={{
        color: variant === 'filled' ? colors.onPrimary + '20' : colors.primary + '20',
        borderless: false,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vText.color} />
      ) : (
        <View style={styles.contentRow}>
          {icon && (
            <MaterialIcons
              name={icon}
              size={sizeConfig.iconSize}
              color={iconColor}
              style={{ marginRight: label ? Spacing.one : 0 }}
            />
          )}
          {label ? (
            <Text
              style={[
                styles.label,
                { fontSize: sizeConfig.fontSize, color: vText.color },
                labelStyle,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
