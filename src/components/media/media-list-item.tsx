import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { MediaItem } from '@/types/models';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing, Elevation } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getThumbnailUrl } from '@/services/sync-api';

export interface MediaListItemProps {
  item: MediaItem;
  onPress: (item: MediaItem) => void;
  serverIp?: string;
  serverPort?: number;
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
  return 'IMG';
}

export const MediaListItem: React.FC<MediaListItemProps> = ({
  item,
  onPress,
  serverIp,
  serverPort = 8080,
}) => {
  const { colors } = useMaterialTheme();
  const [imageError, setImageError] = useState(false);
  const isVideo = item.mime_type.startsWith('video/');
  const fileName = item.current_relative_path.split('/').pop() || 'media';
  const formatBadge = getFormatBadge(item.mime_type, item.current_relative_path);

  const thumbnailUrl = serverIp ? getThumbnailUrl(serverIp, serverPort, item.id) : null;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      android_ripple={{
        color: colors.primary + '18',
        borderless: false,
      }}
    >
      {/* Thumbnail Box */}
      <View
        style={[
          styles.thumbnailBox,
          {
            backgroundColor: isVideo
              ? colors.tertiaryContainer + '60'
              : colors.primaryContainer + '60',
          },
        ]}
      >
        {thumbnailUrl && !imageError ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            onError={() => setImageError(true)}
          />
        ) : (
          <MaterialIcons
            name={isVideo ? 'videocam' : 'image'}
            size={28}
            color={isVideo ? colors.tertiary : colors.primary}
          />
        )}

        {isVideo && item.duration_seconds ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {formatDuration(item.duration_seconds)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Details Container */}
      <View style={styles.textContainer}>
        <Text
          style={[styles.fileName, { color: colors.onSurface }]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {fileName}
        </Text>

        <Text
          style={[styles.pathText, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {item.current_relative_path}
        </Text>

        <View style={styles.chipsRow}>
          <View style={[styles.miniChip, { backgroundColor: colors.surfaceContainerHighest }]}>
            <Text style={[styles.miniChipText, { color: colors.primary }]}>{formatBadge}</Text>
          </View>

          <Text style={[styles.sizeText, { color: colors.outline }]}>
            {formatBytes(item.file_size)}
          </Text>

          {item.album_name && (
            <View style={[styles.albumChip, { backgroundColor: colors.secondaryContainer }]}>
              <MaterialIcons name="folder" size={12} color={colors.onSecondaryContainer} style={{ marginRight: 2 }} />
              <Text style={[styles.albumChipText, { color: colors.onSecondaryContainer }]} numberOfLines={1}>
                {item.album_name}
              </Text>
            </View>
          )}
        </View>
      </View>

      <MaterialIcons
        name="chevron-right"
        size={22}
        color={colors.outline}
        style={styles.chevron}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: Shapes.large,
    marginBottom: Spacing.two,
    borderWidth: 1,
    ...Elevation.level1,
  },
  thumbnailBox: {
    width: 68,
    height: 68,
    borderRadius: Shapes.medium,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginRight: Spacing.three,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pathText: {
    fontSize: 11,
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  miniChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  miniChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  sizeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  albumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Shapes.full,
    maxWidth: 120,
  },
  albumChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  chevron: {
    marginLeft: Spacing.one,
  },
});
