import React, { memo } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image, useImage } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import type { DeviceMedia } from '@/services/device-media';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const PhotoPreview = memo(function PhotoPreview({ asset }: { asset: DeviceMedia }) {
  const preview = useImage(asset.uri, { maxWidth: 256, maxHeight: 256, onError: () => {} });
  return preview
    ? <Image source={preview} recyclingKey={asset.id} style={StyleSheet.absoluteFill} contentFit="cover" />
    : <MaterialIcons name="image" size={32} color="#888" />;
});

interface Props {
  assets: DeviceMedia[];
  selected: Record<string, boolean>;
  onOpen: (asset: DeviceMedia) => void;
  onSelect: (asset: DeviceMedia) => void;
  onLoadMore: () => void;
}

export function DeviceMediaGrid({ assets, selected, onOpen, onSelect, onLoadMore }: Props) {
  const { colors } = useMaterialTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tileWidth = (Math.min(width, MaxContentWidth + Spacing.four * 2) - Spacing.four * 2 - Spacing.one * 2) / 3;
  const selecting = Object.values(selected).some(Boolean);
  return <FlatList
    data={assets}
    numColumns={3}
    keyExtractor={(asset) => asset.id}
    contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 104 }]}
    columnWrapperStyle={{ gap: Spacing.one }}
    onEndReached={onLoadMore}
    onEndReachedThreshold={0.25}
    initialNumToRender={9}
    maxToRenderPerBatch={6}
    windowSize={3}
    renderItem={({ item }) => <Pressable
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityLabel={`${item.mediaType === 'video' ? 'Video' : 'Photo'} ${item.filename}`}
      accessibilityHint={selecting ? 'Toggle selection' : 'Open media; hold to select for upload'}
      accessibilityState={selecting ? { checked: Boolean(selected[item.id]) } : undefined}
      onPress={() => selecting ? onSelect(item) : onOpen(item)}
      onLongPress={() => onSelect(item)}
      style={[styles.tile, { width: tileWidth, height: tileWidth, backgroundColor: colors.surfaceContainer }]}
    >
      {item.mediaType === 'photo'
        ? <PhotoPreview asset={item} />
        : <MaterialIcons name="play-circle-outline" size={40} color={colors.onSurfaceVariant} />}
      {item.mediaType === 'video' && <MaterialIcons name="videocam" size={20} color={colors.onSurfaceVariant} style={styles.videoIcon} />}
      {selected[item.id] && <View pointerEvents="none" style={[styles.selectedBorder, { borderColor: colors.primary }]} />}
      {selecting && <View style={[styles.check, { backgroundColor: selected[item.id] ? colors.primary : '#0009' }]}>
        <MaterialIcons name={selected[item.id] ? 'check' : 'add'} size={17} color="white" />
      </View>}
    </Pressable>}
  />;
}

const styles = StyleSheet.create({
  grid: { padding: Spacing.four, gap: Spacing.one, maxWidth: MaxContentWidth + Spacing.four * 2, alignSelf: 'center' },
  tile: { borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  videoIcon: { position: 'absolute', left: 8, bottom: 8 },
  check: { position: 'absolute', right: 7, top: 7, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  selectedBorder: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderWidth: 3, borderRadius: 10 },
});
