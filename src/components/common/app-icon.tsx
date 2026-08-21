import React from 'react';
import { Platform } from 'react-native';
import { SymbolView, SymbolViewProps, SFSymbol } from 'expo-symbols';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

export interface AppIconProps {
  name: keyof typeof MaterialIcons.glyphMap | keyof typeof Ionicons.glyphMap;
  symbolName?: SFSymbol;
  size?: number;
  color?: any;
}

const MATERIAL_TO_SYMBOL: Record<string, SFSymbol> = {
  dashboard: 'house.fill',
  'dashboard-customize': 'house',
  'perm-media': 'photo.stack.fill',
  'photo-library': 'photo.stack',
  'collections-bookmark': 'folder.fill.badge.plus',
  'folder-special': 'folder',
  sync: 'arrow.triangle.2.circlepath',
  settings: 'gearshape.fill',
  storage: 'internaldrive.fill',
  image: 'photo.fill',
  videocam: 'video.fill',
};

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  symbolName,
  size = 24,
  color,
}) => {
  const symbol = symbolName || MATERIAL_TO_SYMBOL[name as string];

  if (Platform.OS === 'ios' && symbol) {
    try {
      return (
        <SymbolView
          name={symbol}
          size={size}
          tintColor={color}
          weight="medium"
        />
      );
    } catch {
      // Fallback
    }
  }

  // Check if name is in MaterialIcons
  if (name in MaterialIcons.glyphMap) {
    return (
      <MaterialIcons
        name={name as keyof typeof MaterialIcons.glyphMap}
        size={size}
        color={color}
      />
    );
  }

  // Fallback to Ionicons
  return (
    <Ionicons
      name={name as keyof typeof Ionicons.glyphMap}
      size={size}
      color={color}
    />
  );
};
