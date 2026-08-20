import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { MediaItem } from '@/types/models';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { M3Badge } from '../material/m3-badge';
import { getThumbnailUrl } from '@/services/sync-api';

export interface MediaGridItemProps {
  item: MediaItem;
  onPress: (item: MediaItem) => void;
  width: number;
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

export const MediaGridItem: React.FC<MediaGridItemProps> = ({
  item,
  onPress,
  width,
  serverIp,
  serverPort = 8080,
}) => {
  const { colors } = useMaterialTheme();
  const [imageError, setImageError] = useState(false);
  const isVideo = item.mime_type.startsWith('video/');
  const fileName = item.current_relative_path.split('/').pop() || 'media';

  const thumbnailUrl = serverIp ? getThumbnailUrl(serverIp, serverPort, item.id) : null;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.outlineVariant,
        },
        pressed && { opacity: Platform.OS === 'ios' ? 0.75 : 0.9 },
      ]}
      android_ripple={{
        color: colors.primary + '15',
        borderless: false,
      }}
    >
      {/* Thumbnail Box */}
      <View
        style={[
          styles.thumbnailBox,
          {
            backgroundColor: isVideo
              ? colors.tertiaryContainer + '50'
              : colors.primaryContainer + '50',
          },
        ]}
      >
        {thumbnailUrl && !imageError ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnailImage}
            contentFit="cover"
            transition={250}
            onError={() => setImageError(true)}
          />
        ) : (
          <MaterialIcons
            name={isVideo ? 'videocam' : 'image'}
            size={36}
            color={isVideo ? colors.tertiary : colors.primary}
          />
        )}

        {isVideo && item.duration_seconds ? (
          <View
            style={[
              styles.durationBadge,
              { backgroundColor: 'rgba(0,0,0,0.75)' },
            ]}
          >
            <Text style={styles.durationText}>
              {formatDuration(item.duration_seconds)}
            </Text>
          </View>
        ) : null}

        <View style={styles.badgeRow}>
          <M3Badge
            label={isVideo ? 'VIDEO' : 'IMG'}
            variant={isVideo ? 'tertiary' : 'primary'}
            size="small"
          />
        </View>
      </View>

      {/* Info footer */}
      <View style={styles.infoContainer}>
        <Text
          style={[styles.fileName, { color: colors.onSurface }]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {fileName}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[styles.sizeText, { color: colors.outline }]}>
            {formatBytes(item.file_size)}
          </Text>
          {item.album_name && (
            <Text
              style={[styles.albumText, { color: colors.secondary }]}
              numberOfLines={1}
            >
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
    borderRadius: Shapes.medium,
    overflow: 'hidden',
    marginBottom: Spacing.two,
    borderWidth: 1,
  },
  thumbnailBox: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  badgeRow: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Shapes.small,
  },
  durationText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  infoContainer: {
    padding: Spacing.two,
  },
  fileName: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  sizeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  albumText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
    flex: 1,
  },
});
