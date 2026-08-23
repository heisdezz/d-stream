import * as FileSystem from 'expo-file-system/legacy';
import { Platform, PermissionsAndroid } from 'react-native';
import { getMediaStreamUrl } from '@/services/sync-api';
import {
  getSavedDownloadLocation,
  saveDownloadedItemRecord,
  DownloadedItemRecord,
  DEFAULT_DOWNLOAD_LOCATION,
} from '@/services/storage';
import { MediaItem } from '@/types/models';

export interface DownloadProgress {
  mediaId: number;
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  percentage: number;
}

export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const apiLevel = Platform.Version;
    if (typeof apiLevel === 'number' && apiLevel >= 33) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
      ]);
      return (
        results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] === PermissionsAndroid.RESULTS.GRANTED ||
        results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
      return (
        results[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED ||
        results[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
  } catch (err) {
    console.warn('[Downloader] Permission request failed:', err);
    return true;
  }
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'General';
}

export async function resolveDestinationDirectory(albumName?: string): Promise<string> {
  const relLocation = await getSavedDownloadLocation();
  const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  
  const folderPath = relLocation.startsWith('/')
    ? `${baseDir}${relLocation.slice(1)}`
    : `${baseDir}${relLocation}`;

  const cleanAlbum = sanitizeFolderName(albumName || 'Uncategorized');
  const fullDestDir = `${folderPath}/${cleanAlbum}/`;

  const dirInfo = await FileSystem.getInfoAsync(fullDestDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(fullDestDir, { intermediates: true });
  }

  return fullDestDir;
}

export async function downloadMediaItem(
  item: MediaItem,
  ip: string,
  port: number,
  onProgress?: (progress: DownloadProgress) => void
): Promise<{ success: boolean; localUri?: string; error?: string }> {
  try {
    const hasPerm = await requestStoragePermission();
    if (!hasPerm) {
      return { success: false, error: 'Storage permission denied by user' };
    }

    const streamUrl = getMediaStreamUrl(ip, port, item.id);
    const fileName = item.current_relative_path.split('/').pop() || `media_${item.id}`;
    const destDir = await resolveDestinationDirectory(item.album_name);
    const destFilePath = `${destDir}${fileName}`;

    const downloadResumable = FileSystem.createDownloadResumable(
      streamUrl,
      destFilePath,
      {},
      (downloadProgress) => {
        const totalWritten = downloadProgress.totalBytesWritten;
        const totalExpected = downloadProgress.totalBytesExpectedToWrite || item.file_size || 1;
        const pct = Math.min(100, Math.round((totalWritten / totalExpected) * 100));
        onProgress?.({
          mediaId: item.id,
          totalBytesWritten: totalWritten,
          totalBytesExpectedToWrite: totalExpected,
          percentage: pct,
        });
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      return { success: false, error: 'Download failed to complete' };
    }

    const fileCheck = await FileSystem.getInfoAsync(result.uri);
    if (!fileCheck.exists) {
      return { success: false, error: 'Downloaded file not found on disk' };
    }

    const record: DownloadedItemRecord = {
      mediaId: item.id,
      localUri: result.uri,
      albumName: item.album_name || 'Uncategorized',
      fileName,
      fileSize: fileCheck.size ?? item.file_size,
      mimeType: item.mime_type,
      downloadedAt: new Date().toISOString(),
    };

    await saveDownloadedItemRecord(record);

    return { success: true, localUri: result.uri };
  } catch (err: any) {
    console.error('[Downloader] Download error:', err);
    return { success: false, error: err?.message || 'Download error occurred' };
  }
}
