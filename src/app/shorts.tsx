import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Dimensions,
  LayoutChangeEvent,
  Platform,
  Share,
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
import { LinearGradient } from "expo-linear-gradient";
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { toast } from "sonner-native";
import tw from "twrnc";

import { useMaterialTheme } from "@/hooks/use-material-theme";
import { useAppStore } from "@/store/use-app-store";
import { getMediaItems, getMediaItemById } from "@/services/local-db";
import { getMediaStreamUrl, getThumbnailUrl } from "@/services/sync-api";
import { MediaItem } from "@/types/models";
import { DownloadProgress } from "@/services/downloader";
import { Spacing } from "@/constants/theme";
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
  isClearMode: boolean;
  onToggleClearMode: () => void;
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
  isClearMode,
  onToggleClearMode,
}: ShortsMediaCardProps) {
  const insets = useSafeAreaInsets();
  const bottomSafeArea = Math.max(insets.bottom, 16);
  const isVideo = item.mime_type.startsWith("video/");
  const lastTapRef = useRef<number>(0);

  // Play/Pause icon animation
  const [playPauseState, setPlayPauseState] = useState<
    "playing" | "paused" | null
  >(null);
  const playPauseOpacity = useRef(new Animated.Value(0)).current;

  // Heart burst animation for double-tap
  const [showHeartBurst, setShowHeartBurst] = useState<boolean>(false);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(1)).current;

  // Video progress seekbar state
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(item.duration_seconds || 0);

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
      setCurrentTime(0);
    }
  }, [isActive, isMuted, player]);

  // Track video progress for Seekbar
  useEffect(() => {
    if (!player || !isVideo) return;
    player.timeUpdateEventInterval = 0.2;
    const sub = player.addListener("timeUpdate", (event) => {
      setCurrentTime(event.currentTime);
      if (player.duration > 0) {
        setDuration(player.duration);
      }
    });

    return () => {
      sub.remove();
    };
  }, [player, isVideo]);

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

  const resolution =
    parsedMetadata?.width && parsedMetadata?.height
      ? `${parsedMetadata.width}×${parsedMetadata.height}`
      : null;

  const progressRatio =
    duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  return (
    <View
      style={[
        styles.cardContainer,
        { width: containerWidth, height: containerHeight },
      ]}
    >
      {/* Background Media Area */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleScreenPress}>
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

      {/* Top Subtle Dark Gradient */}
      {!isClearMode && (
        <LinearGradient
          colors={["rgba(0, 0, 0, 0.72)", "rgba(0, 0, 0, 0.25)", "transparent"]}
          style={tw`absolute top-0 left-0 right-0 h-32 z-10`}
          pointerEvents="none"
        />
      )}

      {/* Bottom Subtle Dark Gradient */}
      {!isClearMode && (
        <LinearGradient
          colors={["transparent", "rgba(0, 0, 0, 0.35)", "rgba(0, 0, 0, 0.85)"]}
          style={tw`absolute bottom-0 left-0 right-0 h-52 z-10`}
          pointerEvents="none"
        />
      )}

      {/* Play/Pause Center Indicator */}
      {playPauseState && (
        <Animated.View
          style={[
            tw`absolute inset-0 items-center justify-center z-20`,
            { opacity: playPauseOpacity },
          ]}
          pointerEvents="none"
        >
          <View
            style={tw`w-22 h-22 rounded-full bg-black/60 items-center justify-center`}
          >
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
            tw`absolute inset-0 items-center justify-center z-20`,
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
      {!isClearMode && (
        <View
          style={[
            tw`absolute top-0 left-0 right-0 flex-row items-center justify-between px-3.5 z-20`,
            { paddingTop: insets.top + Spacing.two },
          ]}
        >
        <Pressable
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={tw`w-11 h-11 rounded-full bg-black/55 items-center justify-center`}
        >
          <MaterialIcons name="close" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={tw`items-center max-w-[65%]`}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {contextLabel}
          </Text>
          <Text style={tw`text-[11px] text-white/80 mt-0.5 font-bold`}>
            {currentIndex + 1} of {totalCount}
          </Text>
        </View>

        <Pressable
          onPress={() => onOpenInspector(item.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={tw`w-11 h-11 rounded-full bg-black/55 items-center justify-center`}
        >
          <MaterialIcons name="open-in-new" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      )}

      {/* Floating Right Action Rail (TikTok / Reels style) */}
      {!isClearMode && (
        <View
          style={[
            tw`absolute right-3 items-center gap-3 z-20`,
            { bottom: bottomSafeArea + 18 },
          ]}
        >
        {/* Like Button */}
        <Pressable
          onPress={() => {
            onLike(item.id);
            if (!isLiked) triggerHeartAnimation();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={tw`items-center`}
        >
          <View
            style={[
              tw`w-12 h-12 rounded-full bg-black/55 items-center justify-center border border-white/15`,
              isLiked && { backgroundColor: "rgba(255, 45, 85, 0.3)" },
            ]}
          >
            <MaterialIcons
              name={isLiked ? "favorite" : "favorite-border"}
              size={26}
              color={isLiked ? "#FF2D55" : "#FFFFFF"}
            />
          </View>
          <Text style={styles.actionLabel}>{isLiked ? "Liked" : "Like"}</Text>
        </Pressable>

        {/* Audio Mute/Unmute Toggle (Video only) */}
        {isVideo && (
          <Pressable
            onPress={onToggleMute}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={tw`items-center`}
          >
            <View
              style={tw`w-12 h-12 rounded-full bg-black/55 items-center justify-center border border-white/15`}
            >
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
          style={tw`items-center`}
        >
          <View
            style={[
              tw`w-12 h-12 rounded-full bg-black/55 items-center justify-center border border-white/15`,
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
          style={tw`items-center`}
        >
          <View
            style={tw`w-12 h-12 rounded-full bg-black/55 items-center justify-center border border-white/15`}
          >
            <MaterialIcons name="info-outline" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.actionLabel}>Info</Text>
        </Pressable>

        {/* Share Button */}
        <Pressable
          onPress={() => onShare(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={tw`items-center`}
        >
          <View
            style={tw`w-12 h-12 rounded-full bg-black/55 items-center justify-center border border-white/15`}
          >
            <MaterialIcons name="share" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>

        {/* Clear Screen Button */}
        <Pressable
          onPress={onToggleClearMode}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={tw`items-center`}
        >
          <View
            style={tw`w-12 h-12 rounded-full bg-black/55 items-center justify-center border border-white/15`}
          >
            <MaterialIcons name="visibility-off" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.actionLabel}>Clear</Text>
        </Pressable>
      </View>
      )}

      {/* Floating Bottom Info Overlay */}
      {!isClearMode && (
        <View
          style={[
            tw`absolute left-0 right-20 px-4 z-20`,
            { bottom: isVideo ? bottomSafeArea + 22 : bottomSafeArea + 6 },
          ]}
        >
        {/* Album Badge */}
        {item.album_name && (
          <View
            style={tw`flex-row items-center self-start bg-black/60 px-2.5 py-1 rounded-full mb-1 border border-white/20`}
          >
            <MaterialIcons
              name="folder"
              size={13}
              color="#FFFFFF"
              style={{ marginRight: 4 }}
            />
            <Text style={tw`text-xs font-bold text-white`} numberOfLines={1}>
              {item.album_name}
            </Text>
          </View>
        )}

        {/* Title / Current Relative Path */}
        <Text style={styles.mediaTitle} numberOfLines={2}>
          {item.current_relative_path || item.original_relative_path}
        </Text>

        {/* Metadata Chips: Duration, Resolution, Size */}
        <View style={tw`flex-row flex-wrap gap-1.5 items-center`}>
          {item.duration_seconds ? (
            <View
              style={tw`flex-row items-center bg-black/60 px-2 py-0.5 rounded border border-white/15`}
            >
              <MaterialIcons
                name="schedule"
                size={12}
                color="#E2E8F0"
                style={{ marginRight: 3 }}
              />
              <Text style={tw`text-[11px] font-semibold text-slate-200`}>
                {formatDuration(item.duration_seconds)}
              </Text>
            </View>
          ) : null}

          {resolution ? (
            <View
              style={tw`bg-black/60 px-2 py-0.5 rounded border border-white/15`}
            >
              <Text style={tw`text-[11px] font-semibold text-slate-200`}>
                {resolution}
              </Text>
            </View>
          ) : null}

          <View
            style={tw`bg-black/60 px-2 py-0.5 rounded border border-white/15`}
          >
            <Text style={tw`text-[11px] font-semibold text-slate-200`}>
              {formatFileSize(item.file_size)}
            </Text>
          </View>

          {isDownloaded && (
            <View
              style={tw`flex-row items-center bg-emerald-500/40 px-2 py-0.5 rounded border border-emerald-400/30`}
            >
              <MaterialIcons
                name="offline-pin"
                size={12}
                color="#34D399"
                style={{ marginRight: 3 }}
              />
              <Text style={tw`text-[11px] font-semibold text-emerald-400`}>
                Offline
              </Text>
            </View>
          )}
        </View>
      </View>
      )}

      {/* Interactive Video Seekbar */}
      {isVideo && !isClearMode && (
        <View
          style={[
            tw`absolute left-0 right-0 z-30 px-3`,
            { bottom: bottomSafeArea },
          ]}
        >
          <Pressable
            onPress={(e) => {
              const touchX = e.nativeEvent.locationX;
              const barWidth = containerWidth - 24;
              const ratio = Math.max(0, Math.min(1, touchX / barWidth));
              if (player && duration > 0) {
                player.currentTime = ratio * duration;
                setCurrentTime(ratio * duration);
              }
            }}
            hitSlop={{ top: 18, bottom: 18, left: 8, right: 8 }}
            style={tw`w-full py-2 justify-center`}
          >
            {/* Background Track */}
            <View
              style={tw`w-full h-1.5 bg-white/25 rounded-full overflow-hidden`}
            >
              {/* Progress Fill */}
              <View
                style={[
                  tw`h-full bg-white rounded-full`,
                  { width: `${progressRatio * 100}%` },
                ]}
              />
            </View>
          </Pressable>
        </View>
      )}

      {/* Unclear Screen Button (Visible only in Clear Mode) */}
      {isClearMode && (
        <Pressable
          onPress={onToggleClearMode}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          style={[
            tw`absolute right-4 z-30 flex-row items-center bg-black/75 px-4 py-2.5 rounded-full border border-white/30 shadow-lg`,
            { bottom: bottomSafeArea + 10 },
          ]}
        >
          <MaterialIcons name="visibility" size={20} color="#FFFFFF" />
          <Text style={tw`text-white font-bold text-xs ml-2`}>
            Unclear Screen
          </Text>
        </Pressable>
      )}
    </View>
  );
});

export default function ShortsScreen() {
  const router = useRouter();
  const { colors } = useMaterialTheme();

  // Screen measurement to ensure edge-to-edge full container sizing
  const [containerDimensions, setContainerDimensions] = useState(() => ({
    width: Dimensions.get("screen").width,
    height: Dimensions.get("screen").height,
  }));

  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (h > 0 && w > 0) {
      setContainerDimensions((prev) => {
        if (prev.width === w && prev.height === h) return prev;
        return { width: w, height: h };
      });
    }
  }, []);

  const {
    mediaId,
    albumId,
    tagId,
    mode,
    mediaType,
    sortBy,
    sortOrder,
    searchQuery,
  } = useLocalSearchParams<{
    mediaId?: string;
    albumId?: string;
    tagId?: string;
    mode?: string;
    mediaType?: "all" | "image" | "video";
    sortBy?: string;
    sortOrder?: "ASC" | "DESC";
    searchQuery?: string;
  }>();

  const {
    ip,
    port,
    status: syncStatus,
    downloadedItems,
    activeDownloads,
    startDownloadMediaItem,
  } = useAppStore();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [initialIndex, setInitialIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [likedMap, setLikedMap] = useState<Record<number, boolean>>({});
  const [isClearMode, setIsClearMode] = useState<boolean>(false);
  const [selectedItemForDetails, setSelectedItemForDetails] =
    useState<MediaItem | null>(null);

  const handleToggleClearMode = useCallback(() => {
    setIsClearMode((prev) => {
      if (!prev) {
        setSelectedItemForDetails(null);
        bottomSheetRef.current?.close();
      }
      return !prev;
    });
  }, []);

  const flatListRef = useRef<FlatList<MediaItem>>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["56%", "82%"], []);

  const targetMediaId = mediaId ? parseInt(mediaId, 10) : NaN;
  const targetAlbumId = albumId ? parseInt(albumId, 10) : NaN;
  const targetTagId = tagId ? parseInt(tagId, 10) : NaN;

  // Load media items: Album gallery scoped vs General library scoped
  useEffect(() => {
    async function loadShortsFeed() {
      setLoading(true);
      try {
        let fetched: MediaItem[] = [];

        if (!isNaN(targetAlbumId)) {
          // Scoped strictly to album, preserving album's active type filter, query and sorting
          const res = await getMediaItems({
            albumId: targetAlbumId,
            type: mediaType || "all",
            query: searchQuery || "",
            sortBy: (sortBy as any) || "created_at",
            sortOrder: (sortOrder as any) || "DESC",
            limit: 1000,
          });
          fetched = res.items;
        } else if (mode === "downloads") {
          // Scoped to downloaded items
          fetched = Object.values(downloadedItems)
            .filter((dl) => {
              if (mediaType === "video")
                return dl.mimeType.startsWith("video/");
              if (mediaType === "image")
                return dl.mimeType.startsWith("image/");
              return true;
            })
            .map((dl) => ({
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
          // General library playback, respecting active filter
          const res = await getMediaItems({
            tagId: !isNaN(targetTagId) ? targetTagId : undefined,
            type: mediaType || "all",
            query: searchQuery || "",
            sortBy: (sortBy as any) || "created_at",
            sortOrder: (sortOrder as any) || "DESC",
            limit: 1000,
          });
          fetched = res.items;
        }

        // Ensure clicked media item is in the list
        if (
          !isNaN(targetMediaId) &&
          !fetched.some((i) => i.id === targetMediaId)
        ) {
          const single = await getMediaItemById(targetMediaId);
          if (single) {
            fetched.unshift(single);
          }
        }

        const foundIdx = !isNaN(targetMediaId)
          ? fetched.findIndex((i) => i.id === targetMediaId)
          : 0;
        const validIdx = foundIdx >= 0 ? foundIdx : 0;

        setItems(fetched);
        setActiveIndex(validIdx);
        setInitialIndex(validIdx);
      } catch (err) {
        console.warn("[Shorts] Failed to load shorts feed:", err);
      } finally {
        setLoading(false);
      }
    }

    loadShortsFeed();
  }, [
    targetMediaId,
    targetAlbumId,
    targetTagId,
    mode,
    mediaType,
    sortBy,
    sortOrder,
    searchQuery,
  ]);

  // Ensure scroll position lands squarely on target item after layout is ready
  useEffect(() => {
    if (
      items.length > 0 &&
      initialIndex > 0 &&
      containerDimensions.height > 0
    ) {
      flatListRef.current?.scrollToOffset({
        offset: initialIndex * containerDimensions.height,
        animated: false,
      });
    }
  }, [items, initialIndex, containerDimensions.height]);

  // Viewability tracking
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

  const handleShare = useCallback(
    async (item: MediaItem) => {
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
    },
    [downloadedItems, ip, port],
  );

  const handleDownload = useCallback(
    async (item: MediaItem) => {
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
    },
    [downloadedItems, syncStatus, startDownloadMediaItem],
  );

  const handleOpenInspector = useCallback(
    (itemId: number) => {
      router.push(`/media/${itemId}`);
    },
    [router],
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenDetails = useCallback((item: MediaItem) => {
    setSelectedItemForDetails(item);
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.65}
        pressBehavior="close"
      />
    ),
    [],
  );

  // Context title label
  const contextLabel = useMemo(() => {
    const typeSuffix =
      mediaType === "video" ? "Videos" : mediaType === "image" ? "Photos" : "";

    if (!isNaN(targetAlbumId)) {
      const firstWithAlbum = items.find((i) => i.album_name);
      const albName = firstWithAlbum?.album_name || "Album";
      return typeSuffix ? `📁 ${albName} • ${typeSuffix}` : `📁 ${albName}`;
    }
    if (mode === "downloads") {
      return typeSuffix
        ? `💾 Downloads • ${typeSuffix}`
        : "💾 Offline Downloads";
    }
    return typeSuffix ? `🔥 Shorts • ${typeSuffix}` : "🔥 Library Shorts";
  }, [targetAlbumId, mode, items, mediaType]);

  const renderItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => {
      const isNeighbor = Math.abs(index - activeIndex) <= 1;
      return (
        <ShortsMediaCard
          item={item}
          isActive={index === activeIndex}
          isNeighbor={isNeighbor}
          isMuted={isMuted}
          containerHeight={containerDimensions.height}
          containerWidth={containerDimensions.width}
          serverIp={ip}
          serverPort={port}
          isConnected={syncStatus === "connected"}
          isDownloaded={!!downloadedItems[item.id]}
          localUri={downloadedItems[item.id]?.localUri}
          activeDownload={activeDownloads[item.id]}
          onToggleMute={handleToggleMute}
          onOpenDetails={handleOpenDetails}
          onLike={handleLike}
          isLiked={!!likedMap[item.id]}
          onShare={handleShare}
          onDownload={handleDownload}
          onOpenInspector={handleOpenInspector}
          onBack={handleBack}
          contextLabel={contextLabel}
          currentIndex={index}
          totalCount={items.length}
          isClearMode={isClearMode}
          onToggleClearMode={handleToggleClearMode}
        />
      );
    },
    [
      activeIndex,
      isMuted,
      isClearMode,
      handleToggleClearMode,
      containerDimensions.height,
      containerDimensions.width,
      ip,
      port,
      syncStatus,
      downloadedItems,
      activeDownloads,
      handleToggleMute,
      handleOpenDetails,
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
      <View style={tw`flex-1 bg-black items-center justify-center p-4`}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={tw`text-slate-200 text-sm font-semibold mt-3`}>
          Loading Shorts & Reels...
        </Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center p-4`}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <MaterialIcons name="movie" size={54} color="#666666" />
        <Text style={tw`text-slate-200 text-sm font-semibold mt-2 text-center`}>
          No media items available for Reels.
        </Text>
        <M3Button
          label="Go Back"
          variant="filled"
          onPress={handleBack}
          style={tw`mt-4`}
        />
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-black`} onLayout={handleContainerLayout}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        pagingEnabled
        horizontal={false}
        showsVerticalScrollIndicator={false}
        snapToInterval={containerDimensions.height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialScrollIndex={initialIndex > 0 ? initialIndex : 0}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({
              offset: info.index * containerDimensions.height,
              animated: false,
            });
          }, 50);
        }}
        getItemLayout={(_, index) => ({
          length: containerDimensions.height,
          offset: containerDimensions.height * index,
          index,
        })}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews={Platform.OS === "android"}
      />

      {/* Real Gorhom Draggable Bottom Sheet for Metadata Details */}
      {selectedItemForDetails && (
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          enablePanDownToClose
          animateOnMount
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: colors.surfaceContainer }}
          handleIndicatorStyle={{
            backgroundColor: colors.outlineVariant,
            width: 44,
            height: 4,
          }}
          onClose={() => setSelectedItemForDetails(null)}
        >
          <BottomSheetView style={tw`flex-1 px-5 pt-1 pb-8`}>
            <>
              {/* Header */}
              <View style={tw`flex-row items-center mb-4`}>
                <MaterialIcons name="info" size={22} color={colors.primary} />
                <Text
                  style={[
                    tw`text-base font-extrabold ml-2`,
                    { color: colors.onSurface },
                  ]}
                >
                  Media Metadata
                </Text>
                <Pressable
                  onPress={() => bottomSheetRef.current?.close()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={tw`ml-auto p-1`}
                >
                  <MaterialIcons
                    name="close"
                    size={20}
                    color={colors.outline}
                  />
                </Pressable>
              </View>

              {/* Detail Items */}
              <View style={tw`gap-2.5`}>
                <View style={tw`flex-row justify-between items-center py-1`}>
                  <Text
                    style={[
                      tw`text-xs font-semibold`,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    File Name:
                  </Text>
                  <Text
                    style={[
                      tw`text-xs font-bold max-w-[65%]`,
                      { color: colors.onSurface },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedItemForDetails.current_relative_path}
                  </Text>
                </View>

                {selectedItemForDetails.album_name && (
                  <View style={tw`flex-row justify-between items-center py-1`}>
                    <Text
                      style={[
                        tw`text-xs font-semibold`,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      Album:
                    </Text>
                    <Text
                      style={[tw`text-xs font-bold`, { color: colors.primary }]}
                    >
                      {selectedItemForDetails.album_name}
                    </Text>
                  </View>
                )}

                <View style={tw`flex-row justify-between items-center py-1`}>
                  <Text
                    style={[
                      tw`text-xs font-semibold`,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    Format / MIME:
                  </Text>
                  <Text
                    style={[tw`text-xs font-bold`, { color: colors.onSurface }]}
                  >
                    {selectedItemForDetails.mime_type}
                  </Text>
                </View>

                <View style={tw`flex-row justify-between items-center py-1`}>
                  <Text
                    style={[
                      tw`text-xs font-semibold`,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    File Size:
                  </Text>
                  <Text
                    style={[tw`text-xs font-bold`, { color: colors.onSurface }]}
                  >
                    {formatFileSize(selectedItemForDetails.file_size)}
                  </Text>
                </View>

                {selectedItemForDetails.duration_seconds && (
                  <View style={tw`flex-row justify-between items-center py-1`}>
                    <Text
                      style={[
                        tw`text-xs font-semibold`,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      Duration:
                    </Text>
                    <Text
                      style={[
                        tw`text-xs font-bold`,
                        { color: colors.onSurface },
                      ]}
                    >
                      {formatDuration(selectedItemForDetails.duration_seconds)}{" "}
                      ({selectedItemForDetails.duration_seconds}s)
                    </Text>
                  </View>
                )}

                <View style={tw`flex-row justify-between items-center py-1`}>
                  <Text
                    style={[
                      tw`text-xs font-semibold`,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    Created At:
                  </Text>
                  <Text
                    style={[tw`text-xs font-bold`, { color: colors.onSurface }]}
                  >
                    {new Date(
                      selectedItemForDetails.created_at,
                    ).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={tw`flex-row items-center mt-6`}>
                <M3Button
                  label="Open Full Inspector"
                  icon="tune"
                  variant="filled"
                  onPress={() => {
                    const id = selectedItemForDetails.id;
                    bottomSheetRef.current?.close();
                    handleOpenInspector(id);
                  }}
                  style={tw`flex-1 mr-2`}
                />
                <M3Button
                  label="Close"
                  variant="outlined"
                  onPress={() => bottomSheetRef.current?.close()}
                />
              </View>
            </>
          </BottomSheetView>
        </BottomSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
});
