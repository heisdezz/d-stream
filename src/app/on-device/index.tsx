import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useAppStore } from '@/store/use-app-store';
import { DeviceMedia, getDeviceMediaPage, requestDeviceMediaAccess } from '@/services/device-media';
import { catalogError, uploadDeviceMedia } from '@/services/catalog-api';
import { Spacing, MaxContentWidth } from '@/constants/theme';

export default function OnDeviceScreen() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ip = useAppStore((state) => state.ip);
  const port = useAppStore((state) => state.port);
  const status = useAppStore((state) => state.status);
  const albums = useAppStore((state) => state.albums);
  const syncDatabase = useAppStore((state) => state.syncDatabase);
  const [assets, setAssets] = useState<DeviceMedia[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [albumId, setAlbumId] = useState<number | null>(null);
  const [showAlbums, setShowAlbums] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const cursor = useRef<string | undefined>(undefined);
  const hasMore = useRef(true);
  const loadingPage = useRef(false);
  const selectedAssets = assets.filter((asset) => selected[asset.id]);
  const chosenAlbum = albums.find((album) => album.id === albumId);
  const tileWidth = (Math.min(width, MaxContentWidth + Spacing.four * 2) - Spacing.four * 2 - Spacing.one * 2) / 3;

  const loadPage = useCallback(async (reset: boolean) => {
    if (loadingPage.current || (!reset && !hasMore.current)) return;
    loadingPage.current = true;
    if (reset) setLoading(true);
    try {
      if (reset) {
        const granted = await requestDeviceMediaAccess();
        setPermissionDenied(!granted);
        if (!granted) return;
      }
      const result = await getDeviceMediaPage(reset ? undefined : cursor.current);
      cursor.current = result.endCursor;
      hasMore.current = result.hasNextPage;
      setAssets((previous) => reset ? result.assets : [
        ...previous,
        ...result.assets.filter((asset) => !previous.some((item) => item.id === asset.id)),
      ]);
    } catch (error) {
      toast.error(catalogError(error));
    } finally {
      setLoading(false);
      loadingPage.current = false;
    }
  }, []);

  useEffect(() => { void loadPage(true); }, [loadPage]);

  const handleUpload = async () => {
    if (uploading || selectedAssets.length === 0) return;
    if (status !== 'connected') {
      toast.error('Connect to the desktop server before uploading.');
      return;
    }
    if (albumId === null) {
      toast.info('Choose a destination album first.');
      setShowAlbums(true);
      return;
    }
    setUploading(true);
    let completed = 0;
    try {
      for (const asset of selectedAssets) {
        setProgress(`${completed + 1}/${selectedAssets.length} · 0%`);
        let lastPercent = -1;
        await uploadDeviceMedia(ip, port, albumId, asset, (fraction) => {
          const percent = Math.round(fraction * 100);
          if (percent !== lastPercent) {
            lastPercent = percent;
            setProgress(`${completed + 1}/${selectedAssets.length} · ${percent}%`);
          }
        });
        completed += 1;
        setSelected((previous) => ({ ...previous, [asset.id]: false }));
      }
      toast.success(`${completed} item${completed === 1 ? '' : 's'} uploaded.`);
    } catch (error) {
      toast.error(catalogError(error));
    } finally {
      setUploading(false);
      setProgress('');
      if (completed > 0) {
        const sync = await syncDatabase();
        if (!sync.success) toast.info('Upload finished. Sync the library to see the new media.');
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
        <Text style={[styles.title, { color: colors.onBackground }]}>On this device</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>Select photos and videos to send to your library.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={chosenAlbum ? `Destination album: ${chosenAlbum.name}` : 'Choose destination album'}
          onPress={() => setShowAlbums(true)}
          style={[styles.destination, { backgroundColor: colors.surfaceContainerHigh }]}
        >
          <MaterialIcons name="folder" size={20} color={colors.primary} />
          <Text numberOfLines={1} style={[styles.destinationText, { color: colors.onSurface }]}>
            {chosenAlbum ? chosenAlbum.name : 'Choose destination album'}
          </Text>
          <MaterialIcons name="expand-more" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      {loading && assets.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : permissionDenied ? (
        <View style={styles.center}>
          <MaterialIcons name="perm-media" size={40} color={colors.outline} />
          <Text style={[styles.message, { color: colors.onSurface }]}>Allow photo and video access to browse this device.</Text>
          <Pressable onPress={() => void loadPage(true)} style={styles.retry} accessibilityRole="button">
            <Text style={{ color: colors.primary }}>Allow access</Text>
          </Pressable>
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.center}><Text style={[styles.message, { color: colors.onSurfaceVariant }]}>No photos or videos found.</Text></View>
      ) : (
        <FlatList
          data={assets}
          numColumns={3}
          keyExtractor={(asset) => asset.id}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 104 }]}
          columnWrapperStyle={{ gap: Spacing.one }}
          onEndReached={() => void loadPage(false)}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`${item.mediaType === 'video' ? 'Video' : 'Photo'} ${item.filename}`}
              accessibilityState={{ checked: Boolean(selected[item.id]) }}
              onPress={() => setSelected((previous) => ({ ...previous, [item.id]: !previous[item.id] }))}
              style={[styles.tile, { width: tileWidth, height: tileWidth, backgroundColor: colors.surfaceContainer }]}
            >
              <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {item.mediaType === 'video' && <MaterialIcons name="videocam" size={20} color="white" style={styles.videoIcon} />}
              <View style={[styles.check, { backgroundColor: selected[item.id] ? colors.primary : '#0009' }]}>
                <MaterialIcons name={selected[item.id] ? 'check' : 'add'} size={17} color="white" />
              </View>
            </Pressable>
          )}
        />
      )}

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.two }]}>
        <Text style={[styles.selectedCount, { color: colors.onSurface }]}>{selectedAssets.length} selected</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={uploading ? `Uploading ${progress}` : `Upload ${selectedAssets.length} selected items`}
          disabled={uploading || selectedAssets.length === 0}
          onPress={() => void handleUpload()}
          style={[styles.uploadButton, { backgroundColor: colors.primary, opacity: uploading || !selectedAssets.length ? 0.5 : 1 }]}
        >
          <MaterialIcons name="cloud-upload" size={20} color={colors.onPrimary} />
          <Text style={[styles.uploadText, { color: colors.onPrimary }]}>{uploading ? progress : 'Upload'}</Text>
        </Pressable>
      </View>

      <Modal visible={showAlbums} transparent animationType="fade" onRequestClose={() => setShowAlbums(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAlbums(false)} accessibilityLabel="Close album chooser" />
          <View style={[styles.albumDialog, { backgroundColor: colors.surface }]}>
            <Text style={[styles.dialogTitle, { color: colors.onSurface }]}>Upload to album</Text>
            {albums.length === 0 ? (
              <Text style={{ color: colors.onSurfaceVariant }}>Connect and sync your library to choose an album.</Text>
            ) : (
              <FlatList
                data={albums}
                keyExtractor={(album) => String(album.id)}
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${item.name}`}
                    onPress={() => { setAlbumId(item.id); setShowAlbums(false); }}
                    style={styles.albumOption}
                  >
                    <MaterialIcons name="folder" size={20} color={colors.primary} />
                    <Text numberOfLines={1} style={[styles.albumName, { color: colors.onSurface }]}>{item.name}</Text>
                    {albumId === item.id && <MaterialIcons name="check" size={20} color={colors.primary} />}
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.four, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: Spacing.one, marginBottom: Spacing.three },
  destination: { minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three },
  destinationText: { flex: 1, marginHorizontal: Spacing.two, fontSize: 14, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  message: { fontSize: 15, textAlign: 'center', marginTop: Spacing.two },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.four },
  grid: { padding: Spacing.four, gap: Spacing.one, maxWidth: MaxContentWidth + Spacing.four * 2, alignSelf: 'center' },
  tile: { borderRadius: 10, overflow: 'hidden' },
  videoIcon: { position: 'absolute', left: 8, bottom: 8, textShadowColor: '#000', textShadowRadius: 4 },
  check: { position: 'absolute', right: 7, top: 7, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 72, paddingHorizontal: Spacing.four, paddingTop: Spacing.two, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectedCount: { fontSize: 14, fontWeight: '700' },
  uploadButton: { minHeight: 48, borderRadius: 24, paddingHorizontal: Spacing.four, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  uploadText: { fontSize: 14, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: Spacing.four },
  albumDialog: { borderRadius: 20, padding: Spacing.four, maxHeight: '70%' },
  dialogTitle: { fontSize: 18, fontWeight: '800', marginBottom: Spacing.two },
  albumOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  albumName: { flex: 1, fontSize: 15 },
});
