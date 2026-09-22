import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useWindowDimensions,
  Platform,
  Share,
  Modal,
  ActivityIndicator,
  Animated,
  StatusBar,
  ViewToken,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { MaterialIcons } from "@expo/vector-icons";
import { toast } from "sonner-native";

import { useMaterialTheme } from "@/hooks/use-material-theme";
import { useAppStore } from "@/store/use-app-store";
import { getMediaItems, getMediaItemById } from "@/services/local-db";
import { getMediaStreamUrl, getThumbnailUrl } from "@/services/sync-api";
import { MediaItem } from "@/types/models";
import { DownloadProgress } from "@/services/downloader";
import { Spacing, Shapes } from "@/constants/theme";
import { M3Badge } from "@/components/material/m3-badge";
import { M3Button } from "@/components/material/m3-button";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

interface ShortsMediaCardProps {
  item: MediaItem;
  isActive: boolean;
  isNeighbor: boolean;
  isMuted: boolean;
  containerHeight: number;
  containerWidth: number;
  serverIp: string;
  serverPort: number;
  isConnected: boolean;
  isDownloaded: boolean;
  localUri?: string;
  activeDownload?: DownloadProgress;
  onToggleMute: () => void;
  onOpenDetails: (item: MediaItem) => void;
  onLike: (itemId: number) => void;
  isLiked: boolean;
  onShare: (item: MediaItem) => void;
  onDownload: (item: MediaItem) => void;
  onOpenInspector: (itemId: number) => void;
  onBack: () => void;
  contextLabel: string;
  currentIndex: number;
  totalCount: number;
}

const ShortsMediaCard = React.memo(function ShortsMediaCard({
  item,
  isActive,
  isNeighbor,
  isMuted,
  containerHeight,
  containerWidth,
  serverIp,
  serverPort,
  isConnected,
  isDownloaded,
  localUri,
  activeDownload,
  onToggleMute,
  onOpenDetails,
  onLike,
  isLiked,
  onShare,
  onDownload,
  onOpenInspector,
  onBack,
  contextLabel,
  currentIndex,
  totalCount,
}: ShortsMediaCardProps) {
  const insets = useSafeAreaInsets();
  const isVideo = item.mime_type.startsWith("video/");
  const lastTapRef = useRef<number>(0);

  // Play/Pause icon animation
  const [playPauseState, setPlayPauseState] = useState<"playing" | "paused" | null>(null);
  const playPauseOpacity = useRef(new Animated.Value(0)).current;

  // Heart burst animation for double-tap
  const [showHeartBurst, setShowHeartBurst] = useState<boolean>(false);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(1)).current;

  // Video source determination
  const streamUrl = useMemo(() => {
    if (!serverIp || !serverPort) return "";
    return getMediaStreamUrl(serverIp, serverPort, item.id);
  }, [serverIp, serverPort, item.id]);

  const thumbnailUrl = useMemo(() => {
    if (!serverIp || !serverPort) return "";
    return getThumbnailUrl(serverIp, serverPort, item.id);
  }, [serverIp, serverPort, item.id]);

  const playUri = useMemo(() => {
    if (localUri) return localUri;
    if (isConnected && streamUrl) return streamUrl;
    return null;
  }, [localUri, isConnected, streamUrl]);

  // Video Player - only load decoder for active and immediate neighbor
  const shouldLoadPlayer = isVideo && playUri && (isActive || isNeighbor);
  const player = useVideoPlayer(shouldLoadPlayer ? playUri : null, (p) => {
    p.loop = true;
    p.muted = isMuted;
    if (isActive) {
      p.play();
    }
  });

  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
    if (isActive) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [isActive, isMuted, player]);

  const triggerHeartAnimation = () => {
    setShowHeartBurst(true);
    heartScale.setValue(0.3);
    heartOpacity.setValue(1);

    Animated.parallel([
      Animated.spring(heartScale, {
        toValue: 1.3,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.timing(heartOpacity, {
        toValue: 0,
        duration: 750,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHeartBurst(false);
    });
  };

  const handleScreenPress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap -> Like!
      onLike(item.id);
      triggerHeartAnimation();
    } else {
      // Single tap -> Toggle play/pause for video
      if (isVideo && player) {
        if (player.playing) {
          player.pause();
          setPlayPauseState("paused");
        } else {
          player.play();
          setPlayPauseState("playing");
        }

        playPauseOpacity.setValue(1);
        Animated.timing(playPauseOpacity, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }).start(() => setPlayPauseState(null));
      }
    }
    lastTapRef.current = now;
  };

  const parsedMetadata = useMemo(() => {
    if (!item.metadata_json) return null;
    try {
      return JSON.parse(item.metadata_json);
    } catch {
      return null;
    }
  }, [item.metadata_json]);

  const resolution = parsedMetadata?.width && parsedMetadata?.height
    ? `${parsedMetadata.width}×${parsedMetadata.height}`
    : null;

  return (
    <View style={[styles.cardContainer, { width: containerWidth, height: containerHeight }]}>
      {/* Background Media Area */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleScreenPress}
      >
        {isVideo ? (
          shouldLoadPlayer && player ? (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              nativeControls={false}
            />
          ) : (
            <Image
              source={{ uri: thumbnailUrl || playUri || undefined }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={200}
            />
          )
        ) : (
          <Image
            source={{ uri: playUri || thumbnailUrl || undefined }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
          />
        )}
      </Pressable>

      {/* Play/Pause Center Indicator */}
      {playPauseState && (
        <Animated.View
          style={[
            styles.centerAnimBox,
            { opacity: playPauseOpacity },
          ]}
          pointerEvents="none"
        >
          <View style={styles.centerAnimCircle}>
            <MaterialIcons
              name={playPauseState === "playing" ? "play-arrow" : "pause"}
              size={54}
              color="#FFFFFF"
            />
          </View>
        </Animated.View>
      )}

      {/* Double Tap Heart Burst */}
      {showHeartBurst && (
        <Animated.View
          style={[
            styles.centerAnimBox,
            {
              transform: [{ scale: heartScale }],
              opacity: heartOpacity,
            },
          ]}
          pointerEvents="none"
        >
          <MaterialIcons name="favorite" size={96} color="#FF2D55" />
        </Animated.View>
      )}

      {/* Top Header Overlay */}
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + Spacing.two },
        ]}
      >
        <Pressable
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.iconCircleBtn}
        >
          <MaterialIcons name="close" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {contextLabel}
          </Text>
          <Text style={styles.headerCounter}>
            {currentIndex + 1} of {totalCount}
          </Text>
        </View>

        <Pressable
          onPress={() => onOpenInspector(item.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.iconCircleBtn}
        >
          <MaterialIcons name="open-in-new" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Floating Right Action Rail (TikTok / Reels style) */}
      <View
        style={[
          styles.rightRail,
          { bottom: insets.bottom + Spacing.seven + 30 },
        ]}
      >
        {/* Like Button */}
        <Pressable
          onPress={() => {
            onLike(item.id);
            if (!isLiked) triggerHeartAnimation();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.actionItem}
        >
          <View
            style={[
              styles.actionIconBox,
              isLiked && { backgroundColor: "rgba(255, 45, 85, 0.25)" },
            ]}
          >
            <MaterialIcons
              name={isLiked ? "favorite" : "favorite-border"}
              size={26}
              color={isLiked ? "#FF2D55" : "#FFFFFF"}
            />
          </View>
          <Text style={styles.actionLabel}>
            {isLiked ? "Liked" : "Like"}
          </Text>
        </Pressable>

        {/* Audio Mute/Unmute Toggle (Video only) */}
        {isVideo && (
          <Pressable
            onPress={onToggleMute}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.actionItem}
          >
            <View style={styles.actionIconBox}>
              <MaterialIcons
                name={isMuted ? "volume-off" : "volume-up"}
                size={24}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.actionLabel}>
              {isMuted ? "Muted" : "Audio"}
            </Text>
          </Pressable>
        )}

        {/* Download Offline Button */}
        <Pressable
          onPress={() => onDownload(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.actionItem}
        >
          <View
            style={[
              styles.actionIconBox,
              isDownloaded && { backgroundColor: "rgba(16, 185, 129, 0.3)" },
            ]}
          >
            {activeDownload ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons
                name={isDownloaded ? "check-circle" : "file-download"}
                size={25}
                color={isDownloaded ? "#34D399" : "#FFFFFF"}
              />
            )}
          </View>
          <Text style={styles.actionLabel}>
            {activeDownload
              ? `${activeDownload.percentage}%`
              : isDownloaded
                ? "Saved"
                : "Save"}
          </Text>
        </Pressable>

        {/* Metadata Details Sheet Button */}
        <Pressable
          onPress={() => onOpenDetails(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.actionItem}
        >
          <View style={styles.actionIconBox}>
            <MaterialIcons name="info-outline" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.actionLabel}>Info</Text>
        </Pressable>

        {/* Share Button */}
        <Pressable
          onPress={() => onShare(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.actionItem}
        >
          <View style={styles.actionIconBox}>
            <MaterialIcons name="share" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>
      </View>

      {/* Floating Bottom Info Overlay */}
      <View
        style={[
          styles.bottomOverlay,
          { paddingBottom: insets.bottom + Spacing.four },
        ]}
      >
        {/* Album Badge */}
        {item.album_name && (
          <View style={styles.albumPill}>
            <MaterialIcons
              name="folder"
              size={13}
              color="#FFFFFF"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.albumPillText} numberOfLines={1}>
              {item.album_name}
            </Text>
          </View>
        )}

        {/* Title / Current Relative Path */}
        <Text style={styles.mediaTitle} numberOfLines={2}>
          {item.current_relative_path || item.original_relative_path}
        </Text>

        {/* Metadata Chips: Duration, Resolution, Size */}
        <View style={styles.metaRow}>
          {item.duration_seconds ? (
            <View style={styles.metaBadge}>
              <MaterialIcons name="schedule" size={12} color="#E2E8F0" style={{ marginRight: 3 }} />
              <Text style={styles.metaBadgeText}>{formatDuration(item.duration_seconds)}</Text>
            </View>
          ) : null}

          {resolution ? (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>{resolution}</Text>
            </View>
          ) : null}

          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>{formatFileSize(item.file_size)}</Text>
          </View>

          {isDownloaded && (
            <View style={[styles.metaBadge, { backgroundColor: "rgba(16, 185, 129, 0.4)" }]}>
              <MaterialIcons name="offline-pin" size={12} color="#34D399" style={{ marginRight: 3 }} />
              <Text style={[styles.metaBadgeText, { color: "#34D399" }]}>Offline</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

export default function ShortsScreen() {
  const router = useRouter();
  const { colors } = useMaterialTheme();
  const { width, height } = useWindowDimensions();
  const { mediaId, albumId, mode } = useLocalSearchParams<{
    mediaId?: string;
    albumId?: string;
    mode?: string;
  }>();

  const {
    ip,
    port,
    status: syncStatus,
    downloadedItems,
    activeDownloads,
    startDownloadMediaItem,
    removeDownloadedMediaItem,
  } = useAppStore();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [likedMap, setLikedMap] = useState<Record<number, boolean>>({});
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<MediaItem | null>(null);

  const flatListRef = useRef<FlatList<MediaItem>>(null);
  const targetMediaId = mediaId ? parseInt(mediaId, 10) : NaN;
  const targetAlbumId = albumId ? parseInt(albumId, 10) : NaN;

  // Load media items: Album gallery scoped vs General library scoped
  useEffect(() => {
    async function loadShortsFeed() {
      setLoading(true);
      try {
        let fetched: MediaItem[] = [];

        if (!isNaN(targetAlbumId)) {
          // Scoped strictly to album: next and prev will be only media from this album!
          const res = await getMediaItems({
            albumId: targetAlbumId,
            limit: 500,
            sortBy: "created_at",
            sortOrder: "DESC",
          });
          fetched = res.items;
        } else if (mode === "downloads") {
          // Scoped to downloaded items
          fetched = Object.values(downloadedItems).map((dl) => ({
            id: dl.mediaId,
            file_hash: "",
            original_relative_path: dl.fileName,
            current_relative_path: dl.fileName,
            file_size: dl.fileSize,
            mime_type: dl.mimeType,
            duration_seconds: null,
            metadata_json: null,
            album_id: null,
            album_name: dl.albumName,
            created_at: dl.downloadedAt,
          }));
        } else {
          // General playback: next and prev will be generally from library!
          const res = await getMediaItems({
            limit: 500,
            sortBy: "created_at",
            sortOrder: "DESC",
          });
          fetched = res.items;
        }

        // If targetMediaId wasn't in list, attempt single item lookup
        if (!isNaN(targetMediaId) && !fetched.some((i) => i.id === targetMediaId)) {
          const single = await getMediaItemById(targetMediaId);
          if (single) {
            fetched.unshift(single);
          }
        }

        setItems(fetched);

        // Find initial index
        if (!isNaN(targetMediaId)) {
          const foundIdx = fetched.findIndex((i) => i.id === targetMediaId);
          if (foundIdx >= 0) {
            setActiveIndex(foundIdx);
          }
        }
      } catch (err) {
        console.warn("[Shorts] Failed to load shorts feed:", err);
      } finally {
        setLoading(false);
      }
    }

    loadShortsFeed();
  }, [targetMediaId, targetAlbumId, mode]);

  // Handle active item changing on scroll
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 65,
  }).current;

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleLike = useCallback((itemId: number) => {
    setLikedMap((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  }, []);

  const handleShare = useCallback(async (item: MediaItem) => {
    const dl = downloadedItems[item.id];
    const stream = getMediaStreamUrl(ip, port, item.id);
    const target = dl?.localUri || stream;
    try {
      await Share.share({
        message: `Watch ${item.current_relative_path}: ${target}`,
        url: target,
      });
    } catch {
      // Ignored
    }
  }, [downloadedItems, ip, port]);

  const handleDownload = useCallback(async (item: MediaItem) => {
    const dl = downloadedItems[item.id];
    if (dl) {
      toast.info(`Offline copy saved in ${dl.albumName || "device storage"}`);
      return;
    }
    if (syncStatus !== "connected") {
      toast.error("Connect to server to download full media file.");
      return;
    }
    const res = await startDownloadMediaItem(item);
    if (res.success) {
      toast.success("Downloaded for offline playback!");
    } else {
      toast.error(res.error || "Download failed");
    }
  }, [downloadedItems, syncStatus, startDownloadMediaItem]);

  const handleOpenInspector = useCallback((itemId: number) => {
    router.push(`/media/${itemId}`);
  }, [router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Context title label
  const contextLabel = useMemo(() => {
    if (!isNaN(targetAlbumId)) {
      const firstWithAlbum = items.find((i) => i.album_name);
      return firstWithAlbum?.album_name
        ? `📁 ${firstWithAlbum.album_name}`
        : "Album Gallery Reels";
    }
    if (mode === "downloads") return "💾 Offline Downloads";
    return "🔥 Library Shorts";
  }, [targetAlbumId, mode, items]);

  const initialIndex = useMemo(() => {
    if (isNaN(targetMediaId) || items.length === 0) return 0;
    const idx = items.findIndex((i) => i.id === targetMediaId);
    return idx >= 0 ? idx : 0;
  }, [targetMediaId, items]);

  const renderItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => {
      const isNeighbor = Math.abs(index - activeIndex) <= 1;
      return (
        <ShortsMediaCard
          item={item}
          isActive={index === activeIndex}
          isNeighbor={isNeighbor}
          isMuted={isMuted}
          containerHeight={height}
          containerWidth={width}
          serverIp={ip}
          serverPort={port}
          isConnected={syncStatus === "connected"}
          isDownloaded={!!downloadedItems[item.id]}
          localUri={downloadedItems[item.id]?.localUri}
          activeDownload={activeDownloads[item.id]}
          onToggleMute={handleToggleMute}
          onOpenDetails={(m) => setSelectedItemForDetails(m)}
          onLike={handleLike}
          isLiked={!!likedMap[item.id]}
          onShare={handleShare}
          onDownload={handleDownload}
          onOpenInspector={handleOpenInspector}
          onBack={handleBack}
          contextLabel={contextLabel}
          currentIndex={index}
          totalCount={items.length}
        />
      );
    },
    [
      activeIndex,
      isMuted,
      height,
      width,
      ip,
      port,
      syncStatus,
      downloadedItems,
      activeDownloads,
      handleToggleMute,
      handleLike,
      likedMap,
      handleShare,
      handleDownload,
      handleOpenInspector,
      handleBack,
      contextLabel,
      items.length,
    ],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading Shorts & Reels...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <MaterialIcons name="movie" size={54} color="#666666" />
        <Text style={[styles.loadingText, { marginTop: Spacing.two }]}>
          No media items available for Reels.
        </Text>
        <M3Button
          label="Go Back"
          variant="filled"
          onPress={handleBack}
          style={{ marginTop: Spacing.four }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        pagingEnabled
        horizontal={false}
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialScrollIndex={initialIndex > 0 ? initialIndex : 0}
        getItemLayout={(_, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews={Platform.OS === "android"}
      />

      {/* Item Metadata Details Bottom Sheet Modal */}
      <Modal
        visible={!!selectedItemForDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItemForDetails(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedItemForDetails(null)}
        >
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.surfaceContainer }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <MaterialIcons name="info" size={22} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Media Metadata
              </Text>
              <Pressable
                onPress={() => setSelectedItemForDetails(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: "auto" }}
              >
                <MaterialIcons name="close" size={20} color={colors.outline} />
              </Pressable>
            </View>

            {selectedItemForDetails && (
              <View style={styles.modalContent}>
                <View style={styles.modalRow}>
                  <Text style={[styles.modalLabel, { color: colors.onSurfaceVariant }]}>
                    File Name:
                  </Text>
                  <Text style={[styles.modalValue, { color: colors.onSurface }]} numberOfLines={1}>
                    {selectedItemForDetails.current_relative_path}
                  </Text>
                </View>

                {selectedItemForDetails.album_name && (
                  <View style={styles.modalRow}>
                    <Text style={[styles.modalLabel, { color: colors.onSurfaceVariant }]}>
                      Album:
                    </Text>
                    <Text style={[styles.modalValue, { color: colors.primary }]}>
                      {selectedItemForDetails.album_name}
                    </Text>
                  </View>
                )}

                <View style={styles.modalRow}>
                  <Text style={[styles.modalLabel, { color: colors.onSurfaceVariant }]}>
                    Format / MIME:
                  </Text>
                  <Text style={[styles.modalValue, { color: colors.onSurface }]}>
                    {selectedItemForDetails.mime_type}
                  </Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={[styles.modalLabel, { color: colors.onSurfaceVariant }]}>
                    File Size:
                  </Text>
                  <Text style={[styles.modalValue, { color: colors.onSurface }]}>
                    {formatFileSize(selectedItemForDetails.file_size)}
                  </Text>
                </View>

                {selectedItemForDetails.duration_seconds && (
                  <View style={styles.modalRow}>
                    <Text style={[styles.modalLabel, { color: colors.onSurfaceVariant }]}>
                      Duration:
                    </Text>
                    <Text style={[styles.modalValue, { color: colors.onSurface }]}>
                      {formatDuration(selectedItemForDetails.duration_seconds)} (
                      {selectedItemForDetails.duration_seconds}s)
                    </Text>
                  </View>
                )}

                <View style={styles.modalRow}>
                  <Text style={[styles.modalLabel, { color: colors.onSurfaceVariant }]}>
                    Created At:
                  </Text>
                  <Text style={[styles.modalValue, { color: colors.onSurface }]}>
                    {new Date(selectedItemForDetails.created_at).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <M3Button
                    label="Open Full Inspector"
                    icon="tune"
                    variant="filled"
                    onPress={() => {
                      const id = selectedItemForDetails.id;
                      setSelectedItemForDetails(null);
                      handleOpenInspector(id);
                    }}
                    style={{ flex: 1, marginRight: Spacing.two }}
                  />
                  <M3Button
                    label="Close"
                    variant="outlined"
                    onPress={() => setSelectedItemForDetails(null)}
                  />
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  loadingText: {
    color: "#E2E8F0",
    fontSize: 15,
    fontWeight: "600",
    marginTop: Spacing.three,
  },
  cardContainer: {
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  centerAnimBox: {
    ...StyleSheet.absoluteFill as any,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  centerAnimCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    zIndex: 30,
  },
  iconCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleBox: {
    alignItems: "center",
    maxWidth: "65%",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerCounter: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  rightRail: {
    position: "absolute",
    right: Spacing.three,
    alignItems: "center",
    gap: Spacing.three,
    zIndex: 30,
  },
  actionItem: {
    alignItems: "center",
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 80,
    paddingHorizontal: Spacing.four,
    zIndex: 25,
  },
  albumPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Shapes.full,
    marginBottom: Spacing.one,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  albumPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  mediaTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 20,
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: Spacing.one,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Shapes.small,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: Shapes.extraLarge,
    borderTopRightRadius: Shapes.extraLarge,
    padding: Spacing.four,
    paddingBottom: Spacing.seven,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    alignSelf: "center",
    marginBottom: Spacing.three,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.three,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginLeft: Spacing.two,
  },
  modalContent: {
    gap: Spacing.two,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalValue: {
    fontSize: 13,
    fontWeight: "700",
    maxWidth: "65%",
  },
  modalActions: {
    flexDirection: "row",
    marginTop: Spacing.four,
  },
});
