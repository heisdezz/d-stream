import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSetAtom } from 'jotai';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useAppStore } from '@/store/use-app-store';
import { selectedAlbumIdAtom, selectedTagIdAtom } from '@/store/atoms';
import { useDebounce } from '@/hooks/use-debounce';
import { useAlbumsQuery, useTagsQuery } from '@/hooks/use-library-queries';
import { Spacing, Shapes, MaxContentWidth } from '@/constants/theme';
import { M3SegmentedRow, SegmentItem } from '@/components/material/m3-segmented-row';
import { M3SearchBar } from '@/components/material/m3-search-bar';
import { AlbumCard } from '@/components/media/album-card';
import { M3Card } from '@/components/material/m3-card';
import { M3Badge } from '@/components/material/m3-badge';
import { ScreenLoader } from '@/components/common/screen-loader';
import { MaterialIcons } from '@expo/vector-icons';
import { Album, Tag } from '@/types/models';

type CollectionTab = 'albums' | 'tags';

const collectionTabs: SegmentItem<CollectionTab>[] = [
  { value: 'albums', label: 'Albums', icon: 'folder-special' },
  { value: 'tags', label: 'Tags & Categories', icon: 'label' },
];

export default function AlbumsScreen() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [currentTab, setCurrentTab] = useState<CollectionTab>('albums');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  const setSelectedTagId = useSetAtom(selectedTagIdAtom);
  const setSelectedAlbumId = useSetAtom(selectedAlbumIdAtom);

  const { ip, port, status: syncStatus, stats, hasDatabase } = useAppStore();

  const {
    data: albumsData = [],
    isLoading: isAlbumsLoading,
    refetch: refetchAlbums,
  } = useAlbumsQuery();

  const {
    data: tagsData = [],
    isLoading: isTagsLoading,
    refetch: refetchTags,
  } = useTagsQuery();

  const handleRefresh = async () => {
    await Promise.all([refetchAlbums(), refetchTags()]);
  };

  const handleAlbumPress = (album: Album) => {
    router.push(`/album/${album.id}`);
  };

  const handleTagPress = (tag: Tag) => {
    setSelectedTagId(tag.id);
    setSelectedAlbumId(undefined);
    router.push('/media');
  };

  // Debounced search filtering for albums
  const filteredAlbums = useMemo(() => {
    if (!debouncedSearch.trim()) return albumsData;
    const q = debouncedSearch.toLowerCase().trim();
    return albumsData.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.relative_path && a.relative_path.toLowerCase().includes(q))
    );
  }, [albumsData, debouncedSearch]);

  // Debounced search filtering for tags
  const filteredTags = useMemo(() => {
    if (!debouncedSearch.trim()) return tagsData;
    const q = debouncedSearch.toLowerCase().trim();
    return tagsData.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q))
    );
  }, [tagsData, debouncedSearch]);

  const tagsByCategory = useMemo(() => {
    return filteredTags.reduce<Record<string, Tag[]>>((acc, tag) => {
      const cat = tag.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(tag);
      return acc;
    }, {});
  }, [filteredTags]);

  const isLoading = isAlbumsLoading || isTagsLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Controls */}
      <View style={styles.topBar}>
        <M3SegmentedRow
          items={collectionTabs}
          selectedValue={currentTab}
          onSelect={setCurrentTab}
          style={{ marginBottom: Spacing.two }}
        />

        <M3SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={
            currentTab === 'albums'
              ? 'Filter albums by name or folder path...'
              : 'Filter tags by category or name...'
          }
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + Spacing.seven },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {!hasDatabase && stats.total_items === 0 ? (
          <M3Card variant="filled" style={styles.emptyCard}>
            <MaterialIcons name="cloud-off" size={44} color={colors.outline} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              No Database Loaded
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              Sync with your desktop organizer server to view albums and tags.
            </Text>
          </M3Card>
        ) : currentTab === 'albums' ? (
          isLoading && albumsData.length === 0 ? (
            <ScreenLoader
              message="Loading album collections..."
              subMessage="Querying local SQLite database"
              icon="folder-special"
            />
          ) : filteredAlbums.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="folder-off" size={44} color={colors.outline} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                {debouncedSearch ? 'No matching albums found' : 'No albums found'}
              </Text>
            </View>
          ) : (
            <View>
              <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>
                {filteredAlbums.length} {filteredAlbums.length === 1 ? 'ALBUM' : 'ALBUMS'} AVAILABLE
              </Text>
              {filteredAlbums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  serverIp={syncStatus === 'connected' ? ip : undefined}
                  serverPort={port}
                  onPress={handleAlbumPress}
                />
              ))}
            </View>
          )
        ) : (
          /* Tags View */
          isLoading && tagsData.length === 0 ? (
            <ScreenLoader
              message="Loading taxonomy tags..."
              subMessage="Querying local SQLite database"
              icon="label"
            />
          ) : filteredTags.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="label-off" size={44} color={colors.outline} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                {debouncedSearch ? 'No matching tags found' : 'No tags found'}
              </Text>
            </View>
          ) : (
            <View>
              {Object.entries(tagsByCategory).map(([category, catTags]) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={[styles.categoryHeader, { color: colors.primary }]}>
                    {category.toUpperCase()}
                  </Text>
                  <View style={styles.tagsCloud}>
                    {catTags.map((tag) => (
                      <Pressable
                        key={tag.id}
                        onPress={() => handleTagPress(tag)}
                        style={({ pressed }) => [
                          styles.tagItem,
                          {
                            backgroundColor: colors.surfaceContainer,
                            borderColor: tag.color_hex || colors.outlineVariant,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <View
                          style={[
                            styles.tagColorDot,
                            { backgroundColor: tag.color_hex || colors.primary },
                          ]}
                        />
                        <Text style={[styles.tagName, { color: colors.onSurface }]}>
                          {tag.name}
                        </Text>
                        {tag.media_count !== undefined && (
                          <M3Badge
                            label={tag.media_count.toString()}
                            variant="surface"
                            size="small"
                            style={{ marginLeft: Spacing.one }}
                          />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.two,
  },
  categorySection: {
    marginBottom: Spacing.four,
  },
  categoryHeader: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: Spacing.two,
  },
  tagsCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Shapes.large,
    borderWidth: 1,
  },
  tagColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.one,
  },
  tagName: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
  emptyCard: {
    alignItems: 'center',
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
