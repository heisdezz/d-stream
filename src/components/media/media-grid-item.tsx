import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { MediaItem } from '@/types/models';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing, Elevation } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getThumbnailUrl } from '@/services/sync-api';

export interface MediaGridItemProps {
  item: MediaItem;
  onPress: (item: MediaItem) => void;
  width: number;
  serverIp?: string;
  serverPort?: number;
  aspectRatio?: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function getFormatBadge(mime: string, path: string): string {
  const ext = path.split('.').pop()?.toUpperCase();
  if (ext && ext.length <= 4) return ext;
  if (mime.includes('video')) return 'VID';
  if (mime.includes('image')) return 'IMG';
  return 'FILE';
}

export const MediaGridItem: React.FC<MediaGridItemProps> = ({
  item,
  onPress,
  width,
  serverIp,
  serverPort = 8080,
  aspectRatio = 1,
}) => {
  const { colors } = useMaterialTheme();
  const [imageError, setImageError] = useState(false);
  const isVideo = item.mime_type.startsWith('video/');
  const fileName = item.current_relative_path.split('/').pop() || 'media';
  const formatBadge = getFormatBadge(item.mime_type, item.current_relative_path);

  const thumbnailUrl = serverIp ? getThumbnailUrl(serverIp, serverPort, item.id) : null;
  const itemHeight = Math.round(width / aspectRatio);

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          height: itemHeight,
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.outlineVariant,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
      android_ripple={{
        color: colors.primary + '25',
        borderless: false,
      }}
    >
      {/* Background Image / Thumbnail */}
      {thumbnailUrl && !imageError ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          onError={() => setImageError(true)}
        />
      ) : (
        <View
          style={[
            styles.placeholderContainer,
            {
              backgroundColor: isVideo
                ? colors.tertiaryContainer + '60'
                : colors.primaryContainer + '60',
            },
          ]}
        >
          <MaterialIcons
            name={isVideo ? 'videocam' : 'image'}
            size={40}
            color={isVideo ? colors.tertiary : colors.primary}
          />
        </View>
      )}

      {/* Top Floating Glassmorphic Badges */}
      <View style={styles.topBadgeRow}>
        <View style={styles.formatBadge}>
          <Text style={styles.formatBadgeText}>{formatBadge}</Text>
        </View>

        {isVideo && (
          <View style={styles.durationBadge}>
            <MaterialIcons name="play-arrow" size={12} color="#FFF" style={{ marginRight: 2 }} />
            <Text style={styles.durationText}>
              {formatDuration(item.duration_seconds) || 'VIDEO'}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Gradient Scrim & File Info */}
      <View style={styles.bottomScrim}>
        <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
          {fileName}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatBytes(item.file_size)}</Text>
          {item.album_name && (
            <Text style={styles.albumText} numberOfLines={1}>
              • {item.album_name}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Shapes.large,
    overflow: 'hidden',
    marginBottom: Spacing.two,
    borderWidth: 1,
    position: 'relative',
    ...Elevation.level1,
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadgeRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  formatBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Shapes.small,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  formatBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  durationBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Shapes.small,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  durationText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one + 2,
    paddingTop: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    zIndex: 2,
  },
  fileName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '600',
  },
  albumText: {
    color: 'rgba(168, 199, 250, 0.95)',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
    flex: 1,
  },
});
