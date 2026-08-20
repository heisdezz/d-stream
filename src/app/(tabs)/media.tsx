import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAtom } from 'jotai';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useAppStore } from '@/store/use-app-store';
import {
  searchQueryAtom,
  mediaTypeFilterAtom,
  selectedAlbumIdAtom,
  selectedTagIdAtom,
  sortByAtom,
  sortOrderAtom,
  viewModeAtom,
  MediaTypeFilter,
} from '@/store/atoms';
import { Spacing, Shapes, MaxContentWidth } from '@/constants/theme';
import { M3SearchBar } from '@/components/material/m3-search-bar';
import { M3SegmentedRow, SegmentItem } from '@/components/material/m3-segmented-row';
import { M3Chip } from '@/components/material/m3-chip';
import { M3Button } from '@/components/material/m3-button';
import { M3Card } from '@/components/material/m3-card';
import { MediaGridItem } from '@/components/media/media-grid-item';
import { MediaListItem } from '@/components/media/media-list-item';
import { MediaItem } from '@/types/models';
import { MaterialIcons } from '@expo/vector-icons';

const typeSegments: SegmentItem<MediaTypeFilter>[] = [
  { value: 'all', label: 'All Media', icon: 'perm-media' },
  { value: 'image', label: 'Images', icon: 'image' },
  { value: 'video', label: 'Videos', icon: 'videocam' },
];

export default function MediaExplorerScreen() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Jotai atomic state
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [type, setType] = useAtom(mediaTypeFilterAtom);
  const [selectedAlbumId, setSelectedAlbumId] = useAtom(selectedAlbumIdAtom);
  const [selectedTagId, setSelectedTagId] = useAtom(selectedTagIdAtom);
  const [sortBy, setSortBy] = useAtom(sortByAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  const [layoutMode, setLayoutMode] = useAtom(viewModeAtom);

  // Zustand global state
  const {
    ip,
    port,
    status: syncStatus,
    mediaItems,
    totalMediaCount,
    hasDatabase,
    isLoading,
    isRefreshing,
    albums,
    tags,
    stats,
    refreshLibrary,
    loadMoreMedia,
  } = useAppStore();

  useEffect(() => {
    refreshLibrary({
      query,
      type,
      albumId: selectedAlbumId,
      tagId: selectedTagId,
      sortBy,
      sortOrder,
    });
  }, [query, type, selectedAlbumId, selectedTagId, sortBy, sortOrder, refreshLibrary]);

  const handleToggleLayout = () => {
    setLayoutMode(layoutMode === 'grid' ? 'list' : 'grid');
  };

  const handleMediaPress = (item: MediaItem) => {
    router.push(`/media/${item.id}`);
  };

  const handleLoadMore = () => {
    loadMoreMedia({
      query,
      type,
      albumId: selectedAlbumId,
      tagId: selectedTagId,
      sortBy,
      sortOrder,
    });
  };

  const handleRefresh = () => {
    refreshLibrary({
      query,
      type,
      albumId: selectedAlbumId,
      tagId: selectedTagId,
      sortBy,
      sortOrder,
    });
  };

  const activeAlbum = albums.find((a) => a.id === selectedAlbumId);
  const activeTag = tags.find((t) => t.id === selectedTagId);

  const contentWidth = Math.min(width - Spacing.four * 2, MaxContentWidth);
  const numColumns = layoutMode === 'grid' ? 2 : 1;
  const gridItemWidth = (contentWidth - Spacing.two) / 2;

  const renderItem = ({ item }: { item: MediaItem }) => {
    if (layoutMode === 'list') {
      return (
        <MediaListItem
          item={item}
          onPress={handleMediaPress}
          serverIp={syncStatus === 'connected' ? ip : undefined}
          serverPort={port}
        />
      );
    }
    return (
      <View style={{ width: gridItemWidth, marginRight: Spacing.two }}>
        <MediaGridItem
          item={item}
          onPress={handleMediaPress}
          width={gridItemWidth}
          serverIp={syncStatus === 'connected' ? ip : undefined}
          serverPort={port}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar & Layout Switcher */}
      <View style={styles.topSection}>
        <View style={styles.searchRow}>
          <M3SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search by filename or path..."
            style={{ flex: 1, marginRight: Spacing.two }}
          />
          <Pressable
            onPress={handleToggleLayout}
            style={[
              styles.iconButton,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <MaterialIcons
              name={layoutMode === 'grid' ? 'view-list' : 'grid-view'}
              size={22}
              color={colors.onSurface}
            />
          </Pressable>
        </View>

        {/* Type Filter Segmented Row */}
        <M3SegmentedRow
          items={typeSegments}
          selectedValue={type}
          onSelect={(val) => setType(val)}
          style={{ marginTop: Spacing.two }}
        />

        {/* Active Filter Chips Bar */}
        {(selectedAlbumId !== undefined || selectedTagId !== undefined) && (
          <View style={styles.filterChipsRow}>
            {activeAlbum && (
              <M3Chip
                label={`Album: ${activeAlbum.name}`}
                selected
                icon="folder"
                onPress={() => setSelectedAlbumId(undefined)}
              />
            )}
            {activeTag && (
              <M3Chip
                label={`Tag: ${activeTag.name}`}
                selected
                colorHex={activeTag.color_hex}
                onPress={() => setSelectedTagId(undefined)}
              />
            )}
          </View>
        )}

        {/* Results Counter & Sort bar */}
        <View style={styles.metricsBar}>
          <Text style={[styles.counterText, { color: colors.onSurfaceVariant }]}>
            {totalMediaCount.toLocaleString()}{' '}
            {type === 'image' ? 'Images' : type === 'video' ? 'Videos' : 'Items'} found
          </Text>

          <Pressable
            onPress={() => {
              if (sortBy === 'created_at') {
                setSortBy('file_size');
              } else if (sortBy === 'file_size') {
                setSortBy('current_relative_path');
              } else {
                setSortBy('created_at');
              }
            }}
            style={styles.sortButton}
          >
            <Text style={[styles.sortLabel, { color: colors.primary }]}>
              Sort: {sortBy === 'created_at' ? 'Date' : sortBy === 'file_size' ? 'Size' : 'Name'}
            </Text>
            <Pressable
              onPress={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
              style={{ marginLeft: 4 }}
            >
              <MaterialIcons
                name={sortOrder === 'ASC' ? 'arrow-upward' : 'arrow-downward'}
                size={16}
                color={colors.primary}
              />
            </Pressable>
          </Pressable>
        </View>
      </View>

      {/* Main Media List / Grid */}
      {!hasDatabase && stats.total_items === 0 ? (
        <View style={styles.emptyState}>
          <M3Card variant="filled" style={styles.emptyCard}>
            <MaterialIcons name="cloud-off" size={48} color={colors.outline} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              No Local SQLite Database
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              Connect to your external drive organizer server on Wi-Fi and sync your media library database.
            </Text>
            <M3Button
              label="Go to Sync"
              icon="sync"
              variant="filled"
              style={{ marginTop: Spacing.three }}
              onPress={() => router.push('/sync')}
            />
          </M3Card>
        </View>
      ) : mediaItems.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="search-off" size={48} color={colors.outline} />
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
            No media matching criteria
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
            Try changing your search keywords or clearing filters.
          </Text>
        </View>
      ) : (
        <FlatList
          key={layoutMode}
          data={mediaItems}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          numColumns={numColumns}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.seven },
          ]}
          onRefresh={handleRefresh}
          refreshing={isRefreshing}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSection: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.two,
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.half,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    width: '100%',
    maxWidth: 400,
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
