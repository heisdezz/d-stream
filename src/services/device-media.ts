import * as MediaLibrary from 'expo-media-library/legacy';

export type DeviceMedia = MediaLibrary.Asset;

export async function requestDeviceMediaAccess(): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
  if (current.granted || current.accessPrivileges === 'limited') return true;
  const requested = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
  return requested.granted || requested.accessPrivileges === 'limited';
}

export async function getDeviceMediaPage(after?: string) {
  return MediaLibrary.getAssetsAsync({
    first: 60,
    ...(after ? { after } : {}),
    mediaType: ['photo', 'video'],
    sortBy: ['creationTime'],
  });
}

export async function getDeviceMediaFileUri(asset: DeviceMedia): Promise<string> {
  const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: true });
  const uri = info.localUri || info.uri;
  if (!uri?.startsWith('file://')) {
    throw new Error('This item could not be made available as a local file.');
  }
  return uri;
}
