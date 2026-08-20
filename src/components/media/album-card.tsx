import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Album } from '@/types/models';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing, Elevation } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { M3Badge } from '../material/m3-badge';
import { getThumbnailUrl } from '@/services/sync-api';

export interface AlbumCardProps {
  album: Album;
  onPress: (album: Album) => void;
  width?: number;
  serverIp?: string;
  serverPort?: number;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({
  album,
  onPress,
  width,
  serverIp,
  serverPort = 8080,
}) => {
  const { colors } = useMaterialTheme();
  const [imageError, setImageError] = useState(false);

  const coverUrl =
    album.cover_media_id && serverIp
      ? getThumbnailUrl(serverIp, serverPort, album.cover_media_id)
      : null;

  return (
    <Pressable
      onPress={() => onPress(album)}
      style={({ pressed }) => [
        styles.card,
        {
          width: width ?? '100%',
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.outlineVariant,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      android_ripple={{
        color: colors.primary + '20',
        borderless: false,
      }}
    >
      <View style={styles.contentRow}>
        {/* Cover Thumbnail / Folder Icon */}
        <View
          style={[
            styles.coverContainer,
            { backgroundColor: colors.surfaceContainerHighest },
          ]}
        >
          {coverUrl && !imageError ? (
            <Image
              source={{ uri: coverUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              onError={() => setImageError(true)}
            />
          ) : (
            <MaterialIcons
              name="folder-special"
              size={32}
              color={colors.primary}
            />
          )}

          <View style={styles.coverOverlayBadge}>
            <Text style={styles.coverOverlayText}>{album.media_count}</Text>
          </View>
        </View>

        {/* Info Column */}
        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.name, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {album.name}
            </Text>
            <M3Badge
              label={`${album.media_count} items`}
              variant="secondary"
              size="small"
            />
          </View>

          <Text
            style={[styles.path, { color: colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {album.relative_path}
          </Text>

          {album.description ? (
            <Text
              style={[styles.description, { color: colors.outline }]}
              numberOfLines={1}
            >
              {album.description}
            </Text>
          ) : (
            <Text style={[styles.description, { color: colors.outline }]}>
              Created {new Date(album.created_at).toLocaleDateString()}
            </Text>
          )}
        </View>

        <MaterialIcons name="chevron-right" size={24} color={colors.outline} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Shapes.large,
    padding: Spacing.two + 2,
    marginBottom: Spacing.two,
    borderWidth: 1,
    ...Elevation.level1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverContainer: {
    width: 72,
    height: 72,
    borderRadius: Shapes.medium,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginRight: Spacing.three,
  },
  coverOverlayBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  coverOverlayText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
    marginRight: Spacing.one,
  },
  path: {
    fontSize: 11,
    marginTop: 2,
  },
  description: {
    fontSize: 11,
    marginTop: 3,
  },
});
