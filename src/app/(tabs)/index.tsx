import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useAppStore } from '@/store/use-app-store';
import { Spacing, Shapes, MaxContentWidth } from '@/constants/theme';
import { M3StatCard } from '@/components/material/m3-stat-card';
import { M3Button } from '@/components/material/m3-button';
import { M3Card } from '@/components/material/m3-card';
import { ConnectionStatus } from '@/components/sync/connection-status';
import { SyncProgressBar } from '@/components/sync/sync-progress-bar';
import { MediaGridItem } from '@/components/media/media-grid-item';
import { MaterialIcons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width - Spacing.four * 2, MaxContentWidth);
  const gridItemWidth = (contentWidth - Spacing.two) / 2;

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
    recentMedia,
    isRefreshing,
    checkConnection,
    syncDatabase,
    refreshLibrary,
  } = useAppStore();

  const handlePullRefresh = async () => {
    await Promise.all([checkConnection(), refreshLibrary()]);
  };

  const handleSyncPress = async () => {
    await syncDatabase();
  };

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'Never synced';
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
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
      {/* Live Server Connection Banner */}
      <ConnectionStatus
        status={syncStatus}
        serverIp={ip}
        serverPort={port}
        driveName={serverInfo?.drive_name}
        latencyMs={latencyMs}
        style={{ marginBottom: Spacing.three }}
      />

      {/* Sync in progress indicator */}
      {syncProgress && (
        <M3Card variant="outlined" style={{ marginBottom: Spacing.three }}>
          <SyncProgressBar progress={syncProgress} />
        </M3Card>
      )}

      {/* Hero Drive Banner */}
      <M3Card variant="elevated" style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={[styles.driveIcon, { backgroundColor: colors.primaryContainer }]}>
            <MaterialIcons name="storage" size={28} color={colors.onPrimaryContainer} />
          </View>
          <View style={styles.driveTitleBox}>
            <Text style={[styles.driveName, { color: colors.onSurface }]}>
              {serverInfo?.drive_name || 'Local Media Database'}
            </Text>
            <Text style={[styles.syncTime, { color: colors.outline }]}>
              Last Synced: {formatLastSync(lastSyncTime)}
            </Text>
          </View>
        </View>

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

      {/* Overview Statistics Grid */}
      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
        Library Statistics
      </Text>

      <View style={styles.statGrid}>
        <View style={styles.statRow}>
          <M3StatCard
            title="Total Items"
            value={stats.total_items.toLocaleString()}
            subtitle={`${stats.images} img • ${stats.videos} vid`}
            icon="perm-media"
            variant="primary"
            onPress={() => router.push('/media')}
          />
          <View style={{ width: Spacing.two }} />
          <M3StatCard
            title="Database Size"
            value={stats.db_size_formatted}
            subtitle={stats.total_items > 0 ? 'Offline SQLite Active' : 'Empty Database'}
            icon="sd-storage"
            variant="secondary"
            onPress={() => router.push('/sync')}
          />
        </View>

        <View style={[styles.statRow, { marginTop: Spacing.two }]}>
          <M3StatCard
            title="Albums"
            value={stats.albums}
            subtitle="Collections"
            icon="collections-bookmark"
            variant="tertiary"
            onPress={() => router.push('/albums')}
          />
          <View style={{ width: Spacing.two }} />
          <M3StatCard
            title="Tags"
            value={stats.tags}
            subtitle="Categorized"
            icon="label"
            variant="primary"
            onPress={() => router.push('/albums')}
          />
        </View>
      </View>

      {/* Recent Media Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
          Recent Media
        </Text>
        <M3Button
          label="View All"
          variant="text"
          size="small"
          onPress={() => router.push('/media')}
        />
      </View>

      {recentMedia.length === 0 && stats.total_items === 0 ? (
        <M3Card variant="filled" style={styles.emptyCard}>
          <MaterialIcons name="cloud-download" size={40} color={colors.outline} />
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
            No local media synced yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
            Connect to your Linux desktop organizer server and tap "Sync LAN DB" to download library snapshots.
          </Text>
          <M3Button
            label="Connect & Sync"
            icon="sync"
            variant="filled"
            style={{ marginTop: Spacing.three }}
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
  heroCard: {
    marginBottom: Spacing.four,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  driveIcon: {
    width: 48,
    height: 48,
    borderRadius: Shapes.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  driveTitleBox: {
    flex: 1,
  },
  driveName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  syncTime: {
    fontSize: 12,
    marginTop: 2,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: Spacing.two,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  statGrid: {
    marginBottom: Spacing.two,
  },
  statRow: {
    flexDirection: 'row',
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.one,
    lineHeight: 18,
  },
});
