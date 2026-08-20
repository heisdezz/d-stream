import { useColorScheme } from 'react-native';
import { Material3Baseline, MaterialColorTheme } from '@/constants/theme';

let expoUseMaterialColors: any = null;
try {
  const ExpoUI = require('@expo/ui');
  if (ExpoUI && typeof ExpoUI.useMaterialColors === 'function') {
    expoUseMaterialColors = ExpoUI.useMaterialColors;
  }
} catch {
  // Graceful fallback if @expo/ui dynamic colors are unavailable
}

export function useMaterialTheme(): {
  colors: MaterialColorTheme;
  isDark: boolean;
  colorScheme: 'light' | 'dark';
} {
  const systemScheme = useColorScheme();
  const colorScheme: 'light' | 'dark' = systemScheme === 'dark' ? 'dark' : 'light';
  const isDark = colorScheme === 'dark';

  let dynamicColors: any = null;
  if (expoUseMaterialColors) {
    try {
      dynamicColors = expoUseMaterialColors({ colorScheme });
    } catch {
      // Fallback
    }
  }

  const baseline = Material3Baseline[colorScheme];

  const colors: MaterialColorTheme = {
    primary: dynamicColors?.primary ?? baseline.primary,
    onPrimary: dynamicColors?.onPrimary ?? baseline.onPrimary,
    primaryContainer: dynamicColors?.primaryContainer ?? baseline.primaryContainer,
    onPrimaryContainer: dynamicColors?.onPrimaryContainer ?? baseline.onPrimaryContainer,
    inversePrimary: dynamicColors?.inversePrimary ?? baseline.inversePrimary,
    secondary: dynamicColors?.secondary ?? baseline.secondary,
    onSecondary: dynamicColors?.onSecondary ?? baseline.onSecondary,
    secondaryContainer: dynamicColors?.secondaryContainer ?? baseline.secondaryContainer,
    onSecondaryContainer: dynamicColors?.onSecondaryContainer ?? baseline.onSecondaryContainer,
    tertiary: dynamicColors?.tertiary ?? baseline.tertiary,
    onTertiary: dynamicColors?.onTertiary ?? baseline.onTertiary,
    tertiaryContainer: dynamicColors?.tertiaryContainer ?? baseline.tertiaryContainer,
    onTertiaryContainer: dynamicColors?.onTertiaryContainer ?? baseline.onTertiaryContainer,
    background: dynamicColors?.background ?? baseline.background,
    onBackground: dynamicColors?.onBackground ?? baseline.onBackground,
    surface: dynamicColors?.surface ?? baseline.surface,
    onSurface: dynamicColors?.onSurface ?? baseline.onSurface,
    surfaceVariant: dynamicColors?.surfaceVariant ?? baseline.surfaceVariant,
    onSurfaceVariant: dynamicColors?.onSurfaceVariant ?? baseline.onSurfaceVariant,
    surfaceTint: dynamicColors?.surfaceTint ?? baseline.surfaceTint,
    inverseSurface: dynamicColors?.inverseSurface ?? baseline.inverseSurface,
    inverseOnSurface: dynamicColors?.inverseOnSurface ?? baseline.inverseOnSurface,
    error: dynamicColors?.error ?? baseline.error,
    onError: dynamicColors?.onError ?? baseline.onError,
    errorContainer: dynamicColors?.errorContainer ?? baseline.errorContainer,
    onErrorContainer: dynamicColors?.onErrorContainer ?? baseline.onErrorContainer,
    outline: dynamicColors?.outline ?? baseline.outline,
    outlineVariant: dynamicColors?.outlineVariant ?? baseline.outlineVariant,
    scrim: dynamicColors?.scrim ?? baseline.scrim,
    surfaceBright: dynamicColors?.surfaceBright ?? baseline.surfaceBright,
    surfaceDim: dynamicColors?.surfaceDim ?? baseline.surfaceDim,
    surfaceContainerLowest: dynamicColors?.surfaceContainerLowest ?? baseline.surfaceContainerLowest,
    surfaceContainerLow: dynamicColors?.surfaceContainerLow ?? baseline.surfaceContainerLow,
    surfaceContainer: dynamicColors?.surfaceContainer ?? baseline.surfaceContainer,
    surfaceContainerHigh: dynamicColors?.surfaceContainerHigh ?? baseline.surfaceContainerHigh,
    surfaceContainerHighest: dynamicColors?.surfaceContainerHighest ?? baseline.surfaceContainerHighest,
  };

  return {
    colors,
    isDark,
    colorScheme,
  };
}
