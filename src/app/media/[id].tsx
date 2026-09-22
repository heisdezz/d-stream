import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useSetAtom } from 'jotai';
import { selectedAlbumIdAtom } from '@/store/atoms';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useAppStore } from '@/store/use-app-store';
import { getMediaItemById } from '@/services/local-db';
import { getMediaStreamUrl, getThumbnailUrl } from '@/services/sync-api';
import { MediaItem, ParsedMediaMetadata } from '@/types/models';
import { Spacing, Shapes, MaxContentWidth, Elevation } from '@/constants/theme';
import { M3Card } from '@/components/material/m3-card';
import { M3Badge } from '@/components/material/m3-badge';
import { M3Button } from '@/components/material/m3-button';
import { ScreenLoader } from '@/components/common/screen-loader';
import { toast } from 'sonner-native';
import { MaterialIcons } from '@expo/vector-icons';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) {
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m ${secs}s`;
  }
  return `${mins}m ${secs}s (${seconds}s)`;
}

export default function MediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const setSelectedAlbumId = useSetAtom(selectedAlbumIdAtom);
  const {
    ip,
    port,
    status: syncStatus,
    downloadLocation,
    downloadedItems,
    activeDownloads,
    startDownloadMediaItem,
    removeDownloadedMediaItem,
  } = useAppStore();

  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'details' | 'exif' | 'tags'>('details');

  const itemId = id ? parseInt(id, 10) : NaN;

  useEffect(() => {
    async function loadItem() {
      if (isNaN(itemId)) return;
      setLoading(true);
      let res = await getMediaItemById(itemId);
      if (!res) {
        const dlRecord = downloadedItems[itemId];
        if (dlRecord) {
          res = {
            id: dlRecord.mediaId,
            file_hash: '',
            original_relative_path: dlRecord.fileName,
            current_relative_path: dlRecord.fileName,
            file_size: dlRecord.fileSize,
            mime_type: dlRecord.mimeType,
            duration_seconds: null,
            metadata_json: null,
            album_id: null,
            album_name: dlRecord.albumName,
            created_at: dlRecord.downloadedAt,
          };
        }
      }
      setItem(res);
      setLoading(false);
    }
    loadItem();
  }, [itemId, downloadedItems]);

  const isVideo = item?.mime_type.startsWith('video/') ?? false;
  const downloadedRecord = item ? downloadedItems[item.id] : undefined;
  const activeDl = item ? activeDownloads[item.id] : undefined;

  const streamUrl = useMemo(() => {
    if (!item) return '';
    return getMediaStreamUrl(ip, port, item.id);
  }, [ip, port, item]);

  const thumbnailUrl = useMemo(() => {
    if (!item) return '';
    return getThumbnailUrl(ip, port, item.id);
  }, [ip, port, item]);

  // Use downloaded local URI if offline or available!
  const playUri = useMemo(() => {
    if (downloadedRecord?.localUri) return downloadedRecord.localUri;
    if (syncStatus === 'connected' && streamUrl) return streamUrl;
    return null;
  }, [downloadedRecord?.localUri, syncStatus, streamUrl]);

  const player = useVideoPlayer(isVideo && playUri ? playUri : null, (p) => {
    p.loop = false;
  });

  const parsedMetadata: ParsedMediaMetadata = useMemo(() => {
    if (!item?.metadata_json) return {};
    try {
      return JSON.parse(item.metadata_json);
    } catch {
      return {};
    }
  }, [item?.metadata_json]);

  const handleDownloadPress = async () => {
    if (!item) return;
    if (downloadedRecord) {
      Alert.alert(
        'Offline Copy Ready',
        `File is saved locally in ${downloadedRecord.albumName || 'General'} album folder.\n\nPath: ${downloadedRecord.localUri}`,
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Delete Download',
            style: 'destructive',
            onPress: async () => {
              await removeDownloadedMediaItem(item.id);
              toast.info('Offline copy removed from device storage.');
            },
          },
        ]
      );
      return;
    }

    if (syncStatus !== 'connected') {
      toast.error('Connect to your desktop server over LAN to download this media item.');
      return;
    }

    const res = await startDownloadMediaItem(item);
    if (!res.success) {
      toast.error(res.error || 'Could not save file to disk.');
    }
  };

  const handleOpenExternal = async () => {
    const targetUrl = downloadedRecord?.localUri || streamUrl;
    if (!targetUrl) return;
    try {
      const supported = await Linking.canOpenURL(targetUrl);
      if (supported) {
        await Linking.openURL(targetUrl);
      } else {
        await WebBrowser.openBrowserAsync(targetUrl);
      }
    } catch {
      await WebBrowser.openBrowserAsync(targetUrl);
    }
  };

  const handleShareLink = async () => {
    const targetUrl = downloadedRecord?.localUri || streamUrl;
    if (!targetUrl) return;
    try {
      await Share.share({
        message: `Media ${item?.current_relative_path}: ${targetUrl}`,
        url: targetUrl,
      });
    } catch {
      // Ignored
    }
  };

  const handleJumpToAlbum = () => {
    if (item?.album_id) {
      setSelectedAlbumId(item.album_id);
      router.dismiss();
      router.push(`/album/${item.album_id}`);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ScreenLoader
          message="Loading media inspector..."
          subMessage="Retrieving file metadata & offline playback status"
          icon="perm-media"
        />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <MaterialIcons name="error-outline" size={54} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.onSurface }]}>
          Media item not found
        </Text>
      </View>
    );
  }

  const fileName = item.current_relative_path.split('/').pop() || 'media';
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : 'FILE';
  const playerHeight = Math.min(360, width * 0.72);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: insets.bottom + Spacing.seven },
      ]}
    >
      {/* Hero Media Player / Stage */}
      <View style={[styles.mediaStageContainer, { height: playerHeight, backgroundColor: '#090A0F' }]}>
        {isVideo && playUri ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            nativeControls
            fullscreenOptions={{ enable: true }}
            allowsPictureInPicture
            contentFit="contain"
          />
        ) : playUri ? (
          <Image
            source={{ uri: playUri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={300}
          />
        ) : (
          <View style={styles.centerStageOffline}>
            <MaterialIcons name="wifi-off" size={48} color={colors.outline} />
            <Text style={[styles.offlineStageTitle, { color: colors.onSurface }]}>
              Offline • Connect to LAN to stream
            </Text>
            <Text style={[styles.offlineStageSubtitle, { color: colors.outline }]}>
              Download this file when connected to play anytime
            </Text>
          </View>
        )}

        {/* Floating Badges */}
        <View style={styles.stageFloatingBadges}>
          <View
            style={[
              styles.stageBadge,
              {
                backgroundColor: downloadedRecord
                  ? '#10B981'
                  : syncStatus === 'connected'
                  ? colors.primaryContainer
                  : colors.errorContainer,
              },
            ]}
          >
            <MaterialIcons
              name={
                downloadedRecord
                  ? 'offline-pin'
                  : syncStatus === 'connected'
                  ? 'cloud-done'
                  : 'cloud-off'
              }
              size={14}
              color={downloadedRecord ? '#FFF' : colors.onPrimaryContainer}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.stageBadgeText,
                { color: downloadedRecord ? '#FFF' : colors.onPrimaryContainer },
              ]}
            >
              {downloadedRecord
                ? 'OFFLINE READY'
                : syncStatus === 'connected'
                ? 'ONLINE STREAM'
                : 'OFFLINE'}
            </Text>
          </View>

          {isVideo && item.duration_seconds && (
            <View style={[styles.stageBadge, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="play-arrow" size={14} color="#FFF" style={{ marginRight: 2 }} />
              <Text style={[styles.stageBadgeText, { color: '#FFF' }]}>
                {formatDuration(item.duration_seconds)}
              </Text>
            </View>
          )}
        </View>

        {syncStatus !== 'connected' && !downloadedRecord && (
          <View style={styles.offlineViewerOverlay}>
            <MaterialIcons name="wifi-off" size={18} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.offlineOverlayText}>Offline • LAN Server Unreachable</Text>
          </View>
        )}
      </View>

      {/* Primary Download & Action Bar */}
      <View style={styles.downloadBarRow}>
        <Pressable
          onPress={handleDownloadPress}
          style={({ pressed }) => [
            styles.iconOnlyDownloadBtn,
            {
              backgroundColor: downloadedRecord
                ? colors.secondaryContainer
                : colors.primary,
              borderColor: downloadedRecord
                ? colors.secondary
                : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          {activeDl ? (
            <View style={styles.dlProgressIconBox}>
              <MaterialIcons name="cloud-download" size={22} color={colors.onPrimary} />
              <Text style={styles.dlPctOverlayText}>{activeDl.percentage}%</Text>
            </View>
          ) : (
            <MaterialIcons
              name={downloadedRecord ? 'check-circle' : 'file-download'}
              size={24}
              color={downloadedRecord ? colors.onSecondaryContainer : colors.onPrimary}
            />
          )}
        </Pressable>

        <M3Button
          label="Watch Reels"
          icon="movie-filter"
          variant="filled"
          onPress={() => {
            router.push({
              pathname: "/shorts",
              params: {
                mediaId: item.id.toString(),
                ...(item.album_id ? { albumId: item.album_id.toString() } : {}),
              },
            });
          }}
          style={{ flex: 1, marginRight: Spacing.two }}
        />

        <M3Button
          label="Open External"
          icon="open-in-new"
          variant="tonal"
          onPress={handleOpenExternal}
          style={{ marginRight: Spacing.two }}
        />

        <M3Button
          label="Share"
          icon="share"
          variant="outlined"
          onPress={handleShareLink}
        />
      </View>

      {/* Download Location Subtitle Indicator */}
      <View style={[styles.dlLocRow, { backgroundColor: colors.surfaceContainer }]}>
        <MaterialIcons name="folder" size={16} color={colors.primary} style={{ marginRight: 4 }} />
        <Text style={[styles.dlLocText, { color: colors.onSurfaceVariant }]}>
          Save folder: <Text style={{ fontWeight: '800', color: colors.onSurface }}>{downloadLocation}/{item.album_name || 'General'}</Text>
        </Text>
      </View>

      {/* Title & Album Details Card */}
      <M3Card variant="elevated" style={styles.titleCard}>
        <View style={styles.titleRow}>
          <Text style={[styles.fileName, { color: colors.onSurface }]} numberOfLines={2}>
            {fileName}
          </Text>
          <M3Badge
            label={isVideo ? 'VIDEO' : 'PHOTO'}
            variant={isVideo ? 'tertiary' : 'primary'}
            size="small"
          />
        </View>

        {item.album_name && (
          <Pressable
            onPress={handleJumpToAlbum}
            style={({ pressed }) => [
              styles.albumLinkRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <MaterialIcons name="folder-special" size={18} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.albumLinkText, { color: colors.primary }]}>
              {item.album_name}
            </Text>
            <MaterialIcons name="chevron-right" size={18} color={colors.primary} />
          </Pressable>
        )}

        <View style={styles.quickMetaRow}>
          <View style={styles.quickMetaPill}>
            <MaterialIcons name="sd-storage" size={14} color={colors.outline} style={{ marginRight: 4 }} />
            <Text style={[styles.quickMetaText, { color: colors.onSurfaceVariant }]}>
              {formatBytes(item.file_size)}
            </Text>
          </View>

          <View style={styles.quickMetaPill}>
            <MaterialIcons name="extension" size={14} color={colors.outline} style={{ marginRight: 4 }} />
            <Text style={[styles.quickMetaText, { color: colors.onSurfaceVariant }]}>
              {extension}
            </Text>
          </View>

          <View style={styles.quickMetaPill}>
            <MaterialIcons name="event" size={14} color={colors.outline} style={{ marginRight: 4 }} />
            <Text style={[styles.quickMetaText, { color: colors.onSurfaceVariant }]}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </M3Card>

      {/* Detail Tabs */}
      <View style={styles.tabHeaderRow}>
        <Pressable
          onPress={() => setActiveTab('details')}
          style={[
            styles.tabItem,
            activeTab === 'details' && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
        >
          <Text
            style={[
              styles.tabItemText,
              { color: activeTab === 'details' ? colors.primary : colors.outline },
            ]}
          >
            File Details
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('exif')}
          style={[
            styles.tabItem,
            activeTab === 'exif' && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
        >
          <Text
            style={[
              styles.tabItemText,
              { color: activeTab === 'exif' ? colors.primary : colors.outline },
            ]}
          >
            EXIF & Codec
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('tags')}
          style={[
            styles.tabItem,
            activeTab === 'tags' && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
        >
          <Text
            style={[
              styles.tabItemText,
              { color: activeTab === 'tags' ? colors.primary : colors.outline },
            ]}
          >
            Tags ({item.tags?.length || 0})
          </Text>
        </Pressable>
      </View>

      {/* Tab 1: File Details */}
      {activeTab === 'details' && (
        <M3Card variant="outlined" style={styles.tabContentCard}>
          <DetailRow label="File Path" value={item.current_relative_path} colors={colors} />
          <DetailRow label="Original Path" value={item.original_relative_path} colors={colors} />
          <DetailRow label="MIME Type" value={item.mime_type} colors={colors} />
          <DetailRow label="File Size" value={`${formatBytes(item.file_size)} (${item.file_size.toLocaleString()} bytes)`} colors={colors} />
          {item.duration_seconds && (
            <DetailRow label="Duration" value={formatDuration(item.duration_seconds)} colors={colors} />
          )}
          <DetailRow label="Imported Date" value={new Date(item.created_at).toLocaleString()} colors={colors} />
          {downloadedRecord && (
            <>
              <DetailRow label="Offline Local Path" value={downloadedRecord.localUri} colors={colors} />
              <DetailRow label="Downloaded On" value={new Date(downloadedRecord.downloadedAt).toLocaleString()} colors={colors} />
            </>
          )}
        </M3Card>
      )}

      {/* Tab 2: EXIF & Codec */}
      {activeTab === 'exif' && (
        <M3Card variant="outlined" style={styles.tabContentCard}>
          {Object.keys(parsedMetadata).length === 0 ? (
            <View style={styles.noMetaBox}>
              <MaterialIcons name="info-outline" size={36} color={colors.outline} />
              <Text style={[styles.noMetaText, { color: colors.outline }]}>
                No embedded EXIF or video stream metadata found for this item.
              </Text>
            </View>
          ) : (
            <>
              {parsedMetadata.width && parsedMetadata.height && (
                <DetailRow
                  label="Dimensions"
                  value={`${parsedMetadata.width} × ${parsedMetadata.height} px`}
                  colors={colors}
                />
              )}
              {parsedMetadata.codec && (
                <DetailRow label="Video Codec" value={parsedMetadata.codec} colors={colors} />
              )}
              {parsedMetadata.fps && (
                <DetailRow label="Frame Rate" value={`${parsedMetadata.fps} fps`} colors={colors} />
              )}
              {parsedMetadata.bitrate && (
                <DetailRow
                  label="Bitrate"
                  value={`${Math.round(parsedMetadata.bitrate / 1000)} kbps`}
                  colors={colors}
                />
              )}
              {parsedMetadata.camera_make && (
                <DetailRow label="Camera Make" value={parsedMetadata.camera_make} colors={colors} />
              )}
              {parsedMetadata.camera_model && (
                <DetailRow label="Camera Model" value={parsedMetadata.camera_model} colors={colors} />
              )}
              {parsedMetadata.date_taken && (
                <DetailRow label="Date Taken" value={parsedMetadata.date_taken} colors={colors} />
              )}
              {parsedMetadata.iso && (
                <DetailRow label="ISO" value={`ISO ${parsedMetadata.iso}`} colors={colors} />
              )}
              {parsedMetadata.f_number && (
                <DetailRow label="Aperture" value={`f/${parsedMetadata.f_number}`} colors={colors} />
              )}
              {parsedMetadata.exposure_time && (
                <DetailRow label="Exposure" value={`${parsedMetadata.exposure_time} s`} colors={colors} />
              )}
              {parsedMetadata.latitude && parsedMetadata.longitude && (
                <DetailRow
                  label="GPS Coordinates"
                  value={`${parsedMetadata.latitude.toFixed(5)}, ${parsedMetadata.longitude.toFixed(5)}`}
                  colors={colors}
                />
              )}
            </>
          )}
        </M3Card>
      )}

      {/* Tab 3: Tags */}
      {activeTab === 'tags' && (
        <M3Card variant="outlined" style={styles.tabContentCard}>
          {(!item.tags || item.tags.length === 0) ? (
            <View style={styles.noMetaBox}>
              <MaterialIcons name="label-off" size={36} color={colors.outline} />
              <Text style={[styles.noMetaText, { color: colors.outline }]}>
                No taxonomy tags associated with this media item.
              </Text>
            </View>
          ) : (
            <View style={styles.tagsPillContainer}>
              {item.tags.map((t) => (
                <View
                  key={t.id}
                  style={[
                    styles.tagBadge,
                    { backgroundColor: (t.color_hex || colors.primary) + '22', borderColor: t.color_hex || colors.primary },
                  ]}
                >
                  <MaterialIcons name="label" size={14} color={t.color_hex || colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.tagBadgeText, { color: t.color_hex || colors.primary }]}>
                    {t.name} ({t.category})
                  </Text>
                </View>
              ))}
            </View>
          )}
        </M3Card>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.outline }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.onSurface }]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.four,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: Spacing.three,
  },
  mediaStageContainer: {
    width: '100%',
    borderRadius: Shapes.large,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.four,
    ...Elevation.level2,
  },
  centerStageOffline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  offlineStageTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  offlineStageSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  stageFloatingBadges: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Shapes.full,
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  offlineViewerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  offlineOverlayText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  downloadBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  iconOnlyDownloadBtn: {
    width: 48,
    height: 48,
    borderRadius: Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: Spacing.two,
  },
  dlProgressIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dlPctOverlayText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFF',
    marginTop: -2,
  },
  dlLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Shapes.small,
    marginBottom: Spacing.four,
  },
  dlLocText: {
    fontSize: 12,
  },
  titleCard: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    marginRight: Spacing.two,
  },
  albumLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  albumLinkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  quickMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Shapes.small,
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  quickMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    marginBottom: Spacing.four,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 0,
  },
  tabItemText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tabContentCard: {
    padding: Spacing.four,
  },
  detailRow: {
    marginBottom: Spacing.three,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  noMetaBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
  noMetaText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  tagsPillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Shapes.full,
    borderWidth: 1,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
