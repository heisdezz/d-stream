import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { VideoView } from 'expo-video';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAsyncVideoPlayer } from '@/hooks/use-async-video-player';
import { useDeviceMediaAccess } from '@/hooks/use-device-media-access';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { getDeviceMediaById } from '@/services/device-media';
import { Spacing } from '@/constants/theme';

type DeviceAssetInfo = Awaited<ReturnType<typeof getDeviceMediaById>>;

export default function DeviceMediaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const { requiresBuild, status } = useDeviceMediaAccess();
  const [asset, setAsset] = useState<DeviceAssetInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  useEffect(() => {
    if (!id || status !== 'granted') return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getDeviceMediaById(id).then((info) => {
      if (!cancelled) setAsset(info);
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not open this media item.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, status]);

  const isVideo = asset?.mediaType === 'video';
  const uri = asset?.uri || '';
  const videoUri = focused && isVideo && uri ? uri : null;
  const player = useAsyncVideoPlayer(videoUri, false, true);

  return <View style={[styles.container, { backgroundColor: '#090A0F', paddingBottom: insets.bottom + Spacing.two }]}>
    {requiresBuild ? <View style={styles.center}><Text style={styles.message}>Install the latest app build to view device media.</Text></View>
      : status === 'loading' || loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      : error || status !== 'granted' || !asset ? <View style={styles.center}>
        <MaterialIcons name="broken-image" size={44} color="white" />
        <Text style={styles.message}>{error || 'This media item is unavailable.'}</Text>
      </View> : isVideo ? videoUri ? <VideoView
        player={player}
        style={styles.viewer}
        nativeControls
        fullscreenOptions={{ enable: true }}
        contentFit="contain"
      /> : <View style={styles.center}><Text style={styles.message}>This video is unavailable.</Text></View>
        : <Image source={{ uri }} style={styles.viewer} contentFit="contain" />}
    {asset && !error && <View style={styles.caption}>
      <Text numberOfLines={1} style={styles.filename}>{asset.filename}</Text>
      <Text style={styles.meta}>{asset.width} × {asset.height}{isVideo && asset.duration ? ` · ${Math.round(asset.duration)}s` : ''}</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  viewer: { flex: 1, width: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  message: { color: 'white', fontSize: 15, textAlign: 'center', marginTop: Spacing.two },
  caption: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  filename: { color: 'white', fontSize: 16, fontWeight: '700' },
  meta: { color: '#C8C8CC', fontSize: 13, marginTop: Spacing.one },
});
