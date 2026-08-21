import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  Pressable,
  ScrollView,
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
  currentPageAtom,
  pageSizeAtom,
  MediaTypeFilter,
  ViewLayoutMode,
} from '@/store/atoms';
import { Spacing, Shapes, MaxContentWidth } from '@/constants/theme';
import { M3SearchBar } from '@/components/material/m3-search-bar';
import { M3SegmentedRow, SegmentItem } from '@/components/material/m3-segmented-row';
import { M3Chip } from '@/components/material/m3-chip';
import { M3Button } from '@/components/material/m3-button';
import { M3Card } from '@/components/material/m3-card';
import { MediaGridItem } from '@/components/media/media-grid-item';
import { MediaListItem } from '@/components/media/media-list-item';
import { PaginationBar } from '@/components/media/pagination-bar';
import { MediaItem } from '@/types/models';
import { MaterialIcons } from '@expo/vector-icons';

const typeSegments: SegmentItem<MediaTypeFilter>[] = [
  { value: 'all', label: 'All', icon: 'perm-media' },
  { value: 'image', label: 'Photos', icon: 'image' },
  { value: 'video', label: 'Videos', icon: 'videocam' },
];

export default function MediaExplorerScreen() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);

  // Jotai atomic state
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [type, setType] = useAtom(mediaTypeFilterAtom);
  const [selectedAlbumId, setSelectedAlbumId] = useAtom(selectedAlbumIdAtom);
  const [selectedTagId, setSelectedTagId] = useAtom(selectedTagIdAtom);
  const [sortBy, setSortBy] = useAtom(sortByAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  const [layoutMode, setLayoutMode] = useAtom(viewModeAtom);
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom);
  const [pageSize, setPageSize] = useAtom(pageSizeAtom);

  // Zustand global store
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
    fetchMediaPage,
    updatePageSize,
  } = useAppStore();

  useEffect(() => {
    fetchMediaPage({
      query,
      type,
      albumId: selectedAlbumId,
      tagId: selectedTagId,
      sortBy,
      sortOrder,
      page: currentPage,
      pageSize,
    });
  }, [
    query,
    type,
    selectedAlbumId,
    selectedTagId,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
    fetchMediaPage,
  ]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    updatePageSize(newSize);
    setCurrentPage(1);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleTypeChange = (newType: MediaTypeFilter) => {
    setType(newType);
    setCurrentPage(1);
  };

  const handleMediaPress = (item: MediaItem) => {
    router.push(`/media/${item.id}`);
  };

  const toggleLayoutMode = () => {
    if (layoutMode === 'grid') setLayoutMode('grid3');
    else if (layoutMode === 'grid3') setLayoutMode('list');
    else setLayoutMode('grid');
  };

  const activeAlbum = albums.find((a) => a.id === selectedAlbumId);
  const activeTag = tags.find((t) => t.id === selectedTagId);

  const contentWidth = Math.min(width - Spacing.four * 2, MaxContentWidth);
  const numColumns = layoutMode === 'list' ? 1 : layoutMode === 'grid3' ? 3 : 2;
  const gridItemWidth =
    layoutMode === 'grid3'
      ? (contentWidth - Spacing.two * 2) / 3
      : (contentWidth - Spacing.two) / 2;

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
      <View
        style={{
          width: gridItemWidth,
          marginRight: layoutMode === 'grid3' ? Spacing.one + 2 : Spacing.two,
        }}
      >
        <MediaGridItem
          item={item}
          onPress={handleMediaPress}
          width={gridItemWidth}
          serverIp={syncStatus === 'connected' ? ip : undefined}
          serverPort={port}
          aspectRatio={layoutMode === 'grid3' ? 1 : 1.1}
        />
      </View>
    );
  };

  const renderListHeader = () => (
    <View style={styles.headerBlock}>
      {/* Docked Search & View Toggle Bar */}
      <View style={styles.searchRow}>
        <M3SearchBar
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setCurrentPage(1);
          }}
          placeholder="Search media by filename or path..."
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
        onSelect={handleTypeChange}
        style={{ marginTop: Spacing.two }}
      />

      {/* Album & Tag Quick Chips Row */}
      {(albums.length > 0 || tags.length > 0) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalChipsScroll}
          style={{ marginTop: Spacing.two }}
        >
          {/* Clear Filters Chip */}
          {(selectedAlbumId !== undefined || selectedTagId !== undefined) && (
            <M3Chip
              label="Clear Filter"
              icon="clear"
              selected
              onPress={() => {
                setSelectedAlbumId(undefined);
                setSelectedTagId(undefined);
                setCurrentPage(1);
              }}
              style={{ marginRight: Spacing.one }}
            />
          )}

          {/* Active Album Chip */}
          {activeAlbum && (
            <M3Chip
              label={`Album: ${activeAlbum.name}`}
              icon="folder"
              selected
              onPress={() => {
                setSelectedAlbumId(undefined);
                setCurrentPage(1);
              }}
              style={{ marginRight: Spacing.one }}
            />
          )}

          {/* Active Tag Chip */}
          {activeTag && (
            <M3Chip
              label={`Tag: ${activeTag.name}`}
              colorHex={activeTag.color_hex}
              selected
              onPress={() => {
                setSelectedTagId(undefined);
                setCurrentPage(1);
              }}
              style={{ marginRight: Spacing.one }}
            />
          )}

          {/* Quick Album Selector Chips */}
          {selectedAlbumId === undefined &&
            albums.slice(0, 8).map((alb) => (
              <M3Chip
                key={alb.id}
                label={`${alb.name} (${alb.media_count})`}
                icon="folder"
                onPress={() => {
                  setSelectedAlbumId(alb.id);
                  setCurrentPage(1);
                }}
                style={{ marginRight: Spacing.one }}
              />
            ))}
        </ScrollView>
      )}

      {/* Metrics Bar & Sort Controls */}
      <View style={styles.metricsBar}>
        <Text style={[styles.resultsLabel, { color: colors.onSurfaceVariant }]}>
          {totalMediaCount.toLocaleString()}{' '}
          {type === 'image' ? 'Photos' : type === 'video' ? 'Videos' : 'Total Items'}
        </Text>

        <View style={styles.sortControlsRow}>
          <Pressable
            onPress={() => {
              if (sortBy === 'created_at') setSortBy('file_size');
              else if (sortBy === 'file_size') setSortBy('current_relative_path');
              else setSortBy('created_at');
              setCurrentPage(1);
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
              setCurrentPage(1);
            }}
            style={styles.orderBtn}
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

  const renderListFooter = () => {
    if (totalMediaCount === 0) return null;
    return (
      <PaginationBar
        currentPage={currentPage}
        totalItems={totalMediaCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!hasDatabase && stats.total_items === 0 ? (
        <View style={styles.emptyContainer}>
          <M3Card variant="filled" style={styles.emptyCard}>
            <MaterialIcons name="cloud-off" size={48} color={colors.outline} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              No Offline Database
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              Connect to your external drive sync server over LAN and download the library database to search and view offline.
            </Text>
            <M3Button
              label="Open Sync Settings"
              icon="sync"
              variant="filled"
              style={{ marginTop: Spacing.three }}
              onPress={() => router.push('/sync')}
            />
          </M3Card>
        </View>
      ) : mediaItems.length === 0 && !isLoading ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          {renderListHeader()}
          <View style={styles.noResultsBox}>
            <MaterialIcons name="search-off" size={54} color={colors.outline} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              No items matching filters
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              Try clearing your search query or selecting a different album / media category.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          key={`${layoutMode}-${numColumns}`}
          data={mediaItems}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          numColumns={numColumns}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderListFooter}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.seven },
          ]}
          refreshing={isRefreshing}
          onRefresh={() => {
            fetchMediaPage({
              query,
              type,
              albumId: selectedAlbumId,
              tagId: selectedTagId,
              sortBy,
              sortOrder,
              page: currentPage,
              pageSize,
            });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBlock: {
    paddingBottom: Spacing.two,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  layoutToggleBtn: {
    width: 48,
    height: 48,
    borderRadius: Shapes.medium,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  horizontalChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    paddingHorizontal: 4,
  },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
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
  orderBtn: {
    padding: 4,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    width: '100%',
    maxWidth: 420,
  },
  noResultsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
  emptyTitle: {
    fontSize: 16,
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
