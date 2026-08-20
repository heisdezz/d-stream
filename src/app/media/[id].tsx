import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
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
        message: `Watch/Stream ${item?.current_relative_path}: ${streamUrl}`,
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
      router.push('/media');
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
          Loading media details...
        </Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <MaterialIcons name="error-outline" size={48} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.onSurface }]}>
          Media item not found
        </Text>
      </View>
    );
  }

  const fileName = item.current_relative_path.split('/').pop() || 'media';
  const playerHeight = Math.min(320, width * 0.65);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: insets.bottom + Spacing.seven },
      ]}
    >
      {/* Hero Media Player / Viewer */}
      <View style={[styles.mediaViewerContainer, { height: playerHeight, backgroundColor: '#000' }]}>
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

        {syncStatus !== 'connected' && (
          <View style={styles.offlineViewerOverlay}>
            <MaterialIcons name="wifi-off" size={20} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.offlineOverlayText}>Offline • Server not reachable</Text>
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

      {/* Title & Path Header */}
      <M3Card variant="elevated" style={styles.titleCard}>
        <View style={styles.titleRow}>
          <Text style={[styles.fileName, { color: colors.onSurface }]} numberOfLines={2}>
            {fileName}
          </Text>
          <M3Badge
            label={isVideo ? 'VIDEO' : 'IMAGE'}
            variant={isVideo ? 'primary' : 'secondary'}
            size="small"
          />
        </View>

        <Text style={[styles.fullPath, { color: colors.onSurfaceVariant }]}>
          {item.current_relative_path}
        </Text>

        {item.album_name && (
          <Pressable onPress={handleJumpToAlbum} style={styles.albumLinkRow}>
            <MaterialIcons name="folder" size={16} color={colors.primary} />
            <Text style={[styles.albumLinkText, { color: colors.primary }]}>
              Album: {item.album_name}
            </Text>
            <MaterialIcons name="arrow-forward" size={14} color={colors.primary} />
          </Pressable>
        )}
      </M3Card>

      {/* Segmented Specs Tabs */}
      <View style={styles.tabHeaderRow}>
        <Pressable
          onPress={() => setActiveTab('details')}
          style={[
            styles.tabBtn,
            activeTab === 'details' && {
              backgroundColor: colors.primaryContainer,
              borderColor: colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.tabBtnText,
              {
                color: activeTab === 'details' ? colors.onPrimaryContainer : colors.onSurfaceVariant,
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
              backgroundColor: colors.primaryContainer,
              borderColor: colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.tabBtnText,
              {
                color: activeTab === 'exif' ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                fontWeight: activeTab === 'exif' ? '800' : '600',
              },
            ]}
          >
            Technical Specs
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('tags')}
          style={[
            styles.tabBtn,
            activeTab === 'tags' && {
              backgroundColor: colors.primaryContainer,
              borderColor: colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.tabBtnText,
              {
                color: activeTab === 'tags' ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                fontWeight: activeTab === 'tags' ? '800' : '600',
              },
            ]}
          >
            Tags ({item.tags?.length || 0})
          </Text>
        </Pressable>
      </View>

      {/* Tab 1: Overview */}
      {activeTab === 'details' && (
        <M3Card variant="filled" style={styles.specsCard}>
          <View style={styles.specRow}>
            <Text style={[styles.specKey, { color: colors.outline }]}>File Size</Text>
            <Text style={[styles.specVal, { color: colors.onSurface }]}>
              {formatBytes(item.file_size)} ({item.file_size.toLocaleString()} bytes)
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
            <Text style={[styles.specKey, { color: colors.outline }]}>Original Path</Text>
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
                {parsedMetadata.width} × {parsedMetadata.height}
              </Text>
            </View>
          ) : null}

          {parsedMetadata.codec ? (
            <View style={styles.specRow}>
              <Text style={[styles.specKey, { color: colors.outline }]}>Codec</Text>
              <Text style={[styles.specVal, { color: colors.onSurface }]}>{parsedMetadata.codec}</Text>
            </View>
          ) : null}

          {parsedMetadata.camera_make || parsedMetadata.camera_model ? (
            <View style={styles.specRow}>
              <Text style={[styles.specKey, { color: colors.outline }]}>Camera</Text>
              <Text style={[styles.specVal, { color: colors.onSurface }]}>
                {[parsedMetadata.camera_make, parsedMetadata.camera_model].filter(Boolean).join(' ')}
              </Text>
            </View>
          ) : null}

          {parsedMetadata.date_taken ? (
            <View style={styles.specRow}>
              <Text style={[styles.specKey, { color: colors.outline }]}>Captured At</Text>
              <Text style={[styles.specVal, { color: colors.onSurface }]}>
                {parsedMetadata.date_taken}
              </Text>
            </View>
          ) : null}

          {/* SHA-256 Checksum Hash */}
          <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.specKey, { color: colors.outline }]}>SHA-256 Hash</Text>
            <Text
              style={[styles.hashVal, { color: colors.primary, backgroundColor: colors.surfaceContainerHigh }]}
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
                    styles.tagBadge,
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
            <Text style={[styles.noTagsText, { color: colors.outline }]}>
              No tags applied to this media item.
            </Text>
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
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  mediaViewerContainer: {
    width: '100%',
    borderRadius: Shapes.large,
    overflow: 'hidden',
    marginBottom: Spacing.three,
    position: 'relative',
    ...Elevation.level2,
  },
  offlineViewerOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Shapes.small,
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineOverlayText: {
    color: '#FFF',
    fontSize: 11,
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
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
    marginRight: Spacing.two,
  },
  fullPath: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  albumLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  albumLinkText: {
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 4,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.12)',
  },
  specKey: {
    fontSize: 12,
    fontWeight: '600',
  },
  specVal: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.two,
  },
  hashVal: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    padding: 4,
    borderRadius: 4,
    flex: 1,
    textAlign: 'right',
  },
  tagsCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Shapes.large,
    borderWidth: 1,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noTagsText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
});
