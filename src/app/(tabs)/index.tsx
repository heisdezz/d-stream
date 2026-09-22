import React from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSetAtom } from "jotai";
import { useMaterialTheme } from "@/hooks/use-material-theme";
import { useAppStore } from "@/store/use-app-store";
import { mediaTypeFilterAtom, searchQueryAtom } from "@/store/atoms";
import { Spacing, Shapes, MaxContentWidth } from "@/constants/theme";
import { M3Button } from "@/components/material/m3-button";
import { M3Card } from "@/components/material/m3-card";
import { M3Badge } from "@/components/material/m3-badge";
import { SyncProgressBar } from "@/components/sync/sync-progress-bar";
import { MediaGridItem } from "@/components/media/media-grid-item";
import { AlbumCard } from "@/components/media/album-card";
import { MediaItem } from "@/types/models";
import { MaterialIcons } from "@expo/vector-icons";
import tw from "twrnc";

function formatLastSync(iso?: string): string {
  if (!iso) return "Never";
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 2) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "Never";
  }
}

export default function HomeScreen() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const setMediaTypeFilter = useSetAtom(mediaTypeFilterAtom);
  const setSearchQuery = useSetAtom(searchQueryAtom);

  const {
    ip,
    port,
    status: syncStatus,
    serverInfo,
    syncProgress,
    lastSyncTime,
    stats,
    hasDatabase,
    albums,
    recentMedia,
    isRefreshing,
    checkConnection,
    syncDatabase,
    refreshLibrary,
    playAsShorts,
  } = useAppStore();

  const contentWidth = Math.min(width - Spacing.four * 2, MaxContentWidth);
  const gridItemWidth = (contentWidth - Spacing.two) / 2;

  const handleRecentMediaPress = (media: MediaItem) => {
    if (playAsShorts) {
      router.push({
        pathname: "/shorts",
        params: { mediaId: media.id.toString() },
      });
    } else {
      router.push(`/media/${media.id}`);
    }
  };

  const handlePullRefresh = async () => {
    await Promise.all([checkConnection(), refreshLibrary()]);
  };

  const handleSyncPress = async () => {
    await syncDatabase();
  };

  const handleCategoryPress = (type: "all" | "image" | "video") => {
    setMediaTypeFilter(type);
    setSearchQuery("");
    router.push("/media");
  };

  return (
    <ScrollView
      style={[tw`flex-1`, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: insets.bottom + Spacing.seven },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handlePullRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* Clean Top Header */}
      <View style={tw`flex-row items-center justify-between mb-4`}>
        <View style={tw`flex-1`}>
          <Text
            style={[
              tw`text-2xl font-black tracking-tighter`,
              { color: colors.onBackground },
            ]}
          >
            d-stream
          </Text>
          <Text
            style={[
              tw`text-xs font-semibold mt-0.5`,
              { color: colors.outline },
            ]}
          >
            {serverInfo?.drive_name || "Local Media Streamer"}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/sync")}
          style={({ pressed }) => [
            tw`flex-row items-center px-3 py-1.5 rounded-full border`,
            {
              backgroundColor:
                syncStatus === "connected"
                  ? colors.primaryContainer
                  : colors.surfaceContainerHigh,
              borderColor:
                syncStatus === "connected"
                  ? colors.primary
                  : colors.outlineVariant,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View
            style={[
              tw`w-2 h-2 rounded-full mr-1.5`,
              {
                backgroundColor:
                  syncStatus === "connected"
                    ? "#10B981"
                    : syncStatus === "testing"
                      ? "#F59E0B"
                      : colors.error,
              },
            ]}
          />
          <Text
            style={[
              tw`text-xs font-bold`,
              {
                color:
                  syncStatus === "connected"
                    ? colors.onPrimaryContainer
                    : colors.onSurface,
              },
            ]}
          >
            {syncStatus === "connected" ? "Connected" : "Offline"}
          </Text>
        </Pressable>
      </View>

      {/* Quick Search Launcher Bar */}
      <Pressable
        onPress={() => {
          setSearchQuery("");
          router.push("/media");
        }}
        style={({ pressed }) => [
          tw`flex-row items-center px-4 h-11 rounded-full border mb-4`,
          {
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.outlineVariant,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <MaterialIcons
          name="search"
          size={20}
          color={colors.onSurfaceVariant}
          style={tw`mr-2`}
        />
        <Text style={[tw`text-sm`, { color: colors.outline }]}>
          Search photos, videos, albums...
        </Text>
      </Pressable>

      {/* Sync Progress Bar */}
      {syncProgress && (
        <M3Card variant="outlined" style={tw`mb-4`}>
          <SyncProgressBar progress={syncProgress} />
        </M3Card>
      )}

      {/* Unified Hero Library Hub Card */}
      <M3Card variant="elevated" style={tw`p-4 mb-4`}>
        <View style={tw`flex-row items-center mb-4`}>
          <View
            style={[
              tw`w-11 h-11 rounded-full items-center justify-center mr-3`,
              { backgroundColor: colors.primaryContainer },
            ]}
          >
            <MaterialIcons
              name="storage"
              size={24}
              color={colors.onPrimaryContainer}
            />
          </View>

          <View style={tw`flex-1`}>
            <Text
              style={[
                tw`text-base font-extrabold`,
                { color: colors.onSurface },
              ]}
              numberOfLines={1}
            >
              {serverInfo?.drive_name ||
                (hasDatabase ? "Local Media Library" : "No Drive Connected")}
            </Text>
            <Text style={[tw`text-xs mt-0.5`, { color: colors.outline }]}>
              {stats.total_items > 0
                ? `${stats.total_items.toLocaleString()} media items • Synced ${formatLastSync(
                    lastSyncTime || undefined,
                  )}`
                : "Connect & sync to stream"}
            </Text>
          </View>

          {stats.total_items > 0 && (
            <M3Badge
              label="READY"
              variant="primary"
              size="small"
              style={tw`ml-auto`}
            />
          )}
        </View>

        {/* Quick Category Counters */}
        <View style={tw`flex-row gap-2 mb-4`}>
          <Pressable
            onPress={() => handleCategoryPress("image")}
            style={({ pressed }) => [
              tw`flex-1 flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl border`,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialIcons name="image" size={18} color={colors.primary} />
            <Text style={[tw`text-xs font-bold`, { color: colors.onSurface }]}>
              {stats.images.toLocaleString()} Photos
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleCategoryPress("video")}
            style={({ pressed }) => [
              tw`flex-1 flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl border`,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialIcons name="videocam" size={18} color={colors.tertiary} />
            <Text style={[tw`text-xs font-bold`, { color: colors.onSurface }]}>
              {stats.videos.toLocaleString()} Videos
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/albums")}
            style={({ pressed }) => [
              tw`flex-1 flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-xl border`,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialIcons
              name="folder-special"
              size={18}
              color={colors.secondary}
            />
            <Text style={[tw`text-xs font-bold`, { color: colors.onSurface }]}>
              {stats.albums.toLocaleString()} Albums
            </Text>
          </Pressable>
        </View>

        {/* Quick Actions */}
        <View style={tw`flex-row items-center`}>
          <M3Button
            label={syncStatus === "downloading" ? "Syncing..." : "Sync DB"}
            icon="sync"
            variant="filled"
            size="medium"
            loading={syncStatus === "downloading" || syncStatus === "migrating"}
            onPress={handleSyncPress}
            style={tw`flex-1 mr-2`}
          />

          {recentMedia.length > 0 && (
            <M3Button
              label="Watch Reels"
              icon="movie-filter"
              variant="tonal"
              size="medium"
              onPress={() => {
                router.push({
                  pathname: "/shorts",
                  params: { mediaId: recentMedia[0].id.toString() },
                });
              }}
              style={tw`mr-2`}
            />
          )}

          <M3Button
            label="Settings"
            icon="settings"
            variant="outlined"
            size="medium"
            onPress={() => router.push("/sync")}
          />
        </View>
      </M3Card>

      {/* Top Collections Carousel */}
      {albums.length > 0 && (
        <View style={tw`mb-4`}>
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <Text
              style={[
                tw`text-base font-extrabold tracking-tight`,
                { color: colors.onSurface },
              ]}
            >
              Collections
            </Text>
            <M3Button
              label="View All"
              variant="text"
              size="small"
              onPress={() => router.push("/albums")}
            />
          </View>

          {albums.slice(0, 3).map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              serverIp={syncStatus === "connected" ? ip : undefined}
              serverPort={port}
              onPress={(alb) => router.push(`/album/${alb.id}`)}
            />
          ))}
        </View>
      )}

      {/* Recent Media Section */}
      <View style={tw`mb-4`}>
        <View style={tw`flex-row items-center justify-between mb-2`}>
          <Text
            style={[
              tw`text-base font-extrabold tracking-tight`,
              { color: colors.onSurface },
            ]}
          >
            Recent Media
          </Text>
          {recentMedia.length > 0 && (
            <M3Button
              label="Explore All"
              variant="text"
              size="small"
              onPress={() => handleCategoryPress("all")}
            />
          )}
        </View>

        {!hasDatabase && stats.total_items === 0 ? (
          <M3Card
            variant="filled"
            style={tw`p-6 items-center justify-center rounded-2xl`}
          >
            <MaterialIcons name="cloud-sync" size={40} color={colors.primary} />
            <Text
              style={[
                tw`text-base font-bold mt-2`,
                { color: colors.onSurface },
              ]}
            >
              No Media Synced
            </Text>
            <Text
              style={[
                tw`text-xs text-center mt-1 max-w-[280px]`,
                { color: colors.onSurfaceVariant },
              ]}
            >
              Connect to your desktop server over local Wi-Fi to load your media
              library.
            </Text>
            <M3Button
              label="Connect Server"
              icon="sync"
              variant="filled"
              style={tw`mt-4`}
              onPress={() => router.push("/sync")}
            />
          </M3Card>
        ) : (
          <View style={tw`flex-row flex-wrap gap-2`}>
            {recentMedia.map((item) => (
              <MediaGridItem
                key={item.id}
                item={item}
                width={gridItemWidth}
                serverIp={syncStatus === "connected" ? ip : undefined}
                serverPort={port}
                onPress={handleRecentMediaPress}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
});
