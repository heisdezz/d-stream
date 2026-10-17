import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type * as MediaLibrary from 'expo-media-library/legacy';

// OTA JavaScript can reach an older APK before its new native module is installed.
const mediaLibrary: typeof import('expo-media-library/legacy') | null =
  requireOptionalNativeModule('ExpoMediaLibrary')
    ? require('expo-media-library/legacy')
    : null;

export function isDeviceMediaAvailable(): boolean {
  return mediaLibrary !== null;
}

function requireMediaLibrary(): typeof import('expo-media-library/legacy') {
  if (!mediaLibrary) throw new Error('Device media needs a newer app build. Update the app to browse and upload photos.');
  return mediaLibrary;
}

export type DeviceMedia = MediaLibrary.Asset;
export type DeviceAlbum = Pick<MediaLibrary.Album, 'id' | 'title' | 'assetCount'>;

export async function getDeviceAlbums(): Promise<DeviceAlbum[]> {
  const albums = await requireMediaLibrary().getAlbumsAsync({ includeSmartAlbums: true });
  return albums.sort((a, b) => a.title.localeCompare(b.title));
}

export async function requestDeviceMediaAccess(): Promise<boolean> {
  const library = requireMediaLibrary();
  const current = await library.getPermissionsAsync(false, ['photo', 'video']);
  if (current.granted || current.accessPrivileges === 'limited') return true;
  const requested = await library.requestPermissionsAsync(false, ['photo', 'video']);
  return requested.granted || requested.accessPrivileges === 'limited';
}

export async function getDeviceMediaPage(after?: string, albumId?: string) {
  return requireMediaLibrary().getAssetsAsync({
    first: 36,
    ...(after ? { after } : {}),
    ...(albumId && albumId !== '__all__' ? { album: albumId } : {}),
    mediaType: ['photo', 'video'],
    sortBy: [['creationTime', false]],
  });
}

export async function getDeviceMediaById(id: string): Promise<MediaLibrary.AssetInfo> {
  return requireMediaLibrary().getAssetInfoAsync(id, { shouldDownloadFromNetwork: false });
}

export async function deleteDeviceMedia(id: string): Promise<boolean> {
  return requireMediaLibrary().deleteAssetsAsync(id);
}

export async function getDeviceMediaUploadUri(asset: DeviceMedia): Promise<string> {
  if (Platform.OS === 'android') {
    // MediaStore owns these files on recent Android versions. Use its readable
    // content URI instead of attempting direct access to the external file path.
    return requireMediaLibrary().getAssetContentUriAsync(asset);
  }
  const info = await requireMediaLibrary().getAssetInfoAsync(asset, { shouldDownloadFromNetwork: true });
  const uri = info.localUri || info.uri;
  if (!uri?.startsWith('file://')) {
    throw new Error('This item could not be made available as a local file.');
  }
  return uri;
}
