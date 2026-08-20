import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useVideoPlayer, VideoView } from 'expo-video';

import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useSync } from '@/hooks/use-sync';
import { getMediaItemById } from '@/services/local-db';
import { getMediaStreamUrl, getThumbnailUrl } from '@/services/sync-api';
import { MediaItem, ParsedMediaMetadata } from '@/types/models';
import { Spacing, Shapes, MaxContentWidth } from '@/constants/theme';
import { M3Card } from '@/components/material/m3-card';
import { M3Button } from '@/components/material/m3-button';
import { M3Badge } from '@/components/material/m3-badge';
import { MaterialIcons } from '@expo/vector-icons';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

// Dedicated Video Component using expo-video
function StreamVideoPlayer({
  streamUrl,
  colors,
}: {
  streamUrl: string;
  colors: any;
}) {
  const player = useVideoPlayer(streamUrl, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <View style={[styles.playerContainer, { backgroundColor: '#000' }]}>
      <VideoView
        player={player}
        style={styles.videoPlayer}
        nativeControls
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
        contentFit="contain"
      />
    </View>
  );
}

export default function MediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { ip, port, status: syncStatus } = useSync();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  useEffect(() => {
    async function loadItem() {
      if (!id) return;
      const media = await getMediaItemById(parseInt(id, 10));
      setItem(media);
      setLoading(false);
    }
    loadItem();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <MaterialIcons name="error-outline" size={48} color={colors.outline} />
        <Text style={[styles.notFoundTitle, { color: colors.onSurface }]}>
          Media item not found
        </Text>
      </View>
    );
  }

  const isVideo = item.mime_type.startsWith('video/');
  const fileName = item.current_relative_path.split('/').pop() || 'media';
  const isOnline = syncStatus === 'connected';
  const streamUrl = isOnline ? getMediaStreamUrl(ip, port, item.id) : null;
  const thumbnailUrl = isOnline ? getThumbnailUrl(ip, port, item.id) : null;

  let parsedMetadata: ParsedMediaMetadata | null = null;
  if (item.metadata_json) {
    try {
      parsedMetadata = JSON.parse(item.metadata_json);
    } catch {
      // Ignored
    }
  }

  const handleOpenExternal = async () => {
    if (!streamUrl) {
      Alert.alert(
        'Server Offline',
        'Connect to your desktop organizer server in the Sync tab to stream original files.'
      );
      return;
    }
    try {
      if (isVideo && Platform.OS === 'android') {
        const canOpen = await Linking.canOpenURL(streamUrl);
        if (canOpen) {
          await Linking.openURL(streamUrl);
          return;
        }
      }
      await WebBrowser.openBrowserAsync(streamUrl);
    } catch (err: any) {
      Alert.alert('Unable to open player', err.message || 'Error opening media link.');
    }
  };

  const handleCopyLink = () => {
    if (!streamUrl) {
      Alert.alert('Offline', 'Server is not currently connected.');
      return;
    }
    Alert.alert('Stream URL', streamUrl);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: insets.bottom + Spacing.six },
      ]}
    >
      {/* Visual / Stream Player Card */}
      <M3Card variant="elevated" style={styles.heroCard}>
        {isVideo ? (
          streamUrl ? (
            <StreamVideoPlayer streamUrl={streamUrl} colors={colors} />
          ) : (
            <View
              style={[
                styles.heroVisual,
                { backgroundColor: colors.tertiaryContainer + '60' },
              ]}
            >
              <MaterialIcons name="videocam" size={64} color={colors.tertiary} />
              <Text style={[styles.offlineHint, { color: colors.onTertiaryContainer }]}>
                Connect server to stream 1080p/4K video
              </Text>
            </View>
          )
        ) : (
          /* Full Image Viewer */
          <View
            style={[
              styles.imageContainer,
              { backgroundColor: colors.surfaceContainerHighest },
            ]}
          >
            {streamUrl && !imageError ? (
              <Image
                source={{ uri: streamUrl }}
                style={styles.fullImage}
                contentFit="contain"
                transition={300}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            ) : thumbnailUrl && !imageError ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={styles.fullImage}
                contentFit="contain"
                transition={200}
              />
            ) : (
              <View style={styles.heroVisual}>
                <MaterialIcons name="image" size={64} color={colors.primary} />
              </View>
            )}
          </View>
        )}

        {/* Title & Badges */}
        <View style={styles.heroInfo}>
          <Text style={[styles.fileName, { color: colors.onSurface }]}>
            {fileName}
          </Text>

          <View style={styles.badgeRow}>
            <M3Badge
              label={isVideo ? 'VIDEO STREAM' : 'FULL IMAGE'}
              variant={isVideo ? 'tertiary' : 'primary'}
            />
            {item.album_name && (
              <M3Badge
                label={`Album: ${item.album_name}`}
                variant="secondary"
                style={{ marginLeft: Spacing.one }}
              />
            )}
            {isOnline && (
              <M3Badge
                label="LAN LIVE"
                variant="tertiary"
                style={{ marginLeft: Spacing.one }}
              />
            )}
          </View>
        </View>

        {/* Quick Stream Action Buttons */}
        <View style={styles.actionRow}>
          <M3Button
            label={isVideo ? 'External Video Player' : 'Open in Browser'}
            icon="open-in-new"
            variant="filled"
            onPress={handleOpenExternal}
            style={{ flex: 1, marginRight: Spacing.two }}
          />
          <M3Button
            label="Stream URL"
            icon="link"
            variant="tonal"
            onPress={handleCopyLink}
          />
        </View>
      </M3Card>

      {/* Tags Section */}
      {item.tags && item.tags.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
            TAGS
          </Text>
          <View style={styles.tagsRow}>
            {item.tags.map((tag) => (
              <View
                key={tag.id}
                style={[
                  styles.tagChip,
                  {
                    backgroundColor: colors.surfaceContainer,
                    borderColor: tag.color_hex || colors.outlineVariant,
                  },
                ]}
              >
                <View
                  style={[
                    styles.tagDot,
                    { backgroundColor: tag.color_hex || colors.primary },
                  ]}
                />
                <Text style={[styles.tagText, { color: colors.onSurface }]}>
                  {tag.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* File Specifications */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
          FILE SPECIFICATIONS
        </Text>
        <M3Card variant="filled">
          <DetailRow label="File Size" value={formatBytes(item.file_size)} />
          <DetailRow label="MIME Type" value={item.mime_type} />
          {isVideo && (
            <DetailRow
              label="Duration"
              value={formatDuration(item.duration_seconds)}
            />
          )}
          <DetailRow
            label="Date Created"
            value={new Date(item.created_at).toLocaleString()}
          />
          <DetailRow label="File Hash (SHA-256)" value={item.file_hash} isMonospace />
        </M3Card>
      </View>

      {/* Storage Paths on Host */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
          STORAGE LOCATIONS
        </Text>
        <M3Card variant="filled">
          <DetailRow
            label="Current Relative Path"
            value={item.current_relative_path}
          />
          <DetailRow
            label="Original Relative Path"
            value={item.original_relative_path}
          />
        </M3Card>
      </View>

      {/* Metadata & EXIF Inspector */}
      {parsedMetadata && Object.keys(parsedMetadata).length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
            METADATA & EXIF INSPECTOR
          </Text>
          <M3Card variant="filled">
            {Object.entries(parsedMetadata).map(([key, val]) => (
              <DetailRow
                key={key}
                label={key.replace(/_/g, ' ').toUpperCase()}
                value={typeof val === 'object' ? JSON.stringify(val) : String(val)}
              />
            ))}
          </M3Card>
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  isMonospace = false,
}: {
  label: string;
  value: string;
  isMonospace?: boolean;
}) {
  const { colors } = useMaterialTheme();

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.outline }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.detailValue,
          {
            color: colors.onSurface,
            fontFamily: isMonospace ? 'monospace' : undefined,
          },
        ]}
        selectable
      >
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
  notFoundTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  heroCard: {
    marginBottom: Spacing.four,
    padding: 0,
    overflow: 'hidden',
  },
  playerContainer: {
    width: '100%',
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  imageContainer: {
    width: '100%',
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  heroVisual: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineHint: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.one,
  },
  heroInfo: {
    padding: Spacing.three,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  section: {
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.one,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Shapes.medium,
    borderWidth: 1,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.one,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailRow: {
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.12)',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    lineHeight: 18,
  },
});
