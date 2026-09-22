import React from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMaterialTheme } from "@/hooks/use-material-theme";
import { Shapes } from "@/constants/theme";
import { AppIcon } from "@/components/common/app-icon";

export default function TabLayout() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();

  const bottomInset = insets.bottom > 0 ? insets.bottom : 8;
  // Material 3 specification for bottom navigation bar height: 80dp + insets
  const tabHeight = 68 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: "800",
          fontSize: 18,
          color: colors.onSurface,
        },
        tabBarStyle: {
          backgroundColor: colors.surfaceContainer,
          borderTopColor: colors.outlineVariant,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 8,
          elevation: 3,
        },
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerTitle: "Media Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.activeIndicatorPill,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <AppIcon
                name={focused ? "dashboard" : "dashboard-customize"}
                symbolName={focused ? "house.fill" : "house"}
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
          title: "Explorer",
          headerTitle: "Media Explorer",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.activeIndicatorPill,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <AppIcon
                name={focused ? "perm-media" : "photo-library"}
                symbolName={focused ? "photo.stack.fill" : "photo.stack"}
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
          title: "Collections",
          headerTitle: "Albums & Tags",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.activeIndicatorPill,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <AppIcon
                name={focused ? "collections-bookmark" : "folder-special"}
                symbolName={focused ? "folder.fill.badge.plus" : "folder"}
                size={22}
                color={focused ? colors.onSecondaryContainer : color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="downloads"
        options={{
          title: "Downloads",
          headerTitle: "Offline Downloads",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.activeIndicatorPill,
                focused && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <AppIcon
                name={focused ? "file-download-done" : "file-download"}
                symbolName={
                  focused ? "arrow.down.circle.fill" : "arrow.down.circle"
                }
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
          title: "Sync",
          headerTitle: "LAN Sync & Settings",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.activeIndicatorPill,
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
  // Material 3 compact active indicator pill: standard 64x32dp
  activeIndicatorPill: {
    width: 60,
    height: 32,
    borderRadius: Shapes.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
