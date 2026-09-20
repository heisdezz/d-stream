# D-Stream Architecture: Services & Store Layer Documentation

This document provides a comprehensive technical reference for the **Services** (`src/services/`) and **Store** (`src/store/`) layers of the D-Stream mobile application.

---

## 1. System Architecture Overview

D-Stream is designed around an **offline-first, local-first synchronization model**. The client communicates over the local area network (LAN) with a D-Stream / Media Library Sync Server, synchronizes full SQLite database snapshots, streams or downloads media items on demand, and maintains local states using a hybrid **Zustand + Jotai** pattern.

```
┌────────────────────────────────────────────────────────┐
│                       UI Layer                         │
│  (Expo Router screens: index, media, albums, sync)    │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
       Jotai Atomic State         Zustand App Store
     (UI filters, page, sort)   (Sync, Library, Network)
                │                        │
                └───────────┬────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Services Layer                      │
├───────────────────┬───────────────────┬────────────────┤
│    storage.ts     │    sync-api.ts    │   local-db.ts  │
│  JSON persistence │  HTTP REST / Sync │ Expo SQLite V2 │
├───────────────────┴───────────────────┴────────────────┤
│                    downloader.ts                       │
│    Resumable Media Downloads & Thumbnail Caching       │
└────────────────────────────────────────────────────────┘
```

---

## 2. Services Layer (`src/services/`)

### 2.1 Storage Service (`storage.ts`)

[storage.ts](file:///home/destiny/Documents/projects/d-stream/src/services/storage.ts) acts as the persistence engine for app configuration, server connection history, user preferences, and downloaded media records. It uses a file-based JSON backing store stored in `expo-file-system` sandbox storage with an in-memory cache to guarantee synchronous read performance.

#### Key Responsibilities
- Preserving the active server IP, port, and history of up to 5 recently connected servers.
- Storing library pagination size (clamped between 24 and 180 items) and view modes (`grid` | `list`).
- Keeping an offline registry map of downloaded media items indexed by `mediaId`.
- Preserving custom download directory paths (default: `Movies/d-stream`).

#### Configuration Constants
| Constant | Default Value | Description |
| :--- | :--- | :--- |
| `DEFAULT_SERVER_IP` | `'192.168.1.100'` | Default fallback IP for local sync server |
| `DEFAULT_SERVER_PORT` | `8080` | Default HTTP port |
| `MAX_SAVED_SERVERS` | `5` | Maximum number of servers stored in connection history |
| `DEFAULT_PAGE_SIZE` | `96` | Initial pagination batch size |
| `MIN_PAGE_SIZE` / `MAX_PAGE_SIZE` | `24` / `180` | Minimum and maximum allowable pagination limits |
| `PAGE_SIZE_OPTIONS` | `[24, 48, 72, 96, 120, 144, 168, 180]` | Selectable grid pagination options |
| `DEFAULT_DOWNLOAD_LOCATION` | `'Movies/d-stream'` | Default base path relative to app document directory |

#### Data Interfaces
```typescript
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
```

#### API Methods
- `getSavedServerConfig(): Promise<{ ip: string; port: number }>`
- `saveServerConfig(ip: string, port: number, driveName?: string): Promise<void>`
- `getServerHistory(): Promise<SavedServer[]>`
- `addServerToHistory(server: SavedServer): Promise<void>`
- `removeServerFromHistory(ip: string, port: number): Promise<SavedServer[]>`
- `getLastSyncTime(): Promise<string | null>` / `setLastSyncTime(timestamp: string): Promise<void>`
- `getViewMode(): Promise<'grid' | 'list'>` / `setViewMode(mode: 'grid' | 'list'): Promise<void>`
- `getSavedPageSize(): Promise<number>` / `savePageSize(size: number): Promise<void>`
- `getSavedDownloadLocation(): Promise<string>` / `saveDownloadLocation(location: string): Promise<void>`
- `getDownloadedItemsMap(): Promise<Record<number, DownloadedItemRecord>>`
- `saveDownloadedItemRecord(record: DownloadedItemRecord): Promise<Record<number, DownloadedItemRecord>>`
- `removeDownloadedItemRecord(mediaId: number): Promise<Record<number, DownloadedItemRecord>>`

---

### 2.2 Sync API Service (`sync-api.ts`)

[sync-api.ts](file:///home/destiny/Documents/projects/d-stream/src/services/sync-api.ts) handles HTTP networking with the remote D-Stream Sync Server.

#### Key Responsibilities
- Normalizing target IP addresses and generating API, media streaming, and thumbnail URLs.
- Testing LAN server availability and measuring network ping/latency in milliseconds.
- Downloading database snapshots with resumable download streams and real-time percentage progress.

#### API Endpoints & Helpers
- **Base URL Resolution**:
  ```typescript
  getServerBaseUrl(ip: string, port: number): string
  // Strips http://, https://, and trailing slashes -> "http://${ip}:${port}"
  ```
- **Media Stream URL**:
  ```typescript
  getMediaStreamUrl(ip: string, port: number, itemId: number): string
  // Returns "${baseUrl}/media/${itemId}"
  ```
- **Thumbnail URL**:
  ```typescript
  getThumbnailUrl(ip: string, port: number, itemId: number): string
  // Returns "${baseUrl}/thumbnail/${itemId}"
  ```
- **Server Discovery & Ping**:
  ```typescript
  fetchServerInfo(ip: string, port: number, timeoutMs?: number): Promise<ServerInfo>
  // Performs GET /api/info with timeout handling (default 4000ms)
  
  testServerConnection(ip: string, port: number): Promise<{
    reachable: boolean;
    latencyMs: number;
    error?: string;
    serverInfo?: ServerInfo;
  }>
  ```
- **Database Snapshot Streaming**:
  ```typescript
  downloadDatabaseSnapshot(
    ip: string,
    port: number,
    targetUri: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{ success: boolean; uri?: string; error?: string }>
  ```
  Downloads binary SQLite file directly from `/download/db` to `targetUri` via `FileSystem.createDownloadResumable`. Cleans up invalid/partial files on failure.

---

### 2.3 Local Database Service (`local-db.ts`)

[local-db.ts](file:///home/destiny/Documents/projects/d-stream/src/services/local-db.ts) manages the local SQLite database using `expo-sqlite`. It executes queries for items, albums, tags, library statistics, and performs safe, zero-downtime database snapshot imports.

#### Key Architectural Features
1. **Single-Flight Open Lock (`openPromise`)**:
   Concurrent calls triggered on screen mount (e.g., `getLibraryStats()`, `getRecentMedia()`, `getAlbums()`) await the same active open promise. This avoids opening multiple native database handles to the same file, preventing Android `NullPointerException` crashes in native SQLite bridges.
2. **Explicit Directory Resolution**:
   Uses `getSqliteDirectory()` (resolving directly to `${documentDirectory}SQLite`) to ensure `expo-sqlite` and `expo-file-system` point to identical physical paths.
3. **Atomic Snapshot Swap & Old Database Purge**:
   When a new snapshot is synced, it is saved under a unique filename (`media_library_${timestamp}.db`). The service opens and validates the new database before safely closing the previous connection handle, followed by background deletion of older snapshot files.
4. **Automated Schema & Triggers**:
   Defines tables and triggers maintaining album count integrity:
   - `media_items` (files, hashes, paths, MIME types, duration, EXIF metadata, created date)
   - `albums` (name, path, description, `media_count`)
   - `tags` & `media_tags` (many-to-many relationship)
   - Triggers `after_media_insert`, `after_media_delete`, and `after_media_update` maintain `albums.media_count` automatically.
   - Indexes on `(album_id, created_at)`, `created_at`, and `mime_type`.

#### Key Query Functions
- `getLibraryStats(): Promise<LibraryStats>`: Aggregate SQL calculation of items, images, videos, albums, tags, and disk footprint.
- `getMediaItems(options: GetMediaOptions): Promise<{ items: MediaItem[]; totalCount: number }>`:
  Full-featured paginated query supporting:
  - Text search across `current_relative_path` and `original_relative_path`.
  - Type filters (`all`, `image`, `video`).
  - Album ID and Tag ID filtering.
  - Sorting by `created_at`, `file_size`, or path in `ASC` or `DESC`.
- `getMediaItemById(id: number): Promise<MediaItem | null>`: Fetches media record with associated tags.
- `getAlbums(): Promise<Album[]>`: Returns albums with cover media IDs and media counts.
- `getTags(): Promise<Tag[]>`: Returns tags with associated item counts.
- `getRecentMedia(limit?: number): Promise<MediaItem[]>`: Fast retrieval of newly added media.

---

### 2.4 Downloader Service (`downloader.ts`)

[downloader.ts](file:///home/destiny/Documents/projects/d-stream/src/services/downloader.ts) is responsible for downloading full-resolution media files and offline thumbnails.

#### Key Capabilities
1. **Permission Virtualization & Android 13+ Compatibility**:
   - Checks `isSandboxPath(destDir)`: Writing to standard app sandbox paths (`documentDirectory` or `cacheDirectory`) bypasses OS permission prompts, preventing crashes on Android 13+ (API 33+) in Expo Go.
   - For external directories, selectively prompts for `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO` on Android 13+, or legacy `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` on older versions.
2. **Directory Resolution & Sanitization**:
   `resolveDestinationDirectory(albumName)` automatically sanitizes path segments and provisions album subfolders.
3. **Download with Live Progress & UI Toasts**:
   Downloads the media asset via `FileSystem.createDownloadResumable`, streaming progress percentages to the caller and updating Sonner toast notifications.
4. **Automatic Offline Thumbnail Caching**:
   After the media file is saved, its companion thumbnail is fetched and saved to `${destDir}.thumbs/${item.id}.jpg` for instant offline rendering in media grids.
5. **Persistence**:
   Registers the completed download record with `storage.ts`.

---

## 3. Store Layer (`src/store/`)

The application employs a hybrid state management architecture:
- **Jotai (`atoms.ts`)** for granular, screen-level filter and pagination controls that require reactive, component-level subscriptions without triggering store-wide rerenders.
- **Zustand (`use-app-store.ts`)** for centralized application state (server connection lifecycle, SQLite queries, synchronization progress, and download tracking).

### 3.1 Jotai Atoms (`atoms.ts`)

[atoms.ts](file:///home/destiny/Documents/projects/d-stream/src/store/atoms.ts) manages UI presentation parameters:

| Atom | Type | Default | Usage |
| :--- | :--- | :--- | :--- |
| `searchQueryAtom` | `string` | `''` | Filter text for media library searches |
| `mediaTypeFilterAtom` | `'all' \| 'image' \| 'video'` | `'all'` | Media MIME category filter |
| `selectedAlbumIdAtom` | `number \| undefined` | `undefined` | Active album filter |
| `selectedTagIdAtom` | `number \| undefined` | `undefined` | Active tag filter |
| `sortByAtom` | `'created_at' \| 'file_size' \| 'current_relative_path'` | `'created_at'` | Sort attribute |
| `sortOrderAtom` | `'ASC' \| 'DESC'` | `'DESC'` | Sort direction |
| `viewModeAtom` | `'grid' \| 'grid3' \| 'list'` | `'grid'` | Layout toggle for media screens |
| `currentPageAtom` | `number` | `1` | Active page index for media pagination |
| `pageSizeAtom` | `number` | `96` | Items per page (matches storage preference) |

---

### 3.2 Zustand App Store (`use-app-store.ts`)

[use-app-store.ts](file:///home/destiny/Documents/projects/d-stream/src/store/use-app-store.ts) provides the global state and dispatch actions:

#### Store State Structure
- **Connection & Network**:
  - `ip`: Active server IP address.
  - `port`: Active server port number.
  - `serverHistory`: Last 5 connected servers.
  - `serverInfo`: Server metadata (drive name, drive path, library stats, status).
  - `status`: `'idle' | 'testing' | 'connected' | 'downloading' | 'migrating' | 'error'`.
  - `errorMessage`: Error string when sync or ping fails.
  - `syncProgress`: `{ bytesWritten, contentLength, percentage }` during database snapshot download.
  - `latencyMs`: LAN latency in milliseconds.
  - `lastSyncTime`: ISO timestamp of the last successful snapshot import.
- **Downloads & Offline State**:
  - `downloadLocation`: Configured storage folder path.
  - `downloadedItems`: Dictionary map of `mediaId -> DownloadedItemRecord`.
  - `activeDownloads`: Dictionary map of currently downloading items with live progress.
- **Library Data**:
  - `stats`: `LibraryStats` (total items, image count, video count, album count, tag count, database size).
  - `hasDatabase`: Boolean flag indicating whether local SQLite has media rows.
  - `mediaItems`: Current page list of `MediaItem`.
  - `totalMediaCount`: Total items matching current search/filter criteria.
  - `albums`: Cached list of all albums with cover media IDs.
  - `tags`: Cached list of all tags.
  - `recentMedia`: Latest 12 media items for quick overview.
  - `isLoading`: Loading flag for page queries.
  - `isRefreshing`: Pull-to-refresh / library reload flag.
  - `currentPage` & `pageSize`: Current pagination parameters.

#### Store Action Lifecycle
```
                 init()
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
  refreshLibrary()    checkConnection()
  (Read SQLite DB)    (Ping Server LAN)
         │                   │
         │             syncDatabase()
         │                   │
         │       ┌───────────┴───────────┐
         │       ▼                       ▼
         │  downloadDatabaseSnapshot  importDownloadedSnapshot
         │       │                       │
         └───────┴───────────────────────┘
                         │
                   refreshLibrary()
```

#### Primary Store Actions
- `init()`: Invoked at application startup. Loads saved settings, refreshes local SQLite data, and verifies connectivity.
- `checkConnection(targetIp?, targetPort?)`: Pings server and measures latency. Updates history on success.
- `syncDatabase(targetIp?, targetPort?)`: Performs an end-to-end sync cycle:
  1. Tests connection to verify reachability.
  2. Sets status to `'downloading'` and downloads snapshot with live progress.
  3. Sets status to `'migrating'` and invokes `importDownloadedSnapshot()`.
  4. Updates `lastSyncTime`, persists server configuration, and calls `refreshLibrary()`.
- `refreshLibrary()`: Queries SQLite in parallel for stats, albums, tags, and recent items.
- `fetchMediaPage(options)`: Queries SQLite with search criteria, filters, sorting, and pagination offset.
- `startDownloadMediaItem(item)`: Tracks download in `activeDownloads`, invokes `downloadMediaItem`, and updates `downloadedItems`.
- `removeDownloadedMediaItem(mediaId)`: Cleans up download records.
- `updatePageSize(size)` & `updateDownloadLocation(location)`: Updates state and persists to disk.
- `removeHistoryServer(delIp, delPort)`: Removes an entry from server history.
