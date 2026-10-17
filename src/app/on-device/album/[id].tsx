import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { DeviceMediaGrid } from '@/components/device/device-media-grid';
import { DeviceUploadModal } from '@/components/device/device-upload-modal';
import { useDeviceMediaAccess } from '@/hooks/use-device-media-access';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useAppStore } from '@/store/use-app-store';
import { getDeviceMediaPage, type DeviceMedia } from '@/services/device-media';
import { uploadDeviceSelection } from '@/services/device-upload';
import { catalogError } from '@/services/catalog-api';
import { Spacing } from '@/constants/theme';

export default function DeviceAlbumScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const router = useRouter();
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const { requiresBuild, status: access, retry } = useDeviceMediaAccess();
  const ip = useAppStore((state) => state.ip);
  const port = useAppStore((state) => state.port);
  const serverStatus = useAppStore((state) => state.status);
  const albums = useAppStore((state) => state.albums);
  const syncDatabase = useAppStore((state) => state.syncDatabase);
  const [assets, setAssets] = useState<DeviceMedia[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const cursor = useRef<string | undefined>(undefined);
  const hasMore = useRef(true);
  const loadingPage = useRef(false);
  const selectedAssets = assets.filter((asset) => selected[asset.id]);

  const loadPage = useCallback(async (reset: boolean) => {
    if (loadingPage.current || !id || (!reset && !hasMore.current)) return;
    loadingPage.current = true;
    if (reset) { setLoading(true); setError(false); cursor.current = undefined; hasMore.current = true; }
    try {
      const page = await getDeviceMediaPage(reset ? undefined : cursor.current, id);
      cursor.current = page.endCursor;
      hasMore.current = page.hasNextPage;
      setAssets((previous) => reset ? page.assets : [
        ...previous,
        ...page.assets.filter((asset) => !previous.some((item) => item.id === asset.id)),
      ]);
    } catch {
      setError(true);
      hasMore.current = false;
    } finally {
      setLoading(false);
      loadingPage.current = false;
    }
  }, [id]);

  useEffect(() => {
    if (access === 'granted') void loadPage(true);
  }, [access, loadPage]);

  const toggleSelected = (asset: DeviceMedia) => setSelected((previous) => ({ ...previous, [asset.id]: !previous[asset.id] }));
  const openMedia = (asset: DeviceMedia) => router.push({
    pathname: '/on-device/media/[id]',
    params: { id: asset.id, albumId: id, title: asset.filename },
  } as Href);

  const handleUpload = async (destinationAlbumId: number, deleteAfterUpload: boolean) => {
    if (uploading || !selectedAssets.length) return;
    setUploading(true);
    let lastProgress = '';
    try {
      const result = await uploadDeviceSelection(
        selectedAssets,
        { ip, port, albumId: destinationAlbumId },
        deleteAfterUpload,
        (item, total, percent) => {
          const next = `${item}/${total} · ${percent}%`;
          if (next !== lastProgress) { lastProgress = next; setProgress(next); }
        },
        (asset, deleted) => {
          setSelected((previous) => ({ ...previous, [asset.id]: false }));
          if (deleted) setAssets((previous) => previous.filter((item) => item.id !== asset.id));
        },
      );
      if (result.uploaded) {
        setProgress('Syncing library…');
        const sync = await syncDatabase();
        if (!sync.success) toast.info('Upload finished. Sync the library to see new media.');
        toast.success(`${result.uploaded} item${result.uploaded === 1 ? '' : 's'} uploaded.`);
      }
      if (result.deletionFailures) toast.info(`${result.deletionFailures} original${result.deletionFailures === 1 ? '' : 's'} remain on this device.`);
      if (result.error) toast.error(catalogError(result.error));
      if (!result.error) setShowUpload(false);
    } catch (uploadError) {
      toast.error(catalogError(uploadError));
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <View style={styles.header}>
      <Text numberOfLines={1} style={[styles.title, { color: colors.onBackground }]}>{title || 'Device album'}</Text>
      <Text style={{ color: colors.onSurfaceVariant }}>{assets.length} item{assets.length === 1 ? '' : 's'} loaded · Tap to view, hold to select</Text>
    </View>
    {requiresBuild ? <View style={styles.center}><Text style={[styles.message, { color: colors.onSurface }]}>Install the latest app build to browse device media.</Text></View>
      : access === 'loading' || loading && assets.length === 0 ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      : access !== 'granted' ? <View style={styles.center}>
        <Text style={[styles.message, { color: colors.onSurface }]}>Allow access to photos and videos.</Text>
        <Pressable onPress={() => void retry()} style={styles.retry}><Text style={{ color: colors.primary }}>Allow access</Text></Pressable>
      </View> : error && assets.length === 0 ? <View style={styles.center}>
        <Text style={[styles.message, { color: colors.error }]}>Could not load this album.</Text>
        <Pressable onPress={() => void loadPage(true)} style={styles.retry}><Text style={{ color: colors.primary }}>Try again</Text></Pressable>
      </View> : assets.length === 0 ? <View style={styles.center}>
        <MaterialIcons name="photo-library" size={40} color={colors.outline} />
        <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>No photos or videos here.</Text>
      </View> : <DeviceMediaGrid assets={assets} selected={selected} onOpen={openMedia} onSelect={toggleSelected} onLoadMore={() => void loadPage(false)} />}
    {selectedAssets.length > 0 && <View style={[styles.selectionBar, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.two }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Clear selection" onPress={() => setSelected({})} style={styles.clear}>
        <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
      </Pressable>
      <Text style={[styles.selectionCount, { color: colors.onSurface }]}>{selectedAssets.length} selected</Text>
      <Pressable accessibilityRole="button" onPress={() => setShowUpload(true)} style={[styles.uploadButton, { backgroundColor: colors.primary }]}>
        <MaterialIcons name="cloud-upload" size={19} color={colors.onPrimary} />
        <Text style={[styles.uploadText, { color: colors.onPrimary }]}>Upload</Text>
      </Pressable>
    </View>}
    <DeviceUploadModal
      visible={showUpload}
      albums={albums}
      count={selectedAssets.length}
      connected={serverStatus === 'connected'}
      busy={uploading}
      progress={progress}
      onClose={() => { if (!uploading) setShowUpload(false); }}
      onUpload={(albumId, deleteAfterUpload) => void handleUpload(albumId, deleteAfterUpload)}
    />
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 22, fontWeight: '800', marginBottom: Spacing.one },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  message: { fontSize: 15, textAlign: 'center', marginTop: Spacing.two },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.four },
  selectionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, gap: Spacing.two },
  clear: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  selectionCount: { flex: 1, fontSize: 15, fontWeight: '700' },
  uploadButton: { minHeight: 48, borderRadius: 24, paddingHorizontal: Spacing.four, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  uploadText: { fontSize: 14, fontWeight: '800' },
});
