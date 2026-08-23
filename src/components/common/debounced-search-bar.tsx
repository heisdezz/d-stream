import React, { useState, useEffect, useRef, useCallback } from 'react';
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

export interface DebouncedSearchBarProps {
  value?: string;
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  onClear?: () => void;
  style?: ViewStyle;
  autoFocus?: boolean;
}

export const DebouncedSearchBar: React.FC<DebouncedSearchBarProps> = ({
  value = '',
  onSearch,
  placeholder = 'Search media...',
  debounceMs = 450,
  onClear,
  style,
  autoFocus = false,
}) => {
  const { colors } = useMaterialTheme();
  const [internalText, setInternalText] = useState(value);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmittedQueryRef = useRef<string>(value);

  // Sync if external value changes
  useEffect(() => {
    if (value !== internalText && value !== lastEmittedQueryRef.current) {
      setInternalText(value);
      lastEmittedQueryRef.current = value;
    }
  }, [value]);

  const emitSearch = useCallback(
    (queryToSearch: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      lastEmittedQueryRef.current = queryToSearch;
      onSearch(queryToSearch);
    },
    [onSearch]
  );

  const handleChangeText = (text: string) => {
    setInternalText(text);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only fire debounce timer if user stops typing
    debounceTimerRef.current = setTimeout(() => {
      emitSearch(text);
    }, debounceMs);
  };

  const handleManualSearch = () => {
    emitSearch(internalText);
  };

  const handleClear = () => {
    setInternalText('');
    emitSearch('');
    onClear?.();
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
      {/* Search Button Icon (Tapping searches immediately) */}
      <Pressable
        onPress={handleManualSearch}
        hitSlop={8}
        style={({ pressed }) => [
          styles.searchIconButton,
          {
            backgroundColor: internalText.trim().length > 0 ? colors.primaryContainer : 'transparent',
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <MaterialIcons
          name="search"
          size={20}
          color={internalText.trim().length > 0 ? colors.primary : colors.onSurfaceVariant}
        />
      </Pressable>

      <TextInput
        value={internalText}
        onChangeText={handleChangeText}
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
        autoFocus={autoFocus}
        onSubmitEditing={handleManualSearch}
      />

      {internalText.length > 0 && (
        <Pressable
          onPress={handleClear}
          style={({ pressed }) => [
            styles.clearButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={10}
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
    paddingHorizontal: Spacing.one + 2,
    borderWidth: 1,
    ...Elevation.level1,
  },
  searchIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.one,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  clearButton: {
    padding: Spacing.one,
    marginRight: Spacing.one,
  },
});
