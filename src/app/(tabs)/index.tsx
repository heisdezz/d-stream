import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSetAtom } from 'jotai';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useAppStore } from '@/store/use-app-store';
import { mediaTypeFilterAtom, searchQueryAtom } from '@/store/atoms';
import { Spacing, Shapes, MaxContentWidth, Elevation } from '@/constants/theme';
import { M3StatCard } from '@/components/material/m3-stat-card';
import { M3Button } from '@/components/material/m3-button';
import { M3Card } from '@/components/material/m3-card';
import { M3Badge } from '@/components/material/m3-badge';
import { ConnectionStatus } from '@/components/sync/connection-status';
import { SyncProgressBar } from '@/components/sync/sync-progress-bar';
import { MediaGridItem } from '@/components/media/media-grid-item';
import { AlbumCard } from '@/components/media/album-card';
import { MaterialIcons } from '@expo/vector-icons';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function formatLastSync(iso: string | null): string {
  if (!iso) return 'Never synced';
  try {
    const date = new Date(iso);
    return (
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
      ' • ' +
      date.toLocaleDateString()
    );
  } catch {
    return 'Never synced';
  }
}

export default function DashboardScreen() {
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
    latencyMs,
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
  } = useAppStore();

  const contentWidth = Math.min(width - Spacing.four * 2, MaxContentWidth);
  const gridItemWidth = (contentWidth - Spacing.two) / 2;

  const handlePullRefresh = async () => {
    await Promise.all([checkConnection(), refreshLibrary()]);
  };

  const handleSyncPress = async () => {
    await syncDatabase();
  };

  const handleCategoryPress = (type: 'all' | 'image' | 'video') => {
    setMediaTypeFilter(type);
    setSearchQuery('');
    router.push('/media');
  };

  const totalImagePct =
    stats.total_items > 0
      ? Math.round((stats.images / stats.total_items) * 100)
      : 0;
  const totalVideoPct =
    stats.total_items > 0
      ? Math.round((stats.videos / stats.total_items) * 100)
      : 0;

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
      {/* Top Welcome Header */}
      <View style={styles.topHeader}>
        <View style={styles.greetingBox}>
          <Text style={[styles.greetingSub, { color: colors.outline }]}>
            {getGreeting()}
          </Text>
          <Text style={[styles.greetingTitle, { color: colors.onBackground }]}>
            External Drive Hub
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/sync')}
          style={({ pressed }) => [
            styles.serverBadgeBtn,
            {
              backgroundColor:
                syncStatus === 'connected'
                  ? colors.primaryContainer
                  : colors.surfaceContainerHigh,
              borderColor:
                syncStatus === 'connected'
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
                  syncStatus === 'connected'
                    ? '#10B981'
                    : syncStatus === 'testing'
                    ? '#F59E0B'
                    : colors.error,
              },
            ]}
          />
          <Text
            style={[
              styles.serverBadgeText,
              {
                color:
                  syncStatus === 'connected'
                    ? colors.onPrimaryContainer
                    : colors.onSurface,
              },
            ]}
          >
            {syncStatus === 'connected' ? 'Connected' : 'Offline'}
          </Text>
        </Pressable>
      </View>

      {/* Quick Search Launcher Bar */}
      <Pressable
        onPress={() => {
          setSearchQuery('');
          router.push('/media');
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
          Search files, albums, or media hashes...
        </Text>
      </Pressable>

      {/* Connection Status Banner */}
      <ConnectionStatus
        status={syncStatus}
        serverIp={ip}
        serverPort={port}
        driveName={serverInfo?.drive_name}
        latencyMs={latencyMs}
        style={{ marginBottom: Spacing.three }}
      />

      {/* Sync Progress Bar */}
      {syncProgress && (
        <M3Card variant="outlined" style={{ marginBottom: Spacing.three }}>
          <SyncProgressBar progress={syncProgress} />
        </M3Card>
      )}

      {/* Hero Drive & Sync Hub Card */}
      <M3Card variant="elevated" style={styles.heroHubCard}>
        <View style={styles.heroHubHeader}>
          <View
            style={[
              styles.heroDriveIcon,
              { backgroundColor: colors.primaryContainer },
            ]}
          >
            <MaterialIcons
              name="storage"
              size={30}
              color={colors.onPrimaryContainer}
            />
          </View>

          <View style={styles.heroDriveTitleBox}>
            <View style={styles.driveTitleRow}>
              <Text style={[styles.heroDriveName, { color: colors.onSurface }]}>
                {serverInfo?.drive_name || 'Removable Media Library'}
              </Text>
              <M3Badge
                label={stats.total_items > 0 ? 'ACTIVE' : 'READY'}
                variant={stats.total_items > 0 ? 'primary' : 'surface'}
                size="small"
              />
            </View>

            <Text style={[styles.heroSyncTime, { color: colors.outline }]}>
              Last Synced: {formatLastSync(lastSyncTime)}
            </Text>
          </View>
        </View>

        {/* Media Proportion Visual Bar */}
        {stats.total_items > 0 && (
          <View style={styles.proportionContainer}>
            <View style={styles.proportionBar}>
              <View
                style={[
                  styles.proportionSegment,
                  {
                    flex: stats.images || 1,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
              <View
                style={[
                  styles.proportionSegment,
                  {
                    flex: stats.videos || 1,
                    backgroundColor: colors.tertiary,
                  },
                ]}
              />
            </View>

            <View style={styles.proportionLegendRow}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.primary },
                  ]}
                />
                <Text
                  style={[
                    styles.legendLabel,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  Photos: {stats.images} ({totalImagePct}%)
                </Text>
              </View>

              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.tertiary },
                  ]}
                />
                <Text
                  style={[
                    styles.legendLabel,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  Videos: {stats.videos} ({totalVideoPct}%)
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.heroActions}>
          <M3Button
            label={syncStatus === 'downloading' ? 'Syncing...' : 'Sync LAN DB'}
            icon="sync"
            variant="filled"
            loading={syncStatus === 'downloading' || syncStatus === 'migrating'}
            onPress={handleSyncPress}
            style={{ flex: 1, marginRight: Spacing.two }}
          />
          <M3Button
            label="Configure"
            icon="settings"
            variant="tonal"
            onPress={() => router.push('/sync')}
          />
        </View>
      </M3Card>

      {/* Quick Category Shortcuts */}
      <View style={styles.categoryRow}>
        <Pressable
          onPress={() => handleCategoryPress('image')}
          style={({ pressed }) => [
            styles.categoryCard,
            {
              backgroundColor: colors.primaryContainer + '80',
              borderColor: colors.primary + '40',
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <MaterialIcons name="image" size={24} color={colors.primary} />
          <Text style={[styles.categoryTitle, { color: colors.onSurface }]}>
            Photos
          </Text>
          <Text style={[styles.categoryCount, { color: colors.outline }]}>
            {stats.images.toLocaleString()}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleCategoryPress('video')}
          style={({ pressed }) => [
            styles.categoryCard,
            {
              backgroundColor: colors.tertiaryContainer + '80',
              borderColor: colors.tertiary + '40',
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <MaterialIcons name="videocam" size={24} color={colors.tertiary} />
          <Text style={[styles.categoryTitle, { color: colors.onSurface }]}>
            Videos
          </Text>
          <Text style={[styles.categoryCount, { color: colors.outline }]}>
            {stats.videos.toLocaleString()}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/albums')}
          style={({ pressed }) => [
            styles.categoryCard,
            {
              backgroundColor: colors.secondaryContainer + '80',
              borderColor: colors.secondary + '40',
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <MaterialIcons name="folder-special" size={24} color={colors.secondary} />
          <Text style={[styles.categoryTitle, { color: colors.onSurface }]}>
            Albums
          </Text>
          <Text style={[styles.categoryCount, { color: colors.outline }]}>
            {stats.albums.toLocaleString()}
          </Text>
        </Pressable>
      </View>

      {/* Overview Statistics Grid */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
          Library Analytics
        </Text>
      </View>

      <View style={styles.statGrid}>
        <View style={styles.statRow}>
          <M3StatCard
            title="Total Media"
            value={stats.total_items.toLocaleString()}
            subtitle={`${stats.images} img • ${stats.videos} vid`}
            icon="perm-media"
            variant="primary"
            onPress={() => handleCategoryPress('all')}
          />
          <View style={{ width: Spacing.two }} />
          <M3StatCard
            title="Database Size"
            value={stats.db_size_formatted}
            subtitle={
              stats.total_items > 0 ? 'Offline SQLite Active' : 'Empty Database'
            }
            icon="sd-storage"
            variant="secondary"
            onPress={() => router.push('/sync')}
          />
        </View>

        <View style={[styles.statRow, { marginTop: Spacing.two }]}>
          <M3StatCard
            title="Albums"
            value={stats.albums}
            subtitle="Folder Collections"
            icon="collections-bookmark"
            variant="tertiary"
            onPress={() => router.push('/albums')}
          />
          <View style={{ width: Spacing.two }} />
          <M3StatCard
            title="Tags"
            value={stats.tags}
            subtitle="Taxonomy Categories"
            icon="label"
            variant="primary"
            onPress={() => router.push('/albums')}
          />
        </View>
      </View>

      {/* Top Collections Carousel */}
      {albums.length > 0 && (
        <View style={styles.collectionsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              Top Collections
            </Text>
            <M3Button
              label="View All"
              variant="text"
              size="small"
              onPress={() => router.push('/albums')}
            />
          </View>

          {albums.slice(0, 3).map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              serverIp={syncStatus === 'connected' ? ip : undefined}
              serverPort={port}
              onPress={(alb) => router.push(`/album/${alb.id}`)}
            />
          ))}
        </View>
      )}

      {/* Recent Media Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
          Recent Media
        </Text>
        <M3Button
          label="Explore All"
          variant="text"
          size="small"
          onPress={() => handleCategoryPress('all')}
        />
      </View>

      {!hasDatabase && stats.total_items === 0 ? (
        <M3Card variant="filled" style={styles.emptySetupCard}>
          <View style={[styles.setupIconBox, { backgroundColor: colors.primaryContainer }]}>
            <MaterialIcons name="cloud-download" size={36} color={colors.primary} />
          </View>

          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
            Welcome to d-stream
          </Text>

          <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
            Organize and stream media from your external drives over your local Wi-Fi network.
          </Text>

          <View style={styles.setupStepsContainer}>
            <View style={styles.setupStepRow}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.onSurface }]}>
                Connect to local Wi-Fi network
              </Text>
            </View>

            <View style={styles.setupStepRow}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.onSurface }]}>
                Enter desktop host IP in Sync settings
              </Text>
            </View>

            <View style={styles.setupStepRow}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.onSurface }]}>
                Download library snapshot for offline access
              </Text>
            </View>
          </View>

          <M3Button
            label="Connect & Sync LAN DB"
            icon="sync"
            variant="filled"
            style={{ marginTop: Spacing.three, width: '100%' }}
            onPress={() => router.push('/sync')}
          />
        </M3Card>
      ) : (
        <View style={styles.recentGrid}>
          {recentMedia.map((item) => (
            <MediaGridItem
              key={item.id}
              item={item}
              width={gridItemWidth}
              serverIp={syncStatus === 'connected' ? ip : undefined}
              serverPort={port}
              onPress={(media) => router.push(`/media/${media.id}`)}
            />
          ))}
        </View>
      )}
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
    alignSelf: 'center',
    width: '100%',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
    marginTop: Spacing.one,
  },
  greetingBox: {
    flex: 1,
  },
  greetingSub: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  serverBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '800',
  },
  quickSearchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: Shapes.full,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
  },
  quickSearchText: {
    fontSize: 13,
    fontWeight: '500',
  },
  heroHubCard: {
    marginBottom: Spacing.three,
  },
  heroHubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  heroDriveIcon: {
    width: 52,
    height: 52,
    borderRadius: Shapes.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  heroDriveTitleBox: {
    flex: 1,
  },
  driveTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroDriveName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
    marginRight: Spacing.one,
  },
  heroSyncTime: {
    fontSize: 11,
    marginTop: 2,
  },
  proportionContainer: {
    marginBottom: Spacing.three,
    paddingTop: Spacing.one,
  },
  proportionBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(150,150,150,0.15)',
    marginBottom: 6,
  },
  proportionSegment: {
    height: '100%',
  },
  proportionLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  categoryCard: {
    flex: 1,
    borderRadius: Shapes.large,
    padding: Spacing.two + 2,
    alignItems: 'center',
    borderWidth: 1,
    ...Elevation.level1,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  categoryCount: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  statGrid: {
    marginBottom: Spacing.two,
  },
  statRow: {
    flexDirection: 'row',
  },
  collectionsSection: {
    marginTop: Spacing.two,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptySetupCard: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  setupIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.one,
    lineHeight: 18,
    marginBottom: Spacing.three,
  },
  setupStepsContainer: {
    width: '100%',
    marginVertical: Spacing.two,
    gap: Spacing.two,
  },
  setupStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  stepNumberText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
