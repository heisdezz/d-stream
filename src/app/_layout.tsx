import React, { useEffect, useState } from "react";
import { View, Platform } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner-native";
import { SplashView } from "@/components/splash/splash-view";
import { useMaterialTheme } from "@/hooks/use-material-theme";
import { usePermissions } from "@/hooks/use-permissions";
import { useAppStore } from "@/store/use-app-store";
import { tw, useDeviceContext } from "@/lib/tailwind";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  useDeviceContext(tw);
  const { colors, isDark } = useMaterialTheme();
  const { requestPermissions } = usePermissions();

  const [fontsLoaded, fontError] = useFonts({
    ...MaterialIcons.font,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await useAppStore.getState().init();
      } catch (err) {
        console.warn("[AppInit] Error initializing app store on launch:", err);
      } finally {
        setAppReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || appReady) {
      // Hide native splash screen safely
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, appReady]);

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style={isDark ? "light" : "dark"} />
          <SplashView />
          <Toaster position="bottom-center" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "default",
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="album/[id]"
              options={{
                headerShown: true,
                title: "Album Gallery",
                headerBackTitle: "Back",
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.primary,
                headerTitleStyle: {
                  fontWeight: "700",
                  color: colors.onSurface,
                },
              }}
            />
            <Stack.Screen
              name="media/[id]"
              options={{
                presentation: "modal",
                headerShown: true,
                title: "Media Inspector",
                headerBackTitle: "Close",
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.primary,
                headerTitleStyle: {
                  fontWeight: "700",
                  color: colors.onSurface,
                },
              }}
            />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
