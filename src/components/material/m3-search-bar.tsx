import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  ViewStyle,
  Platform,
} from 'react-native';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Elevation, Shapes, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

export interface M3SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  style?: ViewStyle;
}

export const M3SearchBar: React.FC<M3SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search media...',
  onClear,
  style,
}) => {
  const { colors } = useMaterialTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
        },
        style,
      ]}
    >
      <MaterialIcons
        name="search"
        size={22}
        color={colors.onSurfaceVariant}
        style={styles.searchIcon}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        style={[
          styles.input,
          {
            color: colors.onSurface,
          },
        ]}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          style={styles.clearButton}
          hitSlop={8}
        >
          <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: Shapes.full,
    paddingHorizontal: Spacing.two,
    ...Elevation.level1,
  },
  searchIcon: {
    marginLeft: Spacing.one,
    marginRight: Spacing.one,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  clearButton: {
    padding: Spacing.one,
    marginRight: Spacing.one,
  },
});
