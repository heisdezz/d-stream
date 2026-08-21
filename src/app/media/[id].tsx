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
  const { ip, port, status: syncStatus } = useAppStore();

  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'details' | 'exif' | 'tags'>('details');

  const itemId = id ? parseInt(id, 10) : NaN;

  useEffect(() => {
    async function loadItem() {
      if (isNaN(itemId)) return;
      setLoading(true);
      const res = await getMediaItemById(itemId);
      setItem(res);
      setLoading(false);
    }
    loadItem();
  }, [itemId]);

  const isVideo = item?.mime_type.startsWith('video/') ?? false;
  const streamUrl = useMemo(() => {
    if (!item) return '';
    return getMediaStreamUrl(ip, port, item.id);
  }, [ip, port, item]);

  const thumbnailUrl = useMemo(() => {
    if (!item) return '';
    return getThumbnailUrl(ip, port, item.id);
  }, [ip, port, item]);

  const player = useVideoPlayer(isVideo && streamUrl ? streamUrl : null, (p) => {
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

  const handleOpenExternal = async () => {
    if (!streamUrl) return;
    try {
      const supported = await Linking.canOpenURL(streamUrl);
      if (supported) {
        await Linking.openURL(streamUrl);
      } else {
        await WebBrowser.openBrowserAsync(streamUrl);
      }
    } catch {
      await WebBrowser.openBrowserAsync(streamUrl);
    }
  };

  const handleShareLink = async () => {
    if (!streamUrl) return;
    try {
      await Share.share({
        message: `Stream ${item?.current_relative_path}: ${streamUrl}`,
        url: streamUrl,
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
          subMessage="Retrieving file metadata & HTTP 206 stream URL"
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
        {isVideo ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            nativeControls
            fullscreenOptions={{ enable: true }}
            allowsPictureInPicture
            contentFit="contain"
          />
        ) : (
          <Image
            source={{ uri: streamUrl || thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={300}
          />
        )}

        {/* Floating Top Right Badges */}
        <View style={styles.topRightStageBadges}>
          <View style={[styles.stageBadge, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <Text style={styles.stageBadgeText}>{extension}</Text>
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

        {syncStatus !== 'connected' && (
          <View style={styles.offlineViewerOverlay}>
            <MaterialIcons name="wifi-off" size={18} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.offlineOverlayText}>Offline • LAN Server Unreachable</Text>
          </View>
        )}
      </View>

      {/* Floating Action Buttons */}
      <View style={styles.actionsBar}>
        <M3Button
          label="Open in External Player"
          icon="open-in-new"
          variant="filled"
          onPress={handleOpenExternal}
          style={{ flex: 1, marginRight: Spacing.two }}
        />
        <M3Button
          label="Share Link"
          icon="share"
          variant="outlined"
          onPress={handleShareLink}
        />
      </View>

      {/* Title & Album Details Card */}
      <M3Card variant="elevated" style={styles.titleCard}>
        <View style={styles.titleRow}>
          <Text style={[styles.fileName, { color: colors.onSurface }]} numberOfLines={2}>
            {fileName}
          </Text>
          <M3Badge
            label={isVideo ? 'VIDEO' : 'PHOTO'}
            variant={isVideo ? 'primary' : 'secondary'}
            size="medium"
          />
        </View>

        <Text style={[styles.fullPath, { color: colors.onSurfaceVariant }]}>
          {item.current_relative_path}
        </Text>

        {item.album_name && (
          <Pressable onPress={handleJumpToAlbum} style={styles.albumLinkRow}>
            <View style={[styles.folderIconBadge, { backgroundColor: colors.primaryContainer }]}>
              <MaterialIcons name="folder-special" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.albumLabelSub, { color: colors.outline }]}>Album Collection</Text>
              <Text style={[styles.albumLinkTitle, { color: colors.onSurface }]}>
                {item.album_name}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
          </Pressable>
        )}
      </M3Card>

      {/* Segmented Specs Tabs */}
      <View style={[styles.tabHeaderRow, { backgroundColor: colors.surfaceContainerHigh }]}>
        <Pressable
          onPress={() => setActiveTab('details')}
          style={[
            styles.tabBtn,
            activeTab === 'details' && {
              backgroundColor: colors.surfaceContainerLowest,
              ...Elevation.level1,
            },
          ]}
        >
          <MaterialIcons
            name="info-outline"
            size={16}
            color={activeTab === 'details' ? colors.primary : colors.outline}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.tabBtnText,
              {
                color: activeTab === 'details' ? colors.onSurface : colors.onSurfaceVariant,
                fontWeight: activeTab === 'details' ? '800' : '600',
              },
            ]}
          >
            Overview
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('exif')}
          style={[
            styles.tabBtn,
            activeTab === 'exif' && {
              backgroundColor: colors.surfaceContainerLowest,
              ...Elevation.level1,
            },
          ]}
        >
          <MaterialIcons
            name="tune"
            size={16}
            color={activeTab === 'exif' ? colors.primary : colors.outline}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.tabBtnText,
              {
                color: activeTab === 'exif' ? colors.onSurface : colors.onSurfaceVariant,
                fontWeight: activeTab === 'exif' ? '800' : '600',
              },
            ]}
          >
            Specs & EXIF
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('tags')}
          style={[
            styles.tabBtn,
            activeTab === 'tags' && {
              backgroundColor: colors.surfaceContainerLowest,
              ...Elevation.level1,
            },
          ]}
        >
          <MaterialIcons
            name="label-outline"
            size={16}
            color={activeTab === 'tags' ? colors.primary : colors.outline}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.tabBtnText,
              {
                color: activeTab === 'tags' ? colors.onSurface : colors.onSurfaceVariant,
                fontWeight: activeTab === 'tags' ? '800' : '600',
              },
            ]}
          >
            Tags ({item.tags?.length || 0})
          </Text>
        </Pressable>
      </View>

      {/* Tab 1: Overview Specs */}
      {activeTab === 'details' && (
        <M3Card variant="filled" style={styles.specsCard}>
          <View style={styles.specRow}>
            <Text style={[styles.specKey, { color: colors.outline }]}>File Size</Text>
            <Text style={[styles.specVal, { color: colors.onSurface }]}>
              {formatBytes(item.file_size)} ({item.file_size.toLocaleString()} B)
            </Text>
          </View>

          <View style={styles.specRow}>
            <Text style={[styles.specKey, { color: colors.outline }]}>MIME Type</Text>
            <Text style={[styles.specVal, { color: colors.onSurface }]}>{item.mime_type}</Text>
          </View>

          {isVideo && (
            <View style={styles.specRow}>
              <Text style={[styles.specKey, { color: colors.outline }]}>Duration</Text>
              <Text style={[styles.specVal, { color: colors.onSurface }]}>
                {formatDuration(item.duration_seconds)}
              </Text>
            </View>
          )}

          <View style={styles.specRow}>
            <Text style={[styles.specKey, { color: colors.outline }]}>Indexed Date</Text>
            <Text style={[styles.specVal, { color: colors.onSurface }]}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>

          <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.specKey, { color: colors.outline }]}>Relative Path</Text>
            <Text style={[styles.specVal, { color: colors.onSurface }]} numberOfLines={2}>
              {item.original_relative_path}
            </Text>
          </View>
        </M3Card>
      )}

      {/* Tab 2: Technical Specs & EXIF */}
      {activeTab === 'exif' && (
        <M3Card variant="filled" style={styles.specsCard}>
          {parsedMetadata.width && parsedMetadata.height ? (
            <View style={styles.specRow}>
              <Text style={[styles.specKey, { color: colors.outline }]}>Resolution</Text>
              <Text style={[styles.specVal, { color: colors.onSurface }]}>
                {parsedMetadata.width} × {parsedMetadata.height} px
              </Text>
            </View>
          ) : null}

          {parsedMetadata.codec ? (
            <View style={styles.specRow}>
              <Text style={[styles.specKey, { color: colors.outline }]}>Video Codec</Text>
              <Text style={[styles.specVal, { color: colors.onSurface }]}>{parsedMetadata.codec}</Text>
            </View>
          ) : null}

          {parsedMetadata.camera_make || parsedMetadata.camera_model ? (
            <View style={styles.specRow}>
              <Text style={[styles.specKey, { color: colors.outline }]}>Camera Model</Text>
              <Text style={[styles.specVal, { color: colors.onSurface }]}>
                {[parsedMetadata.camera_make, parsedMetadata.camera_model].filter(Boolean).join(' ')}
              </Text>
            </View>
          ) : null}

          {parsedMetadata.date_taken ? (
            <View style={styles.specRow}>
              <Text style={[styles.specKey, { color: colors.outline }]}>Captured Date</Text>
              <Text style={[styles.specVal, { color: colors.onSurface }]}>
                {parsedMetadata.date_taken}
              </Text>
            </View>
          ) : null}

          {/* SHA-256 Checksum Hash */}
          <View style={[styles.specRow, { borderBottomWidth: 0, flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={[styles.specKey, { color: colors.outline, marginBottom: 4 }]}>SHA-256 Checksum Hash</Text>
            <Text
              style={[
                styles.hashValBox,
                {
                  color: colors.primary,
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant,
                },
              ]}
              selectable
            >
              {item.file_hash}
            </Text>
          </View>
        </M3Card>
      )}

      {/* Tab 3: Tags */}
      {activeTab === 'tags' && (
        <M3Card variant="filled" style={styles.specsCard}>
          {item.tags && item.tags.length > 0 ? (
            <View style={styles.tagsCloud}>
              {item.tags.map((tag) => (
                <View
                  key={tag.id}
                  style={[
                    styles.tagBadgePill,
                    {
                      backgroundColor: colors.surfaceContainer,
                      borderColor: tag.color_hex || colors.primary,
                    },
                  ]}
                >
                  <View style={[styles.tagDot, { backgroundColor: tag.color_hex || colors.primary }]} />
                  <Text style={[styles.tagText, { color: colors.onSurface }]}>{tag.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyTagsBox}>
              <MaterialIcons name="label-off" size={32} color={colors.outline} />
              <Text style={[styles.noTagsText, { color: colors.outline }]}>
                No taxonomy tags assigned to this media item.
              </Text>
            </View>
          )}
        </M3Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  mediaStageContainer: {
    width: '100%',
    borderRadius: Shapes.large,
    overflow: 'hidden',
    marginBottom: Spacing.three,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Elevation.level3,
  },
  topRightStageBadges: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Shapes.small,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  offlineViewerOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Shapes.medium,
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineOverlayText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  titleCard: {
    marginBottom: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  fileName: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
    flex: 1,
    marginRight: Spacing.two,
  },
  fullPath: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  albumLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.three,
    paddingTop: Spacing.two + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.12)',
  },
  folderIconBadge: {
    width: 36,
    height: 36,
    borderRadius: Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  albumLabelSub: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  albumLinkTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  tabHeaderRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Shapes.medium,
    marginBottom: Spacing.three,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Shapes.small,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnText: {
    fontSize: 12,
  },
  specsCard: {
    marginBottom: Spacing.three,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.12)',
  },
  specKey: {
    fontSize: 13,
    fontWeight: '600',
  },
  specVal: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.two,
  },
  hashValBox: {
    width: '100%',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    padding: Spacing.two,
    borderRadius: Shapes.small,
    borderWidth: 1,
    marginTop: 4,
  },
  tagsCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  tagBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Shapes.full,
    borderWidth: 1,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyTagsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
  },
  noTagsText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: Spacing.one,
  },
});
