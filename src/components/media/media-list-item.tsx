import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { MediaItem } from '@/types/models';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { M3Badge } from '../material/m3-badge';
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

  const thumbnailUrl = serverIp ? getThumbnailUrl(serverIp, serverPort, item.id) : null;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
        },
        pressed && { opacity: Platform.OS === 'ios' ? 0.75 : 0.9 },
      ]}
      android_ripple={{
        color: colors.primary + '15',
        borderless: false,
      }}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: isVideo
              ? colors.tertiaryContainer
              : colors.primaryContainer,
          },
        ]}
      >
        {thumbnailUrl && !imageError ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnailImage}
            contentFit="cover"
            transition={200}
            onError={() => setImageError(true)}
          />
        ) : (
          <MaterialIcons
            name={isVideo ? 'videocam' : 'image'}
            size={24}
            color={isVideo ? colors.onTertiaryContainer : colors.onPrimaryContainer}
          />
        )}
      </View>

      <View style={styles.textContainer}>
        <Text
          style={[styles.fileName, { color: colors.onSurface }]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {fileName}
        </Text>
        <Text
          style={[styles.path, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {item.current_relative_path}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.outline }]}>
            {formatBytes(item.file_size)}
          </Text>
          {item.album_name && (
            <Text style={[styles.albumName, { color: colors.secondary }]}>
              • {item.album_name}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.badgeContainer}>
        <M3Badge
          label={isVideo ? 'VIDEO' : 'IMAGE'}
          variant={isVideo ? 'tertiary' : 'primary'}
          size="small"
        />
        <MaterialIcons
          name="chevron-right"
          size={20}
          color={colors.outline}
          style={{ marginTop: 4 }}
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: Shapes.medium,
    marginBottom: Spacing.one,
    borderWidth: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '700',
  },
  path: {
    fontSize: 11,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '500',
  },
  albumName: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  badgeContainer: {
    alignItems: 'flex-end',
    marginLeft: Spacing.one,
  },
});
