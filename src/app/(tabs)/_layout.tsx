import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();

  const bottomInset = insets.bottom > 0 ? insets.bottom : 8;
  const tabHeight = 60 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          color: colors.onSurface,
        },
        tabBarStyle: {
          backgroundColor: colors.surfaceContainer,
          borderTopColor: colors.outlineVariant,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 8,
          elevation: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
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
                styles.iconWrapper,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <MaterialIcons
                name={focused ? 'dashboard' : 'dashboard-customize'}
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
                styles.iconWrapper,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <MaterialIcons
                name={focused ? 'perm-media' : 'photo-library'}
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
                styles.iconWrapper,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <MaterialIcons
                name={focused ? 'collections-bookmark' : 'folder-special'}
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
                styles.iconWrapper,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <MaterialIcons
                name="sync"
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
  iconWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
