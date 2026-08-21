import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Pressable,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LegendList, LegendListRef } from '@legendapp/list/react-native';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useAppStore } from '@/store/use-app-store';
import { getAlbumById, getMediaItems } from '@/services/local-db';
import { getThumbnailUrl } from '@/services/sync-api';
import { MediaTypeFilter, ViewLayoutMode } from '@/store/atoms';
import { Spacing, Shapes, MaxContentWidth, Elevation } from '@/constants/theme';
import { M3SearchBar } from '@/components/material/m3-search-bar';
import { M3SegmentedRow, SegmentItem } from '@/components/material/m3-segmented-row';
import { M3Badge } from '@/components/material/m3-badge';
import { MediaGridItem } from '@/components/media/media-grid-item';
import { MediaListItem } from '@/components/media/media-list-item';
import { PaginationBar } from '@/components/media/pagination-bar';
import { ScreenLoader, ScreenTransition } from '@/components/common/screen-loader';
import { MediaItem } from '@/types/models';
import { MaterialIcons } from '@expo/vector-icons';

const typeSegments: SegmentItem<MediaTypeFilter>[] = [
  { value: 'all', label: 'All', icon: 'perm-media' },
  { value: 'image', label: 'Photos', icon: 'image' },
  { value: 'video', label: 'Videos', icon: 'videocam' },
];

export default function AlbumGalleryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const legendListRef = useRef<LegendListRef>(null);

  const albumId = id ? parseInt(id, 10) : NaN;

  const { ip, port, status: syncStatus, pageSize: storePageSize, updatePageSize } = useAppStore();

  const [query, setQuery] = useState('');
  const [type, setType] = useState<MediaTypeFilter>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'file_size' | 'current_relative_path'>('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>('grid');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(storePageSize || 96);

  // 1. Fetch Album Metadata via TanStack Query
  const { data: album } = useQuery({
    queryKey: ['album-meta', albumId],
    queryFn: () => getAlbumById(albumId),
    enabled: !isNaN(albumId),
  });

  // 2. Fetch Album Media Items with Pagination via TanStack Query
  const {
    data: mediaData,
    isLoading: mediaLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['album-media', albumId, page, pageSize, type, query, sortBy, sortOrder],
    queryFn: () =>
      getMediaItems({
        albumId,
        query,
        type,
        sortBy,
        sortOrder,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    enabled: !isNaN(albumId),
  });

  const mediaItems = mediaData?.items ?? [];
  const totalCount = mediaData?.totalCount ?? 0;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    legendListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    updatePageSize(newSize);
    setPage(1);
    legendListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const toggleLayoutMode = () => {
    if (layoutMode === 'grid') setLayoutMode('grid3');
    else if (layoutMode === 'grid3') setLayoutMode('list');
    else setLayoutMode('grid');
  };

  const coverUrl =
    album?.cover_media_id && syncStatus === 'connected'
      ? getThumbnailUrl(ip, port, album.cover_media_id)
      : null;

  const contentWidth = Math.min(width - Spacing.four * 2, MaxContentWidth);
  const numColumns = layoutMode === 'list' ? 1 : layoutMode === 'grid3' ? 3 : 2;
  const gridItemWidth =
    layoutMode === 'grid3'
      ? (contentWidth - Spacing.two * 2) / 3
      : (contentWidth - Spacing.two) / 2;

  const estimatedSize = layoutMode === 'list' ? 88 : Math.round(gridItemWidth * 1.1);

  const renderItem = ({ item }: { item: MediaItem }) => {
    if (layoutMode === 'list') {
      return (
        <MediaListItem
          item={item}
          onPress={(m) => router.push(`/media/${m.id}`)}
          serverIp={syncStatus === 'connected' ? ip : undefined}
          serverPort={port}
        />
      );
    }
    return (
      <View
        style={{
          width: gridItemWidth,
          marginRight: layoutMode === 'grid3' ? Spacing.one + 2 : Spacing.two,
        }}
      >
        <MediaGridItem
          item={item}
          onPress={(m) => router.push(`/media/${m.id}`)}
          width={gridItemWidth}
          serverIp={syncStatus === 'connected' ? ip : undefined}
          serverPort={port}
          aspectRatio={layoutMode === 'grid3' ? 1 : 1.1}
        />
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Hero Album Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surfaceContainer,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        {coverUrl && (
          <Image
            source={{ uri: coverUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
        )}
        <View style={styles.heroOverlay}>
          <View style={styles.heroTopRow}>
            <View style={[styles.folderIconBox, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="folder-special" size={24} color={colors.onPrimary} />
            </View>
            <M3Badge
              label={`${album?.media_count ?? totalCount} items`}
              variant="secondary"
              size="medium"
            />
          </View>

          <Text style={styles.albumTitle} numberOfLines={2}>
            {album?.name || 'Album Collection'}
          </Text>

          <Text style={styles.albumPath} numberOfLines={1}>
            {album?.relative_path}
          </Text>

          {album?.description && (
            <Text style={styles.albumDesc} numberOfLines={2}>
              {album.description}
            </Text>
          )}
        </View>
      </View>

      {/* Search & Layout Switcher */}
      <View style={styles.searchRow}>
        <M3SearchBar
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setPage(1);
          }}
          placeholder="Filter in this album..."
          style={{ flex: 1, marginRight: Spacing.two }}
        />
        <Pressable
          onPress={toggleLayoutMode}
          style={({ pressed }) => [
            styles.layoutToggleBtn,
            {
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <MaterialIcons
            name={
              layoutMode === 'grid'
                ? 'grid-view'
                : layoutMode === 'grid3'
                ? 'view-compact'
                : 'view-list'
            }
            size={22}
            color={colors.onSurface}
          />
        </Pressable>
      </View>

      {/* Type Filter Segmented Row */}
      <M3SegmentedRow
        items={typeSegments}
        selectedValue={type}
        onSelect={(newType) => {
          setType(newType);
          setPage(1);
        }}
        style={{ marginTop: Spacing.two }}
      />

      {/* Sort & Metrics Bar */}
      <View style={styles.metricsBar}>
        <Text style={[styles.metricsLabel, { color: colors.onSurfaceVariant }]}>
          {totalCount.toLocaleString()}{' '}
          {type === 'image' ? 'Photos' : type === 'video' ? 'Videos' : 'Items'} in Album
        </Text>

        <View style={styles.sortControlsRow}>
          <Pressable
            onPress={() => {
              if (sortBy === 'created_at') setSortBy('file_size');
              else if (sortBy === 'file_size') setSortBy('current_relative_path');
              else setSortBy('created_at');
              setPage(1);
            }}
            style={styles.sortBtn}
          >
            <MaterialIcons name="sort" size={16} color={colors.primary} style={{ marginRight: 2 }} />
            <Text style={[styles.sortBtnText, { color: colors.primary }]}>
              {sortBy === 'created_at' ? 'Date' : sortBy === 'file_size' ? 'Size' : 'Name'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
              setPage(1);
            }}
            style={{ padding: 4 }}
          >
            <MaterialIcons
              name={sortOrder === 'ASC' ? 'arrow-upward' : 'arrow-downward'}
              size={18}
              color={colors.primary}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (totalCount === 0) return null;
    return (
      <PaginationBar
        currentPage={page}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {mediaLoading && mediaItems.length === 0 ? (
        <ScreenLoader
          message={`Loading album items...`}
          subMessage="Rendering virtualized LegendList"
          icon="folder-special"
        />
      ) : mediaItems.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          {renderHeader()}
          <View style={styles.emptyStateBox}>
            <MaterialIcons name="folder-open" size={54} color={colors.outline} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              Album is Empty
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              No media items found matching current filters inside this album.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScreenTransition visible={!mediaLoading || mediaItems.length > 0}>
          <LegendList
            ref={legendListRef}
            key={`${layoutMode}-${numColumns}`}
            data={mediaItems}
            keyExtractor={(item: MediaItem) => item.id.toString()}
            renderItem={renderItem}
            numColumns={numColumns}
            estimatedItemSize={estimatedSize}
            recycleItems={true}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderFooter}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + Spacing.seven },
            ]}
            refreshing={isFetching}
            onRefresh={refetch}
          />
        </ScreenTransition>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingBottom: Spacing.two,
  },
  heroCard: {
    height: 160,
    borderRadius: Shapes.large,
    overflow: 'hidden',
    marginBottom: Spacing.three,
    marginTop: Spacing.two,
    borderWidth: 1,
    position: 'relative',
    ...Elevation.level2,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: Spacing.three,
    justifyContent: 'flex-end',
  },
  heroTopRow: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderIconBox: {
    width: 40,
    height: 40,
    borderRadius: Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  albumPath: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  albumDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  layoutToggleBtn: {
    width: 48,
    height: 48,
    borderRadius: Shapes.medium,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    paddingHorizontal: 4,
  },
  metricsLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  sortControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Shapes.small,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  emptyContainer: {
    flex: 1,
    padding: Spacing.four,
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: Spacing.two,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.one,
    lineHeight: 18,
  },
});
