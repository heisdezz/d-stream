import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Album } from '@/types/models';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing } from '@/constants/theme';
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
        },
        pressed && { opacity: Platform.OS === 'ios' ? 0.75 : 0.9 },
      ]}
      android_ripple={{
        color: colors.secondary + '15',
        borderless: false,
      }}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: colors.secondaryContainer },
          ]}
        >
          {coverUrl && !imageError ? (
            <Image
              source={{ uri: coverUrl }}
              style={styles.coverImage}
              contentFit="cover"
              transition={200}
              onError={() => setImageError(true)}
            />
          ) : (
            <MaterialIcons
              name="folder"
              size={24}
              color={colors.onSecondaryContainer}
            />
          )}
        </View>

        <M3Badge
          label={`${album.media_count} items`}
          variant="secondary"
          size="small"
        />
      </View>

      <Text
        style={[styles.name, { color: colors.onSurface }]}
        numberOfLines={1}
      >
        {album.name}
      </Text>

      <Text
        style={[styles.path, { color: colors.outline }]}
        numberOfLines={1}
      >
        {album.relative_path}
      </Text>

      {album.description && (
        <Text
          style={[styles.description, { color: colors.onSurfaceVariant }]}
          numberOfLines={2}
        >
          {album.description}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Shapes.large,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  path: {
    fontSize: 11,
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    marginTop: Spacing.one,
    lineHeight: 16,
  },
});
