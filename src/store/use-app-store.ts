import { create } from 'zustand';
import {
  Album,
  LibraryStats,
  MediaItem,
  SavedServer,
  ServerInfo,
  SyncProgress,
  SyncStatus,
  Tag,
} from '@/types/models';
import {
  DEFAULT_SERVER_IP,
  DEFAULT_SERVER_PORT,
  getSavedServerConfig,
  getServerHistory,
  getLastSyncTime,
  setLastSyncTime,
  saveServerConfig,
  removeServerFromHistory,
} from '@/services/storage';
import {
  testServerConnection,
  fetchServerInfo,
  downloadDatabaseSnapshot,
} from '@/services/sync-api';
import {
  getNewSnapshotDownloadPath,
  importDownloadedSnapshot,
  getLibraryStats,
  getAlbums,
  getTags,
  getRecentMedia,
  getMediaItems,
  isDatabaseAvailable,
  GetMediaOptions,
} from '@/services/local-db';

interface FetchPageOptions {
  query?: string;
  type?: 'all' | 'image' | 'video';
  albumId?: number;
  tagId?: number;
  sortBy?: 'created_at' | 'file_size' | 'current_relative_path';
  sortOrder?: 'ASC' | 'DESC';
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

  // Actions
  init: () => Promise<void>;
  setIp: (ip: string) => void;
  setPort: (port: number) => void;
  checkConnection: (targetIp?: string, targetPort?: number) => Promise<void>;
  syncDatabase: (targetIp?: string, targetPort?: number) => Promise<{ success: boolean; error?: string }>;
  refreshLibrary: () => Promise<void>;
  fetchMediaPage: (options?: FetchPageOptions) => Promise<void>;
  removeHistoryServer: (delIp: string, delPort: number) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  ip: DEFAULT_SERVER_IP,
  port: DEFAULT_SERVER_PORT,
  serverHistory: [],
  serverInfo: null,
  status: 'idle',
  errorMessage: null,
  syncProgress: null,
  lastSyncTime: null,
  latencyMs: null,

  stats: {
    total_items: 0,
    images: 0,
    videos: 0,
    albums: 0,
    tags: 0,
    db_size_bytes: 0,
    db_size_formatted: '0 B',
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
  pageSize: 24,

  init: async () => {
    try {
      const config = await getSavedServerConfig();
      const history = await getServerHistory();
      const lastSync = await getLastSyncTime();

      set({
        ip: config.ip,
        port: config.port,
        serverHistory: history,
        lastSyncTime: lastSync,
      });

      await Promise.all([
        get().refreshLibrary(),
        get().checkConnection(config.ip, config.port),
      ]);
    } catch (e) {
      console.warn('[AppStore] Init error:', e);
    }
  },

  setIp: (ip: string) => set({ ip }),
  setPort: (port: number) => set({ port }),

  checkConnection: async (targetIp?: string, targetPort?: number) => {
    const currentIp = targetIp ?? get().ip;
    const currentPort = targetPort ?? get().port;

    set({ status: 'testing', errorMessage: null });

    const test = await testServerConnection(currentIp, currentPort);
    set({ latencyMs: test.latencyMs });

    if (test.reachable && test.serverInfo) {
      set({
        serverInfo: test.serverInfo,
        status: 'connected',
      });
      await saveServerConfig(currentIp, currentPort, test.serverInfo.drive_name);
      const updatedHistory = await getServerHistory();
      set({ serverHistory: updatedHistory });
    } else {
      set({
        serverInfo: test.serverInfo ?? {
          status: 'offline',
          server: 'Unreachable',
          error: test.error,
        },
        status: 'error',
        errorMessage: test.error ?? 'Server is not reachable',
      });
    }
  },

  syncDatabase: async (targetIp?: string, targetPort?: number) => {
    const currentIp = targetIp ?? get().ip;
    const currentPort = targetPort ?? get().port;

    set({
      status: 'downloading',
      errorMessage: null,
      syncProgress: { bytesWritten: 0, contentLength: 0, percentage: 0 },
    });

    const { path: downloadPath, dbName } = getNewSnapshotDownloadPath();

    const downloadRes = await downloadDatabaseSnapshot(
      currentIp,
      currentPort,
      downloadPath,
      (progress) => {
        set({ syncProgress: progress });
      }
    );

    if (!downloadRes.success || !downloadRes.uri) {
      set({
        status: 'error',
        errorMessage: downloadRes.error ?? 'Database download failed',
        syncProgress: null,
      });
      return { success: false, error: downloadRes.error };
    }

    set({ status: 'migrating' });
    const importSuccess = await importDownloadedSnapshot(dbName);

    if (!importSuccess) {
      set({
        status: 'error',
        errorMessage: 'Failed to verify the downloaded SQLite database snapshot.',
        syncProgress: null,
      });
      return { success: false, error: 'Database import failed' };
    }

    const nowIso = new Date().toISOString();
    await setLastSyncTime(nowIso);

    // Refresh local library data across all screens
    await get().refreshLibrary();

    const info = await fetchServerInfo(currentIp, currentPort);
    if (info.drive_name) {
      await saveServerConfig(currentIp, currentPort, info.drive_name);
    }
    const updatedHistory = await getServerHistory();

    set({
      status: 'success',
      syncProgress: null,
      lastSyncTime: nowIso,
      serverInfo: info,
      serverHistory: updatedHistory,
    });

    return { success: true };
  },

  refreshLibrary: async () => {
    set({ isRefreshing: true });
    try {
      const [libStats, albList, tagList, recentList] = await Promise.all([
        getLibraryStats(),
        getAlbums(),
        getTags(),
        getRecentMedia(12),
      ]);

      const dbAvail = libStats.total_items > 0 || (await isDatabaseAvailable());

      set({
        stats: libStats,
        hasDatabase: dbAvail,
        albums: albList,
        tags: tagList,
        recentMedia: recentList,
      });
    } catch (e) {
      console.warn('[AppStore] Error refreshing library:', e);
    } finally {
      set({ isRefreshing: false, isLoading: false });
    }
  },

  fetchMediaPage: async (options: FetchPageOptions = {}) => {
    const {
      query = '',
      type = 'all',
      albumId,
      tagId,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      page = 1,
      pageSize = 24,
    } = options;

    set({ isLoading: true });
    try {
      const offset = Math.max(0, (page - 1) * pageSize);
      const result = await getMediaItems({
        query,
        type,
        albumId,
        tagId,
        sortBy,
        sortOrder,
        limit: pageSize,
        offset,
      });

      set({
        mediaItems: result.items,
        totalMediaCount: result.totalCount,
        currentPage: page,
        pageSize,
        isLoading: false,
      });
    } catch (e) {
      console.warn('[AppStore] fetchMediaPage error:', e);
      set({ isLoading: false });
    }
  },

  removeHistoryServer: async (delIp: string, delPort: number) => {
    const updated = await removeServerFromHistory(delIp, delPort);
    set({ serverHistory: updated });
  },
}));
