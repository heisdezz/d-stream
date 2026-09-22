import * as FileSystem from "expo-file-system/legacy";
import { SavedServer } from "@/types/models";

export const DEFAULT_SERVER_IP = "192.168.1.100";
export const DEFAULT_SERVER_PORT = 8080;
export const MAX_SAVED_SERVERS = 5;
export const DEFAULT_PAGE_SIZE = 96;
export const MIN_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 180;
export const PAGE_SIZE_OPTIONS = [24, 48, 72, 96, 120, 144, 168, 180];
export const DEFAULT_DOWNLOAD_LOCATION = "Movies/d-stream";

export type ThemeMode = "system" | "light" | "dark";

export interface DownloadedItemRecord {
  mediaId: number;
  localUri: string;
  thumbnailLocalUri?: string;
  albumName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadedAt: string;
}

interface AppStorageData {
  serverIp: string;
  serverPort: number;
  serverHistory: SavedServer[];
  lastSyncTime: string | null;
  viewMode: "grid" | "list";
  pageSize: number;
  downloadLocation: string;
  downloadedItems: Record<number, DownloadedItemRecord>;
  themeAccent: string;
  themeMode: ThemeMode;
}

const defaultData: AppStorageData = {
  serverIp: DEFAULT_SERVER_IP,
  serverPort: DEFAULT_SERVER_PORT,
  serverHistory: [],
  lastSyncTime: null,
  viewMode: "grid",
  pageSize: DEFAULT_PAGE_SIZE,
  downloadLocation: DEFAULT_DOWNLOAD_LOCATION,
  downloadedItems: {},
  themeAccent: "system",
  themeMode: "system",
};

let memoryCache: AppStorageData = { ...defaultData };
let isLoaded = false;

function getStorageFilePath(): string {
  const baseDir =
    FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
  return `${baseDir}dstream_settings.json`;
}

async function loadDataFromDisk(): Promise<AppStorageData> {
  if (isLoaded) return memoryCache;
  try {
    const filePath = getStorageFilePath();
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      const content = await FileSystem.readAsStringAsync(filePath);
      const parsed = JSON.parse(content);
      memoryCache = { ...defaultData, ...parsed };
    }
  } catch {
    // Fallback to memoryCache
  }
  isLoaded = true;
  return memoryCache;
}

async function saveDataToDisk(): Promise<void> {
  try {
    const filePath = getStorageFilePath();
    const content = JSON.stringify(memoryCache, null, 2);
    await FileSystem.writeAsStringAsync(filePath, content);
  } catch (err) {
    console.warn("[Storage] Failed to save settings to disk:", err);
  }
}

export async function getSavedServerConfig(): Promise<{
  ip: string;
  port: number;
}> {
  const data = await loadDataFromDisk();
  return { ip: data.serverIp, port: data.serverPort };
}

export async function saveServerConfig(
  ip: string,
  port: number,
  driveName?: string,
): Promise<void> {
  const data = await loadDataFromDisk();
  data.serverIp = ip.trim();
  data.serverPort = port;
  await addServerToHistory({
    ip: ip.trim(),
    port,
    driveName,
    lastConnectedAt: new Date().toISOString(),
  });
  await saveDataToDisk();
}

export async function getServerHistory(): Promise<SavedServer[]> {
  const data = await loadDataFromDisk();
  return (data.serverHistory || []).slice(0, MAX_SAVED_SERVERS);
}

export async function addServerToHistory(server: SavedServer): Promise<void> {
  const data = await loadDataFromDisk();
  const current = data.serverHistory || [];
  const filtered = current.filter(
    (s) => !(s.ip === server.ip && s.port === server.port),
  );
  // Keep strictly the 5 last connected servers
  data.serverHistory = [server, ...filtered].slice(0, MAX_SAVED_SERVERS);
  await saveDataToDisk();
}

export async function removeServerFromHistory(
  ip: string,
  port: number,
): Promise<SavedServer[]> {
  const data = await loadDataFromDisk();
  data.serverHistory = (data.serverHistory || []).filter(
    (s) => !(s.ip === ip && s.port === port),
  );
  await saveDataToDisk();
  return data.serverHistory;
}

export async function getLastSyncTime(): Promise<string | null> {
  const data = await loadDataFromDisk();
  return data.lastSyncTime;
}

export async function setLastSyncTime(timestamp: string): Promise<void> {
  const data = await loadDataFromDisk();
  data.lastSyncTime = timestamp;
  await saveDataToDisk();
}

export async function getViewMode(): Promise<"grid" | "list"> {
  const data = await loadDataFromDisk();
  return data.viewMode;
}

export async function saveViewMode(mode: "grid" | "list"): Promise<void> {
  const data = await loadDataFromDisk();
  data.viewMode = mode;
  await saveDataToDisk();
}

export async function getSavedPageSize(): Promise<number> {
  const data = await loadDataFromDisk();
  return data.pageSize || DEFAULT_PAGE_SIZE;
}

export async function savePageSize(size: number): Promise<void> {
  const clamped = Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, size));
  const data = await loadDataFromDisk();
  data.pageSize = clamped;
  await saveDataToDisk();
}

export async function getSavedDownloadLocation(): Promise<string> {
  const data = await loadDataFromDisk();
  return data.downloadLocation || DEFAULT_DOWNLOAD_LOCATION;
}

export async function saveDownloadLocation(location: string): Promise<void> {
  const data = await loadDataFromDisk();
  data.downloadLocation = location.trim() || DEFAULT_DOWNLOAD_LOCATION;
  await saveDataToDisk();
}

export async function getDownloadedItemsMap(): Promise<
  Record<number, DownloadedItemRecord>
> {
  const data = await loadDataFromDisk();
  return { ...(data.downloadedItems || {}) };
}

export async function saveDownloadedItemRecord(
  record: DownloadedItemRecord,
): Promise<Record<number, DownloadedItemRecord>> {
  const data = await loadDataFromDisk();
  const currentMap = data.downloadedItems ? { ...data.downloadedItems } : {};
  currentMap[record.mediaId] = record;
  data.downloadedItems = currentMap;
  memoryCache.downloadedItems = currentMap;
  await saveDataToDisk();
  return { ...currentMap };
}

export async function removeDownloadedItemRecord(
  mediaId: number,
): Promise<Record<number, DownloadedItemRecord>> {
  const data = await loadDataFromDisk();
  if (data.downloadedItems && data.downloadedItems[mediaId]) {
    const nextMap = { ...data.downloadedItems };
    delete nextMap[mediaId];
    data.downloadedItems = nextMap;
    memoryCache.downloadedItems = nextMap;
    await saveDataToDisk();
    return { ...nextMap };
  }
  return { ...(data.downloadedItems || {}) };
}

export async function getSavedThemeConfig(): Promise<{
  accent: string;
  mode: ThemeMode;
}> {
  const data = await loadDataFromDisk();
  return {
    accent: data.themeAccent || "system",
    mode: data.themeMode || "system",
  };
}

export async function saveThemeConfig(
  accent: string,
  mode: ThemeMode,
): Promise<void> {
  const data = await loadDataFromDisk();
  data.themeAccent = accent;
  data.themeMode = mode;
  memoryCache.themeAccent = accent;
  memoryCache.themeMode = mode;
  await saveDataToDisk();
}
