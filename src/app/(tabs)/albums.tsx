import React, { useState } from 'react';
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
import { Spacing, Shapes, MaxContentWidth } from '@/constants/theme';
import { M3SegmentedRow, SegmentItem } from '@/components/material/m3-segmented-row';
import { AlbumCard } from '@/components/media/album-card';
import { M3Card } from '@/components/material/m3-card';
import { M3Badge } from '@/components/material/m3-badge';
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

  const setSelectedAlbumId = useSetAtom(selectedAlbumIdAtom);
  const setSelectedTagId = useSetAtom(selectedTagIdAtom);

  const {
    ip,
    port,
    status: syncStatus,
    albums,
    tags,
    stats,
    hasDatabase,
    isRefreshing,
    refreshLibrary,
  } = useAppStore();

  const handleAlbumPress = (album: Album) => {
    setSelectedAlbumId(album.id);
    setSelectedTagId(undefined);
    router.push('/media');
  };

  const handleTagPress = (tag: Tag) => {
    setSelectedTagId(tag.id);
    setSelectedAlbumId(undefined);
    router.push('/media');
  };

  const tagsByCategory = tags.reduce<Record<string, Tag[]>>((acc, tag) => {
    const cat = tag.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {});

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Tab Bar */}
      <View style={styles.topBar}>
        <M3SegmentedRow
          items={collectionTabs}
          selectedValue={currentTab}
          onSelect={setCurrentTab}
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
            refreshing={isRefreshing}
            onRefresh={refreshLibrary}
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
          albums.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="folder-off" size={44} color={colors.outline} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                No albums found
              </Text>
            </View>
          ) : (
            <View>
              <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>
                {albums.length} ALBUMS AVAILABLE
              </Text>
              {albums.map((album) => (
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
          tags.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="label-off" size={44} color={colors.outline} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                No tags found
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
