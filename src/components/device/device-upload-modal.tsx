import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { DebouncedSearchBar } from '@/components/common/debounced-search-bar';
import { Spacing } from '@/constants/theme';
import type { Album } from '@/types/models';

interface Props {
  visible: boolean;
  albums: Album[];
  count: number;
  connected: boolean;
  busy: boolean;
  progress: string;
  onClose: () => void;
  onUpload: (albumId: number, deleteAfterUpload: boolean) => void;
}

export function DeviceUploadModal({ visible, albums, count, connected, busy, progress, onClose, onUpload }: Props) {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const [albumId, setAlbumId] = useState<number | null>(null);
  const [deleteAfterUpload, setDeleteAfterUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    if (!visible) setSearchQuery('');
  }, [visible]);
  const filteredAlbums = albums.filter((album) =>
    album.name.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase()),
  );

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityLabel="Close upload options" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.heading}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.onSurface }]}>Upload {count} item{count === 1 ? '' : 's'}</Text>
            <Text style={{ color: colors.onSurfaceVariant }}>Choose a library album</Text>
          </View>
          <Pressable onPress={onClose} disabled={busy} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <MaterialIcons name="close" size={24} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>
        {!connected && !busy ? <Text style={[styles.notice, { color: colors.error }]}>Connect to the desktop server before uploading.</Text> : null}
        {albums.length === 0 ? <Text style={[styles.notice, { color: colors.onSurfaceVariant }]}>Sync your library to choose an album.</Text> : <>
          {visible && <DebouncedSearchBar
            value={searchQuery}
            onSearch={setSearchQuery}
            placeholder="Search albums..."
            style={styles.searchBar}
          />}
          <FlatList
            data={filteredAlbums}
            keyExtractor={(album) => String(album.id)}
            style={styles.albumList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={[styles.notice, { color: colors.onSurfaceVariant }]}>No albums match your search.</Text>}
            renderItem={({ item }) => <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: albumId === item.id }}
              accessibilityLabel={item.name}
              disabled={busy}
              onPress={() => setAlbumId(item.id)}
              style={[styles.albumRow, { backgroundColor: albumId === item.id ? colors.primaryContainer : colors.surface }]}
            >
              <MaterialIcons name="folder" size={22} color={albumId === item.id ? colors.primary : colors.onSurfaceVariant} />
              <Text numberOfLines={1} style={[styles.albumName, { color: colors.onSurface }]}>{item.name}</Text>
              {albumId === item.id && <MaterialIcons name="check-circle" size={22} color={colors.primary} />}
            </Pressable>}
          />
        </>}
        <View style={styles.deleteRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.deleteTitle, { color: colors.onSurface }]}>Delete originals after upload</Text>
            <Text style={[styles.deleteHint, { color: colors.onSurfaceVariant }]}>Only successfully uploaded files are removed. Your device may ask for confirmation.</Text>
          </View>
          <Switch value={deleteAfterUpload} onValueChange={setDeleteAfterUpload} disabled={busy} accessibilityLabel="Delete device originals after successful upload" />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !connected || albumId === null || !count}
          onPress={() => albumId !== null && onUpload(albumId, deleteAfterUpload)}
          style={[styles.uploadButton, { backgroundColor: colors.primary, opacity: busy || !connected || albumId === null ? 0.5 : 1 }]}
        >
          <MaterialIcons name="cloud-upload" size={20} color={colors.onPrimary} />
          <Text style={[styles.uploadText, { color: colors.onPrimary }]}>{busy ? progress : 'Start upload'}</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  sheet: { padding: Spacing.four, paddingBottom: Spacing.six, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '82%' },
  heading: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.three },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  notice: { fontSize: 14, marginBottom: Spacing.two },
  searchBar: { marginBottom: Spacing.two },
  albumList: { flexGrow: 0, maxHeight: 280 },
  albumRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.two, borderRadius: 12 },
  albumName: { flex: 1, fontSize: 15 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 72, marginTop: Spacing.three, marginBottom: Spacing.two },
  deleteTitle: { fontSize: 15, fontWeight: '700' },
  deleteHint: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  uploadButton: { minHeight: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  uploadText: { fontSize: 15, fontWeight: '800' },
});
