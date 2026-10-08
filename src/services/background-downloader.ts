import { requireOptionalNativeModule } from "expo";
import { AppState, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { toast } from "sonner-native";
import { DownloadedItemRecord, saveDownloadedItemRecord } from "./storage";
import type { DownloadProgress } from "./downloader";

interface Job {
  id: string;
  recordJson: string;
  status: number;
  reason: number;
  written: number;
  total: number;
  error?: string;
}

type JobRecord = DownloadedItemRecord & { thumbnailUrl?: string };

interface DownloadModule {
  enqueue(url: string, path: string, recordJson: string): Promise<string>;
  getJobs(): Promise<Job[]>;
  forget(id: string, failed: boolean): Promise<void>;
}

const native = Platform.OS === "android"
  ? requireOptionalNativeModule<DownloadModule>("DStreamDownloads")
  : null;
export const hasBackgroundDownloader = !!native;

type Result = { success: boolean; record?: DownloadedItemRecord; localUri?: string; error?: string };
const waiters = new Map<string, (result: Result) => void>();
const earlyResults = new Map<string, Result>();
let pendingEnqueues = 0;
let onProgress: ((progress: DownloadProgress) => void) | undefined;
let onFinished: ((mediaId: number, result: Result) => void) | undefined;
let started = false;
let polling = false;
let pollRequested = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export function observeBackgroundDownloads(
  progress: NonNullable<typeof onProgress>,
  finished: NonNullable<typeof onFinished>,
) {
  onProgress = progress;
  onFinished = finished;
  if (!native || started) return;
  started = true;
  AppState.addEventListener("change", (state) => {
    if (state === "active") void poll();
    else if (timer) clearTimeout(timer);
  });
  void poll();
}

async function poll() {
  if (!native || AppState.currentState === "background") return;
  if (polling) {
    pollRequested = true;
    return;
  }
  if (timer) clearTimeout(timer);
  polling = true;
  let needsPolling = false;
  try {
    const jobs = await native.getJobs();
    needsPolling = jobs.length > 0;
    for (const job of jobs) {
      const { thumbnailUrl, ...record }: JobRecord = JSON.parse(job.recordJson);
      const total = job.total > 0 ? job.total : record.fileSize;
      if (job.status !== 8 && job.status !== 16) {
        onProgress?.({
          mediaId: record.mediaId,
          totalBytesWritten: job.written,
          totalBytesExpectedToWrite: total,
          percentage: total > 0 ? Math.min(99, Math.round(job.written / total * 100)) : 0,
        });
        continue;
      }

      let result: Result;
      if (job.status === 8) {
        const info = await FileSystem.getInfoAsync(record.localUri);
        if (!info.exists || info.isDirectory || info.size === 0 ||
            (job.total > 0 && info.size !== job.total)) {
          result = { success: false, error: "Downloaded file is missing or incomplete" };
        } else {
          record.fileSize = info.size;
          record.downloadedAt = new Date().toISOString();
          record.thumbnailLocalUri = await cacheThumbnail(record.mediaId, thumbnailUrl);
          // Persist before acknowledging the native job; relaunch can retry safely.
          await saveDownloadedItemRecord(record);
          result = { success: true, record, localUri: record.localUri };
        }
      } else {
        result = { success: false, error: job.error || `Background download failed (${job.reason})` };
      }
      await native.forget(job.id, !result.success);
      onFinished?.(record.mediaId, result);
      const waiter = waiters.get(job.id);
      if (waiter) waiter(result);
      else if (pendingEnqueues > 0) earlyResults.set(job.id, result);
      waiters.delete(job.id);
      if (result.success) toast.success(`Downloaded ${record.fileName}`);
      else toast.error(result.error || "Download failed");
    }
  } catch (error) {
    // Keep durable native jobs intact if storage/query fails, and retry later.
    console.warn("[Downloader] Could not reconcile background downloads:", error);
    needsPolling = true;
  } finally {
    polling = false;
    if ((needsPolling || pollRequested) && isForeground()) {
      timer = setTimeout(() => void poll(), 1000);
    }
    pollRequested = false;
  }
}

function isForeground() {
  return AppState.currentState !== "background";
}

export async function downloadInBackground(
  url: string,
  path: string,
  record: JobRecord,
): Promise<Result> {
  if (!native) throw new Error("Background download module is unavailable");
  pendingEnqueues++;
  try {
    const id = await native.enqueue(url, path, JSON.stringify(record));
    const completed = earlyResults.get(id);
    if (completed) return completed;
    console.log("[Downloader] Background job queued:", { id, mediaId: record.mediaId });
    toast.info(`Downloading ${record.fileName} in the background`);
    return new Promise((resolve) => {
      waiters.set(id, resolve);
      void poll();
    });
  } finally {
    pendingEnqueues--;
    if (pendingEnqueues === 0) earlyResults.clear();
  }
}

async function cacheThumbnail(mediaId: number, url?: string): Promise<string | undefined> {
  if (!url || !FileSystem.documentDirectory) return;
  const directory = `${FileSystem.documentDirectory}offline-thumbnails/`;
  const uri = `${directory}${mediaId}.jpg`;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let download: ReturnType<typeof FileSystem.createDownloadResumable> | undefined;
  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    download = FileSystem.createDownloadResumable(url, uri);
    const result = await Promise.race([
      download.downloadAsync(),
      new Promise<undefined>((resolve) => {
        timeout = setTimeout(() => resolve(undefined), 5000);
      }),
    ]);
    if (result?.status === 200) return result.uri;
  } catch {
    // A missing thumbnail must not invalidate a successfully downloaded video.
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  await download?.cancelAsync().catch(() => {});
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  return undefined;
}
