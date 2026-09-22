import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  FlatList,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSetAtom } from "jotai";
import { useMaterialTheme } from "@/hooks/use-material-theme";
import { useAppStore } from "@/store/use-app-store";
import { selectedAlbumIdAtom, selectedTagIdAtom } from "@/store/atoms";
import { useAlbumsQuery, useTagsQuery } from "@/hooks/use-library-queries";
import { Spacing, Shapes, MaxContentWidth } from "@/constants/theme";
import {
  M3SegmentedRow,
  SegmentItem,
} from "@/components/material/m3-segmented-row";
import { M3SearchBar } from "@/components/material/m3-search-bar";
import { AlbumCard } from "@/components/media/album-card";
import { M3Card } from "@/components/material/m3-card";
import { M3Badge } from "@/components/material/m3-badge";
import { ScreenLoader } from "@/components/common/screen-loader";
import { MaterialIcons } from "@expo/vector-icons";
import { Album, Tag } from "@/types/models";

type CollectionTab = "albums" | "tags";

const collectionTabs: SegmentItem<CollectionTab>[] = [
  { value: "albums", label: "Albums", icon: "folder-special" },
  { value: "tags", label: "Tags & Categories", icon: "label" },
];

export default function AlbumsScreen() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [currentTab, setCurrentTab] = useState<CollectionTab>("albums");
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchAlbums(), refetchTags()]);
  }, [refetchAlbums, refetchTags]);

  const handleAlbumPress = useCallback(
    (album: Album) => {
      router.push(`/album/${album.id}`);
    },
    [router],
  );

  const handleTagPress = useCallback(
    (tag: Tag) => {
      setSelectedTagId(tag.id);
      setSelectedAlbumId(undefined);
      router.push("/media");
    },
    [router, setSelectedTagId, setSelectedAlbumId],
  );

  // Debounced search filtering for albums
  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return albumsData;
    const q = searchQuery.toLowerCase().trim();
    return albumsData.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.relative_path && a.relative_path.toLowerCase().includes(q)),
    );
  }, [albumsData, searchQuery]);

  // Debounced search filtering for tags
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tagsData;
    const q = searchQuery.toLowerCase().trim();
    return tagsData.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q)),
    );
  }, [tagsData, searchQuery]);

  const tagsByCategory = useMemo(() => {
    return filteredTags.reduce<Record<string, Tag[]>>((acc, tag) => {
      const cat = tag.category || "General";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(tag);
      return acc;
    }, {});
  }, [filteredTags]);

  const isLoading = isAlbumsLoading || isTagsLoading;

  const renderAlbumItem = useCallback(
    ({ item }: { item: Album }) => (
      <AlbumCard
        album={item}
        serverIp={syncStatus === "connected" ? ip : undefined}
        serverPort={port}
        onPress={handleAlbumPress}
      />
    ),
    [syncStatus, ip, port, handleAlbumPress],
  );

  const albumListHeader = useMemo(() => {
    if (filteredAlbums.length === 0) return null;
    return (
      <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>
        {filteredAlbums.length}{" "}
        {filteredAlbums.length === 1 ? "ALBUM" : "ALBUMS"} AVAILABLE
      </Text>
    );
  }, [filteredAlbums.length, colors.onSurfaceVariant]);

  const isServerReady = hasDatabase || stats.total_items > 0;

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
          value={searchQuery}
          onSearch={setSearchQuery}
          placeholder={
            currentTab === "albums"
              ? "Filter albums by name or folder..."
              : "Filter tags by category or name..."
          }
        />
      </View>

      {!isServerReady ? (
        <View style={styles.emptyContainer}>
          <M3Card variant="filled" style={styles.emptyCard}>
            <MaterialIcons name="cloud-off" size={44} color={colors.outline} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              No Database Loaded
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}
            >
              Sync with your desktop organizer server to view albums and tags.
            </Text>
          </M3Card>
        </View>
      ) : (
        <>
          {/* Albums Virtualized Tab View (Kept mounted for zero tab-switch lag) */}
          <View
            style={[
              styles.tabPanel,
              { display: currentTab === "albums" ? "flex" : "none" },
            ]}
          >
            {isAlbumsLoading && albumsData.length === 0 ? (
              <ScreenLoader
                message="Loading album collections..."
                subMessage="Querying local SQLite database"
                icon="folder-special"
              />
            ) : filteredAlbums.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons
                  name="folder-off"
                  size={44}
                  color={colors.outline}
                />
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                  {searchQuery ? "No matching albums found" : "No albums found"}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredAlbums}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderAlbumItem}
                ListHeaderComponent={albumListHeader}
                contentContainerStyle={[
                  styles.contentContainer,
                  { paddingBottom: insets.bottom + Spacing.seven },
                ]}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={5}
                removeClippedSubviews={Platform.OS === "android"}
                refreshControl={
                  <RefreshControl
                    refreshing={isAlbumsLoading}
                    onRefresh={handleRefresh}
                    colors={[colors.primary]}
                    tintColor={colors.primary}
                  />
                }
              />
            )}
          </View>

          {/* Tags Tab View (Kept mounted for zero tab-switch lag) */}
          <View
            style={[
              styles.tabPanel,
              { display: currentTab === "tags" ? "flex" : "none" },
            ]}
          >
            {isTagsLoading && tagsData.length === 0 ? (
              <ScreenLoader
                message="Loading taxonomy tags..."
                subMessage="Querying local SQLite database"
                icon="label"
              />
            ) : filteredTags.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons
                  name="label-off"
                  size={44}
                  color={colors.outline}
                />
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                  {searchQuery ? "No matching tags found" : "No tags found"}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                  styles.contentContainer,
                  { paddingBottom: insets.bottom + Spacing.seven },
                ]}
                refreshControl={
                  <RefreshControl
                    refreshing={isTagsLoading}
                    onRefresh={handleRefresh}
                    colors={[colors.primary]}
                    tintColor={colors.primary}
                  />
                }
              >
                {Object.entries(tagsByCategory).map(([category, catTags]) => (
                  <View key={category} style={styles.categorySection}>
                    <Text
                      style={[styles.categoryHeader, { color: colors.primary }]}
                    >
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
                              borderColor:
                                tag.color_hex || colors.outlineVariant,
                            },
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <View
                            style={[
                              styles.tagColorDot,
                              {
                                backgroundColor:
                                  tag.color_hex || colors.primary,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.tagName,
                              { color: colors.onSurface },
                            ]}
                          >
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
              </ScrollView>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  tabPanel: {
    flex: 1,
    width: "100%",
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  emptyContainer: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: Spacing.two,
    marginTop: Spacing.one,
  },
  emptyState: {
    paddingVertical: Spacing.seven,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
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
  },
  categorySection: {
    marginBottom: Spacing.three,
  },
  categoryHeader: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: Spacing.one,
  },
  tagsCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  tagItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Shapes.full,
    borderWidth: 1,
  },
  tagColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  tagName: {
    fontSize: 13,
    fontWeight: "600",
  },
});
