import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useDeviceMediaAccess } from '@/hooks/use-device-media-access';
import { getDeviceAlbums, type DeviceAlbum } from '@/services/device-media';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function OnDeviceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useMaterialTheme();
  const { requiresBuild, status, retry } = useDeviceMediaAccess();
  const [albums, setAlbums] = useState<DeviceAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try { setAlbums(await getDeviceAlbums()); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    if (status === 'granted') void refresh();
  }, [status, refresh]));

  const openAlbum = (id: string, title: string) => router.push({
    pathname: '/on-device/album/[id]',
    params: { id, title },
  } as Href);

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.onBackground }]}>On this device</Text>
      <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>Browse your phone albums, then choose media to upload.</Text>
    </View>
    {requiresBuild ? <View style={styles.center}>
      <MaterialIcons name="system-update" size={40} color={colors.primary} />
      <Text style={[styles.message, { color: colors.onSurface }]}>Install the latest app build to browse device media.</Text>
    </View> : status === 'loading' || loading && albums.length === 0 ?
      <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      : status !== 'granted' ? <View style={styles.center}>
        <MaterialIcons name="perm-media" size={40} color={colors.outline} />
        <Text style={[styles.message, { color: colors.onSurface }]}>Allow access to photos and videos to browse this device.</Text>
        <Pressable onPress={() => void retry()} accessibilityRole="button" style={styles.retry}>
          <Text style={{ color: colors.primary }}>Allow access</Text>
        </Pressable>
      </View> : <FlatList
        data={albums}
        keyExtractor={(album) => album.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.six }]}
        onRefresh={() => void refresh()}
        refreshing={loading}
        ListHeaderComponent={<Pressable
          accessibilityRole="button"
          accessibilityLabel="Open all photos and videos"
          onPress={() => openAlbum('__all__', 'All media')}
          style={[styles.row, { backgroundColor: colors.surfaceContainer }]}
        >
          <View style={[styles.icon, { backgroundColor: colors.primaryContainer }]}><MaterialIcons name="perm-media" size={24} color={colors.primary} /></View>
          <View style={styles.rowText}>
            <Text style={[styles.name, { color: colors.onSurface }]}>All media</Text>
            <Text style={{ color: colors.onSurfaceVariant }}>Photos and videos</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.onSurfaceVariant} />
        </Pressable>}
        ListEmptyComponent={error ? <View style={styles.center}>
          <Text style={[styles.message, { color: colors.error }]}>Could not load device albums.</Text>
          <Pressable onPress={() => void refresh()} accessibilityRole="button" style={styles.retry}><Text style={{ color: colors.primary }}>Try again</Text></Pressable>
        </View> : <Text style={[styles.empty, { color: colors.onSurfaceVariant }]}>No albums found. All media may still contain photos and videos.</Text>}
        renderItem={({ item }) => <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.title}, ${item.assetCount ?? 0} items`}
          onPress={() => openAlbum(item.id, item.title)}
          style={[styles.row, { backgroundColor: colors.surfaceContainer }]}
        >
          <View style={[styles.icon, { backgroundColor: colors.secondaryContainer }]}><MaterialIcons name="folder" size={24} color={colors.secondary} /></View>
          <View style={styles.rowText}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.onSurface }]}>{item.title}</Text>
            <Text style={{ color: colors.onSurfaceVariant }}>{item.assetCount ?? 0} item{item.assetCount === 1 ? '' : 's'}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.onSurfaceVariant} />
        </Pressable>}
      />}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: Spacing.one },
  list: { paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  row: { minHeight: 72, borderRadius: 16, paddingHorizontal: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.two },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  message: { fontSize: 15, textAlign: 'center', marginTop: Spacing.two },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.four },
  empty: { textAlign: 'center', padding: Spacing.four },
});
