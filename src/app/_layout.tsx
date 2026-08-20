import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplashView } from '@/components/splash/splash-view';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useAppStore } from '@/store/use-app-store';

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
  const { colors, isDark } = useMaterialTheme();

  const [fontsLoaded] = useFonts({
    ...MaterialIcons.font,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    useAppStore.getState().init();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {fontsLoaded && <SplashView />}
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: colors.surface,
              },
              headerTintColor: colors.onSurface,
              headerTitleStyle: {
                fontWeight: '700',
              },
              contentStyle: {
                backgroundColor: colors.background,
              },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="album/[id]"
              options={{
                title: 'Album Gallery',
                headerShown: true,
              }}
            />
            <Stack.Screen
              name="media/[id]"
              options={{
                presentation: 'modal',
                title: 'Media Inspector',
                headerShown: true,
              }}
            />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
