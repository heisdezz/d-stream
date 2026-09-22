import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMaterialTheme } from "@/hooks/use-material-theme";
import { useAppStore } from "@/store/use-app-store";
import { DownloadedItemRecord } from "@/services/storage";
import { MediaItem } from "@/types/models";
import { Spacing, MaxContentWidth } from "@/constants/theme";
import { M3SearchBar } from "@/components/material/m3-search-bar";
import {
  M3SegmentedRow,
  SegmentItem,
} from "@/components/material/m3-segmented-row";
import { M3Button } from "@/components/material/m3-button";
import { M3Badge } from "@/components/material/m3-badge";
import { MediaGridItem } from "@/components/media/media-grid-item";
import { MaterialIcons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import tw from "@/lib/tailwind";

type DownloadFilterType = "all" | "image" | "video";
type ViewLayoutMode = "grid" | "grid3" | "list";

const filterSegments: SegmentItem<DownloadFilterType>[] = [
  { value: "all", label: "All", icon: "perm-media" },
  { value: "image", label: "Photos", icon: "image" },
  { value: "video", label: "Videos", icon: "videocam" },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function recordToMediaItem(record: DownloadedItemRecord): MediaItem {
  return {
    id: record.mediaId,
    file_hash: "",
    original_relative_path: record.fileName,
    current_relative_path: record.fileName,
    file_size: record.fileSize,
    mime_type: record.mimeType,
    duration_seconds: null,
    metadata_json: null,
    album_id: null,
    album_name: record.albumName,
    created_at: record.downloadedAt,
  };
}

export default function DownloadsScreen() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const {
    downloadedItems,
    downloadLocation,
    removeDownloadedMediaItem,
    refreshDownloadedItems,
    playAsShorts,
  } = useAppStore();

  useFocusEffect(
    useCallback(() => {
      refreshDownloadedItems();
    }, [refreshDownloadedItems]),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<DownloadFilterType>("all");
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>("grid");

  const recordsList = useMemo(() => {
    return Object.values(downloadedItems);
  }, [downloadedItems]);

  const totalBytesUsed = useMemo(() => {
    return recordsList.reduce((acc, curr) => acc + (curr.fileSize || 0), 0);
  }, [recordsList]);

  const filteredRecords = useMemo(() => {
    let list = recordsList;

    if (filterType === "image") {
      list = list.filter((r) => r.mimeType?.startsWith("image/"));
    } else if (filterType === "video") {
      list = list.filter((r) => r.mimeType?.startsWith("video/"));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.fileName.toLowerCase().includes(q) ||
          r.albumName?.toLowerCase().includes(q),
      );
    }

    return list.sort(
      (a, b) =>
        new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime(),
    );
  }, [recordsList, filterType, searchQuery]);

  const handleMediaPress = (mediaItem: MediaItem) => {
    if (playAsShorts) {
      router.push({
        pathname: "/shorts",
        params: { mediaId: mediaItem.id.toString(), mode: "downloads" },
      });
    } else {
      router.push(`/media/${mediaItem.id}` as any);
    }
  };

  const handleDeleteItem = (record: DownloadedItemRecord) => {
    Alert.alert(
      "Delete Download",
      `Are you sure you want to remove "${record.fileName}" from device storage?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await removeDownloadedMediaItem(record.mediaId);
            toast.info(`Deleted ${record.fileName}`);
          },
        },
      ],
    );
  };

  const handleClearAll = () => {
    if (recordsList.length === 0) return;
    Alert.alert(
      "Delete All Downloads",
      `This will remove all ${recordsList.length} downloaded media files (${formatBytes(totalBytesUsed)}) from your device storage.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            for (const item of recordsList) {
              await removeDownloadedMediaItem(item.mediaId);
            }
            toast.info("All downloaded files cleared from device.");
          },
        },
      ],
    );
  };

  const contentWidth = Math.min(width - Spacing.four * 2, MaxContentWidth);
  const gridItemWidth =
    layoutMode === "grid3"
      ? (contentWidth - Spacing.two * 2) / 3
      : (contentWidth - Spacing.two) / 2;

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.background }]}>
      {/* Top Search & Filter Bar */}
      <View style={tw`px-4 pt-2 pb-2`}>
        <M3SearchBar
          value={searchQuery}
          onSearch={setSearchQuery}
          placeholder="Search downloaded files or albums..."
          style={{ marginBottom: Spacing.two }}
        />

        <View style={tw`flex-row items-center`}>
          <M3SegmentedRow
            items={filterSegments}
            selectedValue={filterType}
            onSelect={setFilterType}
            style={{ flex: 1, marginRight: Spacing.two }}
          />

          {/* Layout Toggle Button */}
          <Pressable
            onPress={() => {
              if (layoutMode === "grid") setLayoutMode("grid3");
              else if (layoutMode === "grid3") setLayoutMode("list");
              else setLayoutMode("grid");
            }}
            style={({ pressed }) => [
              tw`w-11 h-11 rounded-xl items-center justify-center border`,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialIcons
              name={
                layoutMode === "grid"
                  ? "grid-view"
                  : layoutMode === "grid3"
                    ? "view-comfy"
                    : "view-agenda"
              }
              size={20}
              color={colors.onSurface}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          tw`px-4 pt-2`,
          { paddingBottom: insets.bottom + Spacing.seven },
        ]}
      >
        {/* Offline Summary Card */}
        <View
          style={[
            tw`p-4 mb-4 rounded-2xl border shadow-sm`,
            {
              backgroundColor: colors.surfaceContainer,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <View style={tw`flex-row items-center mb-3`}>
            <View
              style={tw`w-11 h-11 rounded-full items-center justify-center mr-3 bg-emerald-500/15`}
            >
              <MaterialIcons name="offline-pin" size={26} color="#10B981" />
            </View>

            <View style={tw`flex-1`}>
              <View style={tw`flex-row items-center gap-2 mb-0.5`}>
                <Text
                  style={[
                    tw`text-base font-extrabold`,
                    { color: colors.onSurface },
                  ]}
                >
                  Offline Media Vault
                </Text>
                <M3Badge label="OFFLINE READY" variant="primary" size="small" />
              </View>

              <Text style={[tw`text-xs`, { color: colors.outline }]}>
                {recordsList.length} files saved • {formatBytes(totalBytesUsed)}{" "}
                on device
              </Text>
            </View>

            {recordsList.length > 0 && (
              <View style={tw`flex-row items-center gap-1`}>
                <Pressable
                  onPress={() => {
                    const first = recordsList[0];
                    if (first) {
                      router.push({
                        pathname: "/shorts",
                        params: { mediaId: first.mediaId.toString(), mode: "downloads" },
                      });
                    }
                  }}
                  style={({ pressed }) => [
                    tw`p-2`,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <MaterialIcons
                    name="movie-filter"
                    size={22}
                    color={colors.primary}
                  />
                </Pressable>
                <Pressable
                  onPress={handleClearAll}
                  style={({ pressed }) => [
                    tw`p-2`,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <MaterialIcons
                    name="delete-sweep"
                    size={22}
                    color={colors.error}
                  />
                </Pressable>
              </View>
            )}
          </View>

          <View
            style={[
              tw`flex-row items-center px-3 py-2 rounded-lg`,
              { backgroundColor: colors.surfaceContainerLow },
            ]}
          >
            <MaterialIcons
              name="folder"
              size={16}
              color={colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[tw`text-xs flex-1`, { color: colors.onSurfaceVariant }]}
              numberOfLines={1}
            >
              Folder:{" "}
              <Text style={{ fontWeight: "700", color: colors.onSurface }}>
                {downloadLocation}
              </Text>
            </Text>
          </View>
        </View>

        {/* Empty State */}
        {filteredRecords.length === 0 ? (
          <View style={tw`items-center justify-center py-16 px-4`}>
            <View
              style={[
                tw`w-20 h-20 rounded-full items-center justify-center mb-4`,
                { backgroundColor: colors.surfaceContainerHigh },
              ]}
            >
              <MaterialIcons
                name={searchQuery ? "search-off" : "cloud-download"}
                size={44}
                color={colors.outline}
              />
            </View>

            <Text
              style={[
                tw`text-lg font-extrabold mb-2 text-center`,
                { color: colors.onSurface },
              ]}
            >
              {searchQuery
                ? "No matching offline files"
                : "No files downloaded yet"}
            </Text>

            <Text
              style={[
                tw`text-sm text-center max-w-xs leading-5`,
                { color: colors.outline },
              ]}
            >
              {searchQuery
                ? `No downloaded files matched "${searchQuery}". Try another keyword.`
                : "Download photos and videos from the Explorer to play and view them anywhere without requiring a Wi-Fi or LAN connection."}
            </Text>

            {!searchQuery && (
              <M3Button
                label="Explore Media"
                icon="perm-media"
                variant="filled"
                onPress={() => router.push("/media" as any)}
                style={{ marginTop: Spacing.four }}
              />
            )}
          </View>
        ) : layoutMode === "list" ? (
          /* List View styled with twrnc */
          <View style={tw`gap-2`}>
            {filteredRecords.map((record) => {
              const mediaItem = recordToMediaItem(record);
              const isVideo = record.mimeType?.startsWith("video/");
              return (
                <Pressable
                  key={record.mediaId}
                  onPress={() => handleMediaPress(mediaItem)}
                  style={({ pressed }) => [
                    tw`flex-row items-center p-3 rounded-xl border`,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.outlineVariant,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      tw`w-11 h-11 rounded-lg items-center justify-center mr-3`,
                      {
                        backgroundColor: isVideo
                          ? colors.tertiaryContainer
                          : colors.primaryContainer,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={isVideo ? "videocam" : "image"}
                      size={24}
                      color={
                        isVideo
                          ? colors.onTertiaryContainer
                          : colors.onPrimaryContainer
                      }
                    />
                  </View>

                  <View style={tw`flex-1`}>
                    <Text
                      style={[
                        tw`text-sm font-bold mb-0.5`,
                        { color: colors.onSurface },
                      ]}
                      numberOfLines={1}
                    >
                      {record.fileName}
                    </Text>

                    <Text
                      style={[tw`text-xs mb-0.5`, { color: colors.outline }]}
                      numberOfLines={1}
                    >
                      {record.albumName || "General"} •{" "}
                      {formatBytes(record.fileSize)}
                    </Text>

                    <Text
                      style={[tw`text-[11px]`, { color: colors.outline }]}
                      numberOfLines={1}
                    >
                      Downloaded{" "}
                      {new Date(record.downloadedAt).toLocaleDateString()}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleDeleteItem(record)}
                    style={({ pressed }) => [
                      tw`p-2`,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <MaterialIcons
                      name="delete-outline"
                      size={22}
                      color={colors.error}
                    />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        ) : (
          /* Grid View */
          <View style={tw`flex-row flex-wrap justify-between`}>
            {filteredRecords.map((record) => {
              const mediaItem = recordToMediaItem(record);
              return (
                <View
                  key={record.mediaId}
                  style={{
                    width: gridItemWidth,
                    marginBottom: Spacing.two,
                  }}
                >
                  <MediaGridItem
                    item={mediaItem}
                    onPress={handleMediaPress}
                    width={gridItemWidth}
                    aspectRatio={layoutMode === "grid3" ? 1 : 1}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
