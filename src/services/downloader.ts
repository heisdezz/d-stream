import * as FileSystem from 'expo-file-system/legacy';
import { Platform, PermissionsAndroid } from 'react-native';
import axios from 'axios';
import { toast } from 'sonner-native';
import { getMediaStreamUrl } from '@/services/sync-api';
import {
  getSavedDownloadLocation,
  saveDownloadedItemRecord,
  DownloadedItemRecord,
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
    let permissionsToRequest: any[] = [];

    if (typeof apiLevel === 'number' && apiLevel >= 33) {
      permissionsToRequest = [
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
      ];
    } else {
      permissionsToRequest = [
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ];
    }

    // Check current permission statuses
    let allGranted = true;
    for (const perm of permissionsToRequest) {
      const check = await PermissionsAndroid.check(perm);
      if (!check) {
        allGranted = false;
        break;
      }
    }

    if (allGranted) return true;

    // Request permissions explicitly
    const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);
    const isGranted = Object.values(results).some(
      (res) => res === PermissionsAndroid.RESULTS.GRANTED
    );

    if (!isGranted) {
      toast.error('Storage permission is required to save media files locally.', {
        duration: 4000,
      });
    }

    return isGranted;
  } catch (err) {
    console.warn('[Downloader] Storage permission error:', err);
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
  const toastId = `dl-${item.id}`;

  try {
    const hasPerm = await requestStoragePermission();
    if (!hasPerm) {
      toast.error('Storage permission was not granted.', { id: toastId });
      return { success: false, error: 'Storage permission denied' };
    }

    const streamUrl = getMediaStreamUrl(ip, port, item.id);
    const fileName = item.current_relative_path.split('/').pop() || `media_${item.id}`;
    const destDir = await resolveDestinationDirectory(item.album_name);
    const destFilePath = `${destDir}${fileName}`;

    toast.loading(`Downloading ${fileName}... 0%`, { id: toastId });

    // Use FileSystem resumable download with live progress toast updates
    const downloadResumable = FileSystem.createDownloadResumable(
      streamUrl,
      destFilePath,
      {},
      (progressData) => {
        const totalWritten = progressData.totalBytesWritten;
        const totalExpected = progressData.totalBytesExpectedToWrite || item.file_size || 1;
        const pct = Math.min(100, Math.round((totalWritten / totalExpected) * 100));

        toast.loading(`Downloading ${fileName}... ${pct}%`, { id: toastId });

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
      toast.error('Download failed to complete.', { id: toastId });
      return { success: false, error: 'Download failed' };
    }

    const fileCheck = await FileSystem.getInfoAsync(result.uri);
    if (!fileCheck.exists) {
      toast.error('Downloaded file missing on disk.', { id: toastId });
      return { success: false, error: 'File missing' };
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

    toast.success(`Download complete! Saved to ${record.albumName}/${fileName}`, {
      id: toastId,
      duration: 4000,
    });

    return { success: true, localUri: result.uri };
  } catch (err: any) {
    console.error('[Downloader] Error:', err);
    toast.error(`Download failed: ${err?.message || 'Network error'}`, { id: toastId });
    return { success: false, error: err?.message || 'Download error' };
  }
}
