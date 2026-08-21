import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes } from '@/constants/theme';
import { AppIcon } from '@/components/common/app-icon';

export default function TabLayout() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();

  const bottomInset = insets.bottom > 0 ? insets.bottom : 6;
  const tabHeight = 58 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
          color: colors.onSurface,
        },
        tabBarStyle: {
          backgroundColor: colors.surfaceContainer,
          borderTopColor: colors.outlineVariant,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          elevation: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: 'Media Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconBox,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <AppIcon
                name={focused ? 'dashboard' : 'dashboard-customize'}
                symbolName={focused ? 'house.fill' : 'house'}
                size={22}
                color={focused ? colors.onSecondaryContainer : color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="media"
        options={{
          title: 'Explorer',
          headerTitle: 'Media Explorer',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconBox,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <AppIcon
                name={focused ? 'perm-media' : 'photo-library'}
                symbolName={focused ? 'photo.stack.fill' : 'photo.stack'}
                size={22}
                color={focused ? colors.onSecondaryContainer : color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="albums"
        options={{
          title: 'Collections',
          headerTitle: 'Albums & Tags',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconBox,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <AppIcon
                name={focused ? 'collections-bookmark' : 'folder-special'}
                symbolName={focused ? 'folder.fill.badge.plus' : 'folder'}
                size={22}
                color={focused ? colors.onSecondaryContainer : color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          headerTitle: 'LAN Sync & DB',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconBox,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <AppIcon
                name="sync"
                symbolName="arrow.triangle.2.circlepath"
                size={22}
                color={focused ? colors.onSecondaryContainer : color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    width: 46,
    height: 28,
    borderRadius: Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
