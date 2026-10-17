import type { DeviceMedia } from './device-media';
import { deleteDeviceMedia } from './device-media';
import { uploadDeviceMedia } from './catalog-api';

export interface DeviceUploadResult {
  uploaded: number;
  deleted: number;
  deletionFailures: number;
  error?: unknown;
}

export async function uploadDeviceSelection(
  assets: DeviceMedia[],
  server: { ip: string; port: number; albumId: number },
  deleteAfterUpload: boolean,
  onProgress: (item: number, total: number, percent: number) => void,
  onUploaded: (asset: DeviceMedia, deleted: boolean) => void,
): Promise<DeviceUploadResult> {
  const result: DeviceUploadResult = { uploaded: 0, deleted: 0, deletionFailures: 0 };
  for (const asset of assets) {
    onProgress(result.uploaded + 1, assets.length, 0);
    try {
      await uploadDeviceMedia(server.ip, server.port, server.albumId, asset, (fraction) => {
        onProgress(result.uploaded + 1, assets.length, Math.round(fraction * 100));
      });
    } catch (error) {
      result.error = error;
      break;
    }
    result.uploaded += 1;
    let deleted = false;
    if (deleteAfterUpload) {
      try {
        deleted = await deleteDeviceMedia(asset.id);
      } catch {
        // A denied OS deletion must not turn a successful upload into a failed upload.
      }
      if (deleted) result.deleted += 1;
      else result.deletionFailures += 1;
    }
    onUploaded(asset, deleted);
  }
  return result;
}
