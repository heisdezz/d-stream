import { create } from "zustand";
import { observeBackgroundDownloads } from "@/services/background-downloader";
import {
  Album,
  LibraryStats,
  MediaItem,
  SavedServer,
  ServerInfo,
  SyncProgress,
  SyncStatus,
  Tag,
} from "@/types/models";
import {
  DEFAULT_SERVER_IP,
  DEFAULT_SERVER_PORT,
  DEFAULT_PAGE_SIZE,
  DEFAULT_DOWNLOAD_LOCATION,
  getSavedServerConfig,
  getServerHistory,
  getLastSyncTime,
  setLastSyncTime,
  saveServerConfig,
  removeServerFromHistory,
  getSavedPageSize,
  savePageSize,
  getSavedDownloadLocation,
  saveDownloadLocation,
  getDownloadedItemsMap,
  saveDownloadedItemRecord,
  removeDownloadedItemRecord,
  DownloadedItemRecord,
  ThemeMode,
  getSavedThemeConfig,
  saveThemeConfig,
  getPlayAsShorts,
  savePlayAsShorts,
} from "@/services/storage";
import {
  testServerConnection,
  fetchServerInfo,
  downloadDatabaseSnapshot,
} from "@/services/sync-api";
import {
  getNewSnapshotDownloadPath,
  importDownloadedSnapshot,
  getLibraryStats,
  getAlbums,
  getTags,
  getRecentMedia,
  getMediaItems,
  isDatabaseAvailable,
} from "@/services/local-db";
import {
  downloadMediaItem,
  deleteDownloadedFile,
  DownloadProgress,
} from "@/services/downloader";

interface FetchPageOptions {
  query?: string;
  type?: "all" | "image" | "video";
  albumId?: number;
  tagId?: number;
  sortBy?: "created_at" | "file_size" | "current_relative_path";
  sortOrder?: "ASC" | "DESC";
  page?: number;
  pageSize?: number;
}

interface AppState {
  // Connection State
  ip: string;
  port: number;
  serverHistory: SavedServer[];
  serverInfo: ServerInfo | null;
  status: SyncStatus;
  errorMessage: string | null;
  syncProgress: SyncProgress | null;
  lastSyncTime: string | null;
  latencyMs: number | null;

  // Downloads & Offline Store State
  downloadLocation: string;
  downloadedItems: Record<number, DownloadedItemRecord>;
  activeDownloads: Record<number, DownloadProgress>;

  // Library State
  stats: LibraryStats;
  hasDatabase: boolean;
  mediaItems: MediaItem[];
  totalMediaCount: number;
  albums: Album[];
  tags: Tag[];
  recentMedia: MediaItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  currentPage: number;
  pageSize: number;

  // Theme & Playback State
  themeAccent: string;
  themeMode: ThemeMode;
  playAsShorts: boolean;

  // Actions
  init: () => Promise<void>;
  setIp: (ip: string) => void;
  setPort: (port: number) => void;
  checkConnection: (targetIp?: string, targetPort?: number) => Promise<void>;
  syncDatabase: (
    targetIp?: string,
    targetPort?: number,
  ) => Promise<{ success: boolean; error?: string }>;
  refreshLibrary: () => Promise<void>;
  fetchMediaPage: (options?: FetchPageOptions) => Promise<void>;
  updatePageSize: (size: number) => Promise<void>;
  updateDownloadLocation: (location: string) => Promise<void>;
  refreshDownloadedItems: () => Promise<void>;
  startDownloadMediaItem: (
    item: MediaItem,
  ) => Promise<{ success: boolean; error?: string }>;
  removeDownloadedMediaItem: (mediaId: number) => Promise<void>;
  removeHistoryServer: (delIp: string, delPort: number) => Promise<void>;
  setThemeAccent: (accent: string) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setPlayAsShorts: (enabled: boolean) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  ip: DEFAULT_SERVER_IP,
  port: DEFAULT_SERVER_PORT,
  serverHistory: [],
  serverInfo: null,
  status: "idle",
  errorMessage: null,
  syncProgress: null,
  lastSyncTime: null,
  latencyMs: null,

  downloadLocation: DEFAULT_DOWNLOAD_LOCATION,
  downloadedItems: {},
  activeDownloads: {},

  stats: {
    total_items: 0,
    images: 0,
    videos: 0,
    albums: 0,
    tags: 0,
    db_size_bytes: 0,
    db_size_formatted: "0 B",
    db_exists: false,
  },
  hasDatabase: false,
  mediaItems: [],
  totalMediaCount: 0,
  albums: [],
  tags: [],
  recentMedia: [],
  isLoading: false,
  isRefreshing: false,
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE,

  themeAccent: "system",
  themeMode: "system",
  playAsShorts: false,

  init: async () => {
    try {
      const config = await getSavedServerConfig();
      const history = await getServerHistory();
      const lastSync = await getLastSyncTime();
      const savedPageSize = await getSavedPageSize();
      const savedDlLocation = await getSavedDownloadLocation();
      const savedDlMap = await getDownloadedItemsMap();
      const themeConfig = await getSavedThemeConfig();
      const playAsShorts = await getPlayAsShorts();

      set({
        ip: config.ip,
        port: config.port,
        serverHistory: history,
        lastSyncTime: lastSync,
        pageSize: savedPageSize,
        downloadLocation: savedDlLocation,
        downloadedItems: { ...savedDlMap },
        themeAccent: themeConfig.accent,
        themeMode: themeConfig.mode,
        playAsShorts,
      });

      observeBackgroundDownloads(
        (progress) => {
          const previous = get().activeDownloads[progress.mediaId];
          if (previous?.totalBytesWritten === progress.totalBytesWritten &&
              previous?.totalBytesExpectedToWrite === progress.totalBytesExpectedToWrite) return;
          set((state) => ({ activeDownloads: {
            ...state.activeDownloads, [progress.mediaId]: progress,
          } }));
        },
        (mediaId, result) => set((state) => {
          const activeDownloads = { ...state.activeDownloads };
          delete activeDownloads[mediaId];
          return {
            activeDownloads,
            ...(result.record ? { downloadedItems: {
              ...state.downloadedItems, [mediaId]: result.record,
            } } : {}),
          };
        }),
      );

      await Promise.all([
        get().refreshLibrary(),
        get().checkConnection(config.ip, config.port),
      ]);
    } catch (e) {
      console.warn("[AppStore] Init error:", e);
    }
  },

  setIp: (ip: string) => set({ ip }),
  setPort: (port: number) => set({ port }),

  checkConnection: async (targetIp?: string, targetPort?: number) => {
    const currentIp = targetIp ?? get().ip;
    const currentPort = targetPort ?? get().port;

    set({ status: "testing", errorMessage: null });

    const test = await testServerConnection(currentIp, currentPort);
    set({ latencyMs: test.latencyMs });

    if (test.reachable && test.serverInfo) {
      set({
        serverInfo: test.serverInfo,
        status: "connected",
      });
      await saveServerConfig(
        currentIp,
        currentPort,
        test.serverInfo.drive_name,
      );
      const updatedHistory = await getServerHistory();
      set({ serverHistory: updatedHistory });
    } else {
      set({
        serverInfo: test.serverInfo ?? {
          status: "offline",
          server: "Unreachable",
          error: test.error,
        },
        status: "error",
        errorMessage: test.error || "Server is offline or unreachable.",
      });
    }
  },

  syncDatabase: async (targetIp?: string, targetPort?: number) => {
    const currentIp = targetIp ?? get().ip;
    const currentPort = targetPort ?? get().port;
    const startedAt = Date.now();

    set({
      status: "downloading",
      errorMessage: null,
      syncProgress: { bytesWritten: 0, contentLength: 0, percentage: 0 },
    });

    const { path: targetUri, dbName } = getNewSnapshotDownloadPath();
    let lastProgressAt = 0;
    const downloadRes = await downloadDatabaseSnapshot(
      currentIp,
      currentPort,
      targetUri,
      (progress) => {
        const now = Date.now();
        if (progress.percentage === 100 || now - lastProgressAt >= 200) {
          lastProgressAt = now;
          set({ syncProgress: progress });
        }
      },
    );

    if (!downloadRes.success || !downloadRes.uri) {
      set({
        status: "error",
        errorMessage:
          downloadRes.error || "Failed to download database snapshot.",
        syncProgress: null,
      });
      return {
        success: false,
        error: downloadRes.error || "Failed to download database snapshot.",
      };
    }

    const downloadMs = Date.now() - startedAt;
    set({ status: "migrating" });
    const importStartedAt = Date.now();
    const importSuccess = await importDownloadedSnapshot(dbName);
    const importMs = Date.now() - importStartedAt;

    if (!importSuccess) {
      set({
        status: "error",
        errorMessage: "Failed to apply database snapshot.",
        syncProgress: null,
      });
      return {
        success: false,
        error: "Failed to apply database snapshot.",
      };
    }

    const now = new Date().toISOString();
    await setLastSyncTime(now);

    // Refresh store library data
    const refreshStartedAt = Date.now();
    await get().refreshLibrary();
    console.log(
      `[AppStore] Snapshot sync timings: download=${downloadMs} ms, import=${importMs} ms, refresh=${Date.now() - refreshStartedAt} ms, total=${Date.now() - startedAt} ms`,
    );

    set({
      status: "connected",
      lastSyncTime: now,
      syncProgress: null,
      hasDatabase: true,
    });

    return { success: true };
  },

  refreshLibrary: async () => {
    set({ isRefreshing: true });
    try {
      const dbAvailable = await isDatabaseAvailable();
      if (!dbAvailable) {
        set({ hasDatabase: false, isRefreshing: false });
        return;
      }

      const [stats, albums, tags, recentMedia] = await Promise.all([
        getLibraryStats(),
        getAlbums(),
        getTags(),
        getRecentMedia(12),
      ]);

      set({
        hasDatabase: stats.db_exists,
        stats,
        albums,
        tags,
        recentMedia,
        isRefreshing: false,
      });

      // Also refresh initial media page if none loaded
      if (get().mediaItems.length === 0) {
        await get().fetchMediaPage({ page: 1 });
      }
    } catch (e) {
      console.warn("[AppStore] refreshLibrary failed:", e);
      set({ isRefreshing: false });
    }
  },

  fetchMediaPage: async (options = {}) => {
    set({ isLoading: true });
    try {
      const pageSize = options.pageSize ?? get().pageSize ?? DEFAULT_PAGE_SIZE;
      const page = options.page ?? 1;
      const offset = (page - 1) * pageSize;

      const { items, totalCount } = await getMediaItems({
        query: options.query,
        type: options.type,
        albumId: options.albumId,
        tagId: options.tagId,
        sortBy: options.sortBy ?? "created_at",
        sortOrder: options.sortOrder ?? "DESC",
        limit: pageSize,
        offset,
      });

      set({
        mediaItems: items,
        totalMediaCount: totalCount,
        currentPage: page,
        isLoading: false,
      });
    } catch (e) {
      console.warn("[AppStore] fetchMediaPage failed:", e);
      set({ isLoading: false });
    }
  },

  updatePageSize: async (size: number) => {
    await savePageSize(size);
    set({ pageSize: size, currentPage: 1 });
  },

  updateDownloadLocation: async (location: string) => {
    await saveDownloadLocation(location);
    set({ downloadLocation: location });
  },

  refreshDownloadedItems: async () => {
    const updatedMap = await getDownloadedItemsMap();
    set({ downloadedItems: { ...updatedMap } });
  },

  startDownloadMediaItem: async (item: MediaItem) => {
    if (get().downloadedItems[item.id]) return { success: true };
    if (get().activeDownloads[item.id]) {
      return { success: false, error: "This file is already downloading" };
    }
    const { ip, port } = get();

    set((state) => ({
      activeDownloads: {
        ...state.activeDownloads,
        [item.id]: {
          mediaId: item.id,
          totalBytesWritten: 0,
          totalBytesExpectedToWrite: item.file_size || 1,
          percentage: 0,
        },
      },
    }));

    const result = await downloadMediaItem(item, ip, port, (progress) => {
      set((state) => ({
        activeDownloads: {
          ...state.activeDownloads,
          [item.id]: progress,
        },
      }));
    });

    set((state) => {
      const nextActive = { ...state.activeDownloads };
      delete nextActive[item.id];
      return { activeDownloads: nextActive };
    });

    if (result.success) {
      const updatedMap = await getDownloadedItemsMap();
      set((state) => ({
        downloadedItems: {
          ...state.downloadedItems,
          ...updatedMap,
          ...(result.record ? { [item.id]: result.record } : {}),
        },
      }));
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  },

  removeDownloadedMediaItem: async (mediaId: number) => {
    const currentRecord = get().downloadedItems[mediaId];
    if (currentRecord?.localUri) {
      deleteDownloadedFile(
        currentRecord.localUri,
        currentRecord.thumbnailLocalUri,
      ).catch(() => {});
    }
    const updatedMap = await removeDownloadedItemRecord(mediaId);
    set({ downloadedItems: { ...updatedMap } });
  },

  removeHistoryServer: async (delIp: string, delPort: number) => {
    const updated = await removeServerFromHistory(delIp, delPort);
    set({ serverHistory: updated });
  },

  setThemeAccent: async (accent: string) => {
    const mode = get().themeMode;
    await saveThemeConfig(accent, mode);
    set({ themeAccent: accent });
  },

  setThemeMode: async (mode: ThemeMode) => {
    const accent = get().themeAccent;
    await saveThemeConfig(accent, mode);
    set({ themeMode: mode });
  },

  setPlayAsShorts: async (enabled: boolean) => {
    await savePlayAsShorts(enabled);
    set({ playAsShorts: enabled });
  },
}));
