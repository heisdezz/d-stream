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
import tw from "twrnc";

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
      <Text
        style={[
          tw`text-xs font-extrabold tracking-wider mb-2 mt-1`,
          { color: colors.onSurfaceVariant },
        ]}
      >
        {filteredAlbums.length}{" "}
        {filteredAlbums.length === 1 ? "ALBUM" : "ALBUMS"} AVAILABLE
      </Text>
    );
  }, [filteredAlbums.length, colors.onSurfaceVariant]);

  const isServerReady = hasDatabase || stats.total_items > 0;

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.background }]}>
      {/* Top Controls */}
      <View style={styles.topBar}>
        <M3SegmentedRow
          items={collectionTabs}
          selectedValue={currentTab}
          onSelect={setCurrentTab}
          style={tw`mb-2`}
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
          <M3Card
            variant="filled"
            style={tw`p-6 items-center justify-center rounded-2xl`}
          >
            <MaterialIcons name="cloud-off" size={44} color={colors.outline} />
            <Text
              style={[
                tw`text-base font-bold mt-2`,
                { color: colors.onSurface },
              ]}
            >
              No Database Loaded
            </Text>
            <Text
              style={[
                tw`text-xs text-center mt-1`,
                { color: colors.onSurfaceVariant },
              ]}
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
              tw`flex-1 w-full`,
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
              <View style={tw`py-12 items-center justify-center`}>
                <MaterialIcons
                  name="folder-off"
                  size={44}
                  color={colors.outline}
                />
                <Text
                  style={[
                    tw`text-base font-bold mt-2`,
                    { color: colors.onSurface },
                  ]}
                >
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
              tw`flex-1 w-full`,
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
              <View style={tw`py-12 items-center justify-center`}>
                <MaterialIcons
                  name="label-off"
                  size={44}
                  color={colors.outline}
                />
                <Text
                  style={[
                    tw`text-base font-bold mt-2`,
                    { color: colors.onSurface },
                  ]}
                >
                  {searchQuery ? "No matching tags found" : "No tags found"}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={tw`flex-1`}
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
                  <View key={category} style={tw`mb-4`}>
                    <Text
                      style={[
                        tw`text-xs font-extrabold tracking-wider mb-2`,
                        { color: colors.primary },
                      ]}
                    >
                      {category.toUpperCase()}
                    </Text>
                    <View style={tw`flex-row flex-wrap gap-1.5`}>
                      {catTags.map((tag) => (
                        <Pressable
                          key={tag.id}
                          onPress={() => handleTagPress(tag)}
                          style={({ pressed }) => [
                            tw`flex-row items-center py-1.5 px-3 rounded-full border`,
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
                              tw`w-2 h-2 rounded-full mr-1.5`,
                              {
                                backgroundColor:
                                  tag.color_hex || colors.primary,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              tw`text-xs font-semibold`,
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
                              style={tw`ml-1`}
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
  topBar: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
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
});
