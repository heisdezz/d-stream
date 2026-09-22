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
      style={[styles.container, { backgroundColor: colors.background }]}
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
      <View style={styles.topHeader}>
        <View style={styles.brandingBox}>
          <Text style={[styles.appTitle, { color: colors.onBackground }]}>
            d-stream
          </Text>
          <Text style={[styles.appSubtitle, { color: colors.outline }]}>
            {serverInfo?.drive_name || "Local Media Streamer"}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/sync")}
          style={({ pressed }) => [
            styles.serverBadgeBtn,
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
              styles.statusDot,
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
              styles.serverBadgeText,
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
          styles.quickSearchPill,
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
          style={{ marginRight: Spacing.two }}
        />
        <Text style={[styles.quickSearchText, { color: colors.outline }]}>
          Search photos, videos, albums...
        </Text>
      </Pressable>

      {/* Sync Progress Bar */}
      {syncProgress && (
        <M3Card variant="outlined" style={{ marginBottom: Spacing.three }}>
          <SyncProgressBar progress={syncProgress} />
        </M3Card>
      )}

      {/* Unified Hero Library Hub Card */}
      <M3Card variant="elevated" style={styles.heroHubCard}>
        <View style={styles.heroTopRow}>
          <View
            style={[
              styles.heroDriveIcon,
              { backgroundColor: colors.primaryContainer },
            ]}
          >
            <MaterialIcons
              name="storage"
              size={24}
              color={colors.onPrimaryContainer}
            />
          </View>

          <View style={styles.heroTitleCol}>
            <Text
              style={[styles.heroDriveName, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {serverInfo?.drive_name ||
                (hasDatabase ? "Local Media Library" : "No Drive Connected")}
            </Text>
            <Text style={[styles.heroSyncTime, { color: colors.outline }]}>
              {stats.total_items > 0
                ? `${stats.total_items.toLocaleString()} media items • Synced ${formatLastSync(lastSyncTime || undefined)}`
                : "Connect & sync to stream"}
            </Text>
          </View>

          {stats.total_items > 0 && (
            <M3Badge
              label="READY"
              variant="primary"
              size="small"
              style={{ marginLeft: "auto" }}
            />
          )}
        </View>

        {/* Quick Category Counters */}
        <View style={styles.categoryRow}>
          <Pressable
            onPress={() => handleCategoryPress("image")}
            style={({ pressed }) => [
              styles.categoryPill,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialIcons name="image" size={18} color={colors.primary} />
            <Text
              style={[styles.categoryPillText, { color: colors.onSurface }]}
            >
              {stats.images.toLocaleString()} Photos
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleCategoryPress("video")}
            style={({ pressed }) => [
              styles.categoryPill,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialIcons name="videocam" size={18} color={colors.tertiary} />
            <Text
              style={[styles.categoryPillText, { color: colors.onSurface }]}
            >
              {stats.videos.toLocaleString()} Videos
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/albums")}
            style={({ pressed }) => [
              styles.categoryPill,
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
            <Text
              style={[styles.categoryPillText, { color: colors.onSurface }]}
            >
              {stats.albums.toLocaleString()} Albums
            </Text>
          </Pressable>
        </View>

        {/* Quick Actions */}
        <View style={styles.heroActions}>
          <M3Button
            label={syncStatus === "downloading" ? "Syncing..." : "Sync DB"}
            icon="sync"
            variant="filled"
            size="medium"
            loading={syncStatus === "downloading" || syncStatus === "migrating"}
            onPress={handleSyncPress}
            style={{ flex: 1, marginRight: Spacing.two }}
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
              style={{ marginRight: Spacing.two }}
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
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
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
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
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
          <M3Card variant="filled" style={styles.emptySetupCard}>
            <MaterialIcons name="cloud-sync" size={40} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              No Media Synced
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}
            >
              Connect to your desktop server over local Wi-Fi to load your media
              library.
            </Text>
            <M3Button
              label="Connect Server"
              icon="sync"
              variant="filled"
              style={{ marginTop: Spacing.three }}
              onPress={() => router.push("/sync")}
            />
          </M3Card>
        ) : (
          <View style={styles.recentGrid}>
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
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },
  brandingBox: {
    flex: 1,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  serverBadgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Shapes.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  serverBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  quickSearchPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    height: 46,
    borderRadius: Shapes.full,
    borderWidth: 1,
    marginBottom: Spacing.three,
  },
  quickSearchText: {
    fontSize: 13,
  },
  heroHubCard: {
    padding: Spacing.three + 2,
    marginBottom: Spacing.four,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.three,
  },
  heroDriveIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.two,
  },
  heroTitleCol: {
    flex: 1,
  },
  heroDriveName: {
    fontSize: 16,
    fontWeight: "800",
  },
  heroSyncTime: {
    fontSize: 12,
    marginTop: 2,
  },
  categoryRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  categoryPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: Shapes.medium,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionContainer: {
    marginBottom: Spacing.three,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  emptySetupCard: {
    padding: Spacing.four,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Shapes.large,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: Spacing.two,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: Spacing.one,
    maxWidth: 280,
  },
  recentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
});
