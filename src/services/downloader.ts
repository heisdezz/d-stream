import * as FileSystem from "expo-file-system/legacy";
import { Platform, PermissionsAndroid } from "react-native";
import axios from "axios";
import { toast } from "sonner-native";
import { getMediaStreamUrl, getThumbnailUrl } from "@/services/sync-api";
import {
  getSavedDownloadLocation,
  saveDownloadedItemRecord,
  DownloadedItemRecord,
} from "@/services/storage";
import { MediaItem } from "@/types/models";

export interface DownloadProgress {
  mediaId: number;
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  percentage: number;
}

export async function requestStoragePermission(): Promise<boolean> {
  console.log(
    "[Downloader] requestStoragePermission: platform=",
    Platform.OS,
    "apiLevel=",
    Platform.Version,
  );
  if (Platform.OS !== "android") return true;
  try {
    const apiLevel = Platform.Version;
    let permissionsToRequest: any[] = [];

    if (typeof apiLevel === "number" && apiLevel >= 33) {
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
      console.log("[Downloader] permission check:", perm, "=", check);
      if (!check) {
        allGranted = false;
        break;
      }
    }

    if (allGranted) {
      console.log("[Downloader] all permissions already granted");
      return true;
    }

    // Request permissions explicitly
    const results =
      await PermissionsAndroid.requestMultiple(permissionsToRequest);
    console.log("[Downloader] requestMultiple results:", results);
    const isGranted = Object.values(results).some(
      (res) => res === PermissionsAndroid.RESULTS.GRANTED,
    );

    if (!isGranted) {
      toast.error(
        "Storage permission is required to save media files locally.",
        {
          duration: 4000,
        },
      );
    }

    console.log("[Downloader] permission final result:", isGranted);
    return isGranted;
  } catch (err) {
    console.warn("[Downloader] Storage permission error:", err);
    return true;
  }
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "General";
}

// True when the directory lives inside the app's private sandbox
// (documentDirectory / cacheDirectory). Writing there needs no permission.
// Only a genuinely external / shared-storage target requires READ_MEDIA_*.
function isSandboxPath(dir: string): boolean {
  const doc = FileSystem.documentDirectory ?? "";
  const cache = FileSystem.cacheDirectory ?? "";
  return (
    (doc.length > 0 && dir.startsWith(doc)) ||
    (cache.length > 0 && dir.startsWith(cache))
  );
}

export async function resolveDestinationDirectory(
  albumName?: string,
): Promise<string> {
  const relLocation = await getSavedDownloadLocation();
  const baseDir =
    FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";

  const folderPath = relLocation.startsWith("/")
    ? `${baseDir}${relLocation.slice(1)}`
    : `${baseDir}${relLocation}`;

  const cleanAlbum = sanitizeFolderName(albumName || "Uncategorized");
  const fullDestDir = `${folderPath}/${cleanAlbum}/`;

  console.log("[Downloader] resolveDestinationDirectory:", {
    relLocation,
    baseDir,
    folderPath,
    fullDestDir,
  });

  const dirInfo = await FileSystem.getInfoAsync(fullDestDir);
  console.log("[Downloader] destDir exists?", dirInfo.exists);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(fullDestDir, { intermediates: true });
    console.log("[Downloader] created destDir:", fullDestDir);
  }

  return fullDestDir;
}

export async function deleteDownloadedFile(
  localUri?: string,
  thumbnailLocalUri?: string,
): Promise<void> {
  try {
    if (localUri) {
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
        console.log("[Downloader] Deleted local media file:", localUri);
      }
    }
    if (thumbnailLocalUri) {
      const thumbInfo = await FileSystem.getInfoAsync(thumbnailLocalUri);
      if (thumbInfo.exists) {
        await FileSystem.deleteAsync(thumbnailLocalUri, { idempotent: true });
        console.log("[Downloader] Deleted local thumbnail:", thumbnailLocalUri);
      }
    }
  } catch (err) {
    console.warn("[Downloader] Error deleting local file:", err);
  }
}

export async function downloadMediaItem(
  item: MediaItem,
  ip: string,
  port: number,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<{
  success: boolean;
  localUri?: string;
  record?: DownloadedItemRecord;
  error?: string;
}> {
  const toastId = `dl-${item.id}` || `dl-${Date.now()}`;
  console.log("[Downloader] ===== downloadMediaItem START =====", {
    itemId: item.id,
    fileSize: item.file_size,
    relativePath: item.current_relative_path,
    album: item.album_name,
  });
  try {
    const streamUrl = getMediaStreamUrl(ip, port, item.id);
    const fileName =
      item.current_relative_path.split("/").pop() || `media_${item.id}`;
    const destDir = await resolveDestinationDirectory(item.album_name);
    const destFilePath = `${destDir}${fileName}`;

    if (!isSandboxPath(destDir)) {
      console.log("[Downloader] external dest — requesting storage permission");
      const hasPerm = await requestStoragePermission();
      if (!hasPerm) {
        console.log("[Downloader] ABORT: permission not granted");
        toast.error("Storage permission was not granted.", { id: toastId });
        return { success: false, error: "Storage permission denied" };
      }
    }

    console.log("[Downloader] starting download:", {
      streamUrl,
      fileName,
      destFilePath,
    });

    toast.loading(`Downloading ${fileName}... 0%`, { id: toastId });

    const downloadResumable = FileSystem.createDownloadResumable(
      streamUrl,
      destFilePath,
      {},
      (progressData) => {
        const totalWritten = progressData.totalBytesWritten;
        const totalExpected =
          progressData.totalBytesExpectedToWrite || item.file_size || 1;
        const pct = Math.min(
          100,
          Math.round((totalWritten / totalExpected) * 100),
        );

        console.log("[Downloader] progress:", {
          itemId: item.id,
          totalWritten,
          expectedFromServer: progressData.totalBytesExpectedToWrite,
          expectedUsed: totalExpected,
          pct,
        });

        toast.loading(`Downloading ${fileName}... ${pct}%`, { id: toastId });

        onProgress?.({
          mediaId: item.id,
          totalBytesWritten: totalWritten,
          totalBytesExpectedToWrite: totalExpected,
          percentage: pct,
        });
      },
    );

    const result = await downloadResumable.downloadAsync();
    console.log("[Downloader] downloadAsync result:", {
      uri: result?.uri,
      status: result?.status,
      headers: result?.headers,
    });
    if (!result || !result.uri) {
      console.log("[Downloader] ABORT: no result uri");
      toast.error("Download failed to complete.", { id: toastId });
      return { success: false, error: "Download failed" };
    }

    if (result.status !== 200) {
      console.log("[Downloader] ABORT: non-200 status", result.status);
      toast.error(`Server returned HTTP ${result.status}`, { id: toastId });
      return { success: false, error: `HTTP ${result.status}` };
    }

    const fileCheck = await FileSystem.getInfoAsync(result.uri);
    console.log("[Downloader] downloaded file check:", {
      exists: fileCheck.exists,
      size: fileCheck.exists ? (fileCheck as any).size : 0,
    });
    if (!fileCheck.exists) {
      console.log("[Downloader] ABORT: file missing on disk");
      toast.error("Downloaded file missing on disk.", { id: toastId });
      return { success: false, error: "File missing" };
    }

    // Also download thumbnail into .thumbs/ subfolder for offline mediaCard display
    let thumbnailLocalUri: string | undefined = undefined;
    try {
      const thumbsDir = `${destDir}.thumbs/`;
      const thumbsDirInfo = await FileSystem.getInfoAsync(thumbsDir);
      if (!thumbsDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(thumbsDir, { intermediates: true });
      }

      const thumbUrl = getThumbnailUrl(ip, port, item.id);
      const thumbDestPath = `${thumbsDir}${item.id}.jpg`;
      const thumbResult = await FileSystem.downloadAsync(
        thumbUrl,
        thumbDestPath,
      );
      if (thumbResult && thumbResult.uri) {
        thumbnailLocalUri = thumbResult.uri;
        console.log(
          "[Downloader] Saved thumbnail to .thumbs:",
          thumbnailLocalUri,
        );
      }
    } catch (thumbErr) {
      console.warn(
        "[Downloader] Could not download thumbnail to .thumbs:",
        thumbErr,
      );
    }

    const record: DownloadedItemRecord = {
      mediaId: item.id,
      localUri: result.uri,
      thumbnailLocalUri,
      albumName: item.album_name || "Uncategorized",
      fileName,
      fileSize: fileCheck.size ?? item.file_size,
      mimeType: item.mime_type,
      downloadedAt: new Date().toISOString(),
    };

    await saveDownloadedItemRecord(record);
    console.log("[Downloader] ===== SUCCESS =====", {
      localUri: result.uri,
      savedSize: fileCheck.size,
    });

    toast.success(
      `Download complete! Saved to ${record.albumName}/${fileName}`,
      {
        id: toastId,
        duration: 4000,
      },
    );

    return { success: true, localUri: result.uri, record };
  } catch (err: any) {
    console.log("[Downloader] downloadMediaItem failed:", {
      code: err?.code,
      message: err?.message,
      status: err?.response?.status,
      url: getMediaStreamUrl(ip, port, item.id),
      itemId: item.id,
      fileName: item.current_relative_path?.split("/").pop(),
    });
    console.error("[Downloader] Error:", err);
    toast.error(`Download failed: ${err?.message || "Network error"}`, {
      id: toastId,
    });
    return { success: false, error: err?.message || "Download error" };
  }
}
