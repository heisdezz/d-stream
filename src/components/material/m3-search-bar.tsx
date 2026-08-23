import React from 'react';
import { ViewStyle } from 'react-native';
import { DebouncedSearchBar } from '@/components/common/debounced-search-bar';

export interface M3SearchBarProps {
  value?: string;
  onSearch?: (query: string) => void;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  debounceMs?: number;
  onClear?: () => void;
  style?: ViewStyle;
  autoFocus?: boolean;
}

export const M3SearchBar: React.FC<M3SearchBarProps> = ({
  value = '',
  onSearch,
  onChangeText,
  placeholder = 'Search media...',
  debounceMs = 450,
  onClear,
  style,
  autoFocus,
}) => {
  const handleSearch = (query: string) => {
    onSearch?.(query);
    onChangeText?.(query);
  };

  return (
    <DebouncedSearchBar
      value={value}
      onSearch={handleSearch}
      placeholder={placeholder}
      debounceMs={debounceMs}
      onClear={onClear}
      style={style}
      autoFocus={autoFocus}
    />
  );
};
