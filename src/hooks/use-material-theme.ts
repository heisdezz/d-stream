import { useMemo } from "react";
import { useColorScheme } from "react-native";
import {
  useMaterialColors,
  isDynamicColorAvailable as expoUiIsDynamicAvailable,
  MaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  useMaterial3Theme,
  createMaterial3Theme,
} from "@pchmn/expo-material3-theme";
import { Material3Baseline, MaterialColorTheme } from "@/constants/theme";
import { useAppStore } from "@/store/use-app-store";
import { ThemeMode } from "@/services/storage";

export interface ThemeAccentOption {
  id: string;
  name: string;
  color: string;
  isSystem?: boolean;
}

export const THEME_ACCENT_PRESETS: ThemeAccentOption[] = [
  {
    id: "system",
    name: "Material You (Wallpaper)",
    color: "#2563EB",
    isSystem: true,
  },
  { id: "#0B57D0", name: "Google Pixel Blue", color: "#0B57D0" },
  { id: "#006D44", name: "Emerald Forest", color: "#006D44" },
  { id: "#9C4323", name: "Sunset Terracotta", color: "#9C4323" },
  { id: "#6750A4", name: "Vibrant Violet", color: "#6750A4" },
  { id: "#006A6A", name: "Ocean Cyan", color: "#006A6A" },
  { id: "#984061", name: "Dusty Berry", color: "#984061" },
  { id: "#B06000", name: "Warm Amber", color: "#B06000" },
];

export function useMaterialTheme(): {
  colors: MaterialColorTheme;
  isDark: boolean;
  colorScheme: "light" | "dark";
  themeAccent: string;
  themeMode: ThemeMode;
  isDynamicSupported: boolean;
  setThemeAccent: (accent: string) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
} {
  const systemScheme = useColorScheme();
  const themeAccent = useAppStore((state) => state.themeAccent);
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeAccent = useAppStore((state) => state.setThemeAccent);
  const setThemeMode = useAppStore((state) => state.setThemeMode);

  // 1. Resolve Active Color Scheme (Light vs Dark)
  const colorScheme: "light" | "dark" =
    themeMode === "light"
      ? "light"
      : themeMode === "dark"
        ? "dark"
        : systemScheme === "dark"
          ? "dark"
          : "light";

  const isDark = colorScheme === "dark";

  // 2. Primary: Obtain Dynamic Material 3 Colors from @expo/ui (Jetpack Compose engine)
  let expoUiPalette: MaterialColors | null = null;
  let isDynamicSupported = false;

  try {
    isDynamicSupported = expoUiIsDynamicAvailable ?? false;
    expoUiPalette = useMaterialColors({
      colorScheme,
      seedColor: themeAccent === "system" ? undefined : themeAccent,
    });
  } catch {
    // Graceful fallback for non-native / build-time environments
    expoUiPalette = null;
  }

  // 3. Fallback theme provider (@pchmn/expo-material3-theme)
  const { theme: fallbackTheme } = useMaterial3Theme({
    fallbackSourceColor: "#0B57D0",
  });

  const activePalette: Partial<MaterialColorTheme> | null = useMemo(() => {
    if (expoUiPalette && expoUiPalette.primary) {
      return expoUiPalette as unknown as Partial<MaterialColorTheme>;
    }
    try {
      if (themeAccent === "system") {
        return (isDark
          ? fallbackTheme.dark
          : fallbackTheme.light) as unknown as Partial<MaterialColorTheme>;
      } else if (themeAccent && themeAccent.startsWith("#")) {
        const custom = createMaterial3Theme(themeAccent);
        return (isDark
          ? custom.dark
          : custom.light) as unknown as Partial<MaterialColorTheme>;
      }
    } catch {
      // Fallback below
    }
    return null;
  }, [expoUiPalette, themeAccent, isDark, fallbackTheme]);

  const baseline = Material3Baseline[colorScheme];

  // 4. Construct complete MaterialColorTheme with tonal elevation surfaces
  const colors: MaterialColorTheme = {
    primary: activePalette?.primary ?? baseline.primary,
    onPrimary: activePalette?.onPrimary ?? baseline.onPrimary,
    primaryContainer:
      activePalette?.primaryContainer ?? baseline.primaryContainer,
    onPrimaryContainer:
      activePalette?.onPrimaryContainer ?? baseline.onPrimaryContainer,
    inversePrimary: activePalette?.inversePrimary ?? baseline.inversePrimary,

    secondary: activePalette?.secondary ?? baseline.secondary,
    onSecondary: activePalette?.onSecondary ?? baseline.onSecondary,
    secondaryContainer:
      activePalette?.secondaryContainer ?? baseline.secondaryContainer,
    onSecondaryContainer:
      activePalette?.onSecondaryContainer ?? baseline.onSecondaryContainer,

    tertiary: activePalette?.tertiary ?? baseline.tertiary,
    onTertiary: activePalette?.onTertiary ?? baseline.onTertiary,
    tertiaryContainer:
      activePalette?.tertiaryContainer ?? baseline.tertiaryContainer,
    onTertiaryContainer:
      activePalette?.onTertiaryContainer ?? baseline.onTertiaryContainer,

    background: activePalette?.background ?? baseline.background,
    onBackground: activePalette?.onBackground ?? baseline.onBackground,

    surface: activePalette?.surface ?? baseline.surface,
    onSurface: activePalette?.onSurface ?? baseline.onSurface,
    surfaceVariant: activePalette?.surfaceVariant ?? baseline.surfaceVariant,
    onSurfaceVariant:
      activePalette?.onSurfaceVariant ?? baseline.onSurfaceVariant,
    surfaceTint:
      activePalette?.surfaceTint ??
      activePalette?.primary ??
      baseline.surfaceTint,

    inverseSurface: activePalette?.inverseSurface ?? baseline.inverseSurface,
    inverseOnSurface:
      activePalette?.inverseOnSurface ?? baseline.inverseOnSurface,

    error: activePalette?.error ?? baseline.error,
    onError: activePalette?.onError ?? baseline.onError,
    errorContainer: activePalette?.errorContainer ?? baseline.errorContainer,
    onErrorContainer:
      activePalette?.onErrorContainer ?? baseline.onErrorContainer,

    outline: activePalette?.outline ?? baseline.outline,
    outlineVariant: activePalette?.outlineVariant ?? baseline.outlineVariant,
    scrim: activePalette?.scrim ?? baseline.scrim,

    surfaceBright: activePalette?.surfaceBright ?? baseline.surfaceBright,
    surfaceDim: activePalette?.surfaceDim ?? baseline.surfaceDim,

    surfaceContainerLowest:
      activePalette?.surfaceContainerLowest ?? baseline.surfaceContainerLowest,
    surfaceContainerLow:
      activePalette?.surfaceContainerLow ?? baseline.surfaceContainerLow,
    surfaceContainer:
      activePalette?.surfaceContainer ?? baseline.surfaceContainer,
    surfaceContainerHigh:
      activePalette?.surfaceContainerHigh ?? baseline.surfaceContainerHigh,
    surfaceContainerHighest:
      activePalette?.surfaceContainerHighest ??
      baseline.surfaceContainerHighest,
  };

  return {
    colors,
    isDark,
    colorScheme,
    themeAccent,
    themeMode,
    isDynamicSupported,
    setThemeAccent,
    setThemeMode,
  };
}
