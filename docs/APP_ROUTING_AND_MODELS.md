# D-Stream Architecture: Application Routes & Data Models Documentation

This document provides a technical reference for the **App Routing Layer** (`src/app/`) and the **Data Models / Types** (`src/types/`) of the D-Stream mobile application.

---

## 1. Data Models (`src/types/models.ts`)

[models.ts](file:///home/destiny/Documents/projects/d-stream/src/types/models.ts) defines the core domain entities used throughout the application.

### 1.1 `MediaItem`
Represents an individual image or video file cataloged in the media library:
```typescript
export interface MediaItem {
  id: number;                          // Unique SQLite primary key
  file_hash: string;                   // Content hash for deduplication
  original_relative_path: string;      // Original relative path on storage drive
  current_relative_path: string;       // Current relative path
  file_size: number;                   // Size in bytes
  mime_type: string;                   // E.g., 'image/jpeg', 'video/mp4'
  duration_seconds: number | null;     // Length of video in seconds (null for images)
  metadata_json: string | null;        // Serialized EXIF / codec metadata JSON
  album_id: number | null;             // Foreign key referencing albums.id
  created_at: string;                  // Timestamp ISO string
  album_name?: string;                 // Joined album name
  tags?: Tag[];                        // Joined list of associated tags
}
```

### 1.2 `Album`
Represents a curated media directory or collection:
```typescript
export interface Album {
  id: number;
  name: string;
  relative_path: string;
  description: string | null;
  media_count: number;                 // Maintained via database triggers
  created_at: string;
  cover_media_id?: number | null;      // ID of the newest media item in album
}
```

### 1.3 `Tag` & `MediaTag`
Enables categorization and tagging across media items:
```typescript
export interface Tag {
  id: number;
  name: string;
  color_hex: string;                   // Visual hex badge color (e.g. #3B82F6)
  category: string;                    // Grouping category (e.g. "General", "Location")
  media_count?: number;                // Aggregated count of tagged items
}

export interface MediaTag {
  media_id: number;
  tag_id: number;
}
```

### 1.4 `LibraryStats`
Aggregated overview of the entire media database:
```typescript
export interface LibraryStats {
  total_items: number;
  images: number;
  videos: number;
  albums: number;
  tags: number;
  db_size_bytes: number;
  db_size_formatted: string;           // E.g., "14.20 MB"
  db_exists: boolean;
}
```

### 1.5 `ServerInfo` & `SavedServer`
Describes the desktop sync server identity, host, and connection profiles:
```typescript
export interface ServerInfo {
  status: 'online' | 'offline' | 'error';
  server: string;
  drive_name?: string;
  drive_path?: string;
  download_url?: string | null;
  server_ip?: string;
  server_port?: number;
  stats?: LibraryStats;
  error?: string;
}

export interface SavedServer {
  ip: string;
  port: number;
  driveName?: string;
  label?: string;
  lastConnectedAt?: string;
}
```

### 1.6 `SyncProgress` & `SyncStatus`
State indicators for network synchronizations:
```typescript
export interface SyncProgress {
  bytesWritten: number;
  contentLength: number;
  percentage: number;                  // 0 to 100
}

export type SyncStatus = 
  | 'idle' 
  | 'testing' 
  | 'connected' 
  | 'downloading' 
  | 'migrating' 
  | 'success' 
  | 'error';
```

### 1.7 `ParsedMediaMetadata`
Schema for parsed EXIF, camera, and video stream metadata:
```typescript
export interface ParsedMediaMetadata {
  width?: number;
  height?: number;
  codec?: string;
  bitrate?: number;
  fps?: number;
  camera_make?: string;
  camera_model?: string;
  date_taken?: string;
  iso?: number;
  exposure_time?: string;
  f_number?: number;
  latitude?: number;
  longitude?: number;
  [key: string]: any;
}
```

---

## 2. Navigation & App Routes (`src/app/`)

The application uses **Expo Router** file-based navigation with native modals and bottom tabs.

```
src/app/
├── _layout.tsx                     # Root provider tree, fonts, theme, native splash
├── (tabs)/
│   ├── _layout.tsx                 # Material 3 navigation tab bar
│   ├── index.tsx                   # Media Dashboard & stats overview
│   ├── media.tsx                   # High-performance virtualized Media Explorer
│   ├── albums.tsx                  # Albums & Tag Collections browser
│   └── sync.tsx                    # LAN Sync, Server History & Settings
├── album/
│   └── [id].tsx                    # Album Gallery with debounced search & pagination
└── media/
    └── [id].tsx                    # Media Inspector modal with video player & EXIF
```

---

### 2.1 Root Layout (`_layout.tsx`)

[src/app/_layout.tsx](file:///home/destiny/Documents/projects/d-stream/src/app/_layout.tsx) initializes runtime providers, loads custom fonts, handles native splash screen visibility, and mounts the primary navigation stack.

#### Provider Tree
1. **`GestureHandlerRootView`**: Enables smooth gestures for modals and sliders.
2. **`QueryClientProvider`**: TanStack Query client for cached and asynchronous fetch operations.
3. **`SafeAreaProvider`**: Device notch and bottom inset calculations.
4. **`StatusBar`**: Automatically synchronized with `isDark` Material3 theme.
5. **`SplashView`**: Custom animated splash screen matching Material Design 3 tokens.
6. **`Toaster`**: Sonner-native bottom-centered toast notifications.
7. **`Stack` Navigation**:
   - `(tabs)`: Bottom tabs group (`headerShown: false`).
   - `album/[id]`: Album gallery stack screen (`headerShown: true`).
   - `media/[id]`: Modal media viewer screen (`presentation: 'modal'`, `headerShown: true`).

#### Bootstrap Sequence
```typescript
// Prevents flash of unstyled content
SplashScreen.preventAutoHideAsync().catch(() => {});

// Initializes store, loads disk configuration, pings server, queries SQLite
useEffect(() => {
  async function prepare() {
    try {
      await useAppStore.getState().init();
    } finally {
      setAppReady(true);
    }
  }
  prepare();
}, []);
```

---

### 2.2 Tab Navigation Layout (`(tabs)/_layout.tsx`)

[src/app/(tabs)/_layout.tsx](file:///home/destiny/Documents/projects/d-stream/src/app/(tabs)/_layout.tsx) configures the Material Design 3 bottom navigation bar with active pill indicators (`secondaryContainer`), theme tints, and custom icons.

| Tab Route | Label | Screen Title | Icon (Active / Inactive) |
| :--- | :--- | :--- | :--- |
| `index` | Dashboard | Media Dashboard | `dashboard` / `dashboard-customize` |
| `media` | Explorer | Media Explorer | `perm-media` / `photo-library` |
| `albums` | Collections | Albums & Tags | `collections-bookmark` / `folder-special` |
| `sync` | Sync | LAN Sync & DB | `sync` / `arrow.triangle.2.circlepath` |

---

### 2.3 Dashboard Screen (`(tabs)/index.tsx`)

[src/app/(tabs)/index.tsx](file:///home/destiny/Documents/projects/d-stream/src/app/(tabs)/index.tsx) acts as the home hub for the user's media library.

#### Features & Sections
1. **Header & LAN Connection Badge**:
   - Dynamic time greeting ("Good Morning", "Good Afternoon", "Good Evening").
   - Live LAN connectivity status chip displaying server IP, port, and millisecond latency.
   - Quick one-tap sync trigger button.
2. **Live Sync Progress**:
   - When `status === 'downloading'` or `'migrating'`, displays `SyncProgressBar` showing byte transfer count and percentage.
3. **Library Statistics Cards**:
   - Total items count.
   - Images vs Videos proportion bars.
   - Total albums count and SQLite database file size.
4. **Fast Navigation Shortcuts**:
   - Pressing "Photos" or "Videos" sets the Jotai `mediaTypeFilterAtom` and navigates directly to `(tabs)/media`.
5. **Recent Media & Albums Carousel**:
   - Horizontal preview of the latest 12 media items.
   - Quick album cards to jump directly into collections.
6. **Pull-to-Refresh**:
   - Concurrently executes `checkConnection()` and `refreshLibrary()`.

---

### 2.4 Media Explorer Screen (`(tabs)/media.tsx`)

[src/app/(tabs)/media.tsx](file:///home/destiny/Documents/projects/d-stream/src/app/(tabs)/media.tsx) provides browsing and searching across the catalog.

#### Key Architectural Features
1. **High-Performance Virtualization (`@legendapp/list`)**:
   - Renders large libraries smoothly at 60fps using LegendList.
2. **Filtering & Search**:
   - Search bar linked to `searchQueryAtom`.
   - MIME Segment selector: `All`, `Photos`, `Videos`.
   - Removable chip filters for active album and tag selections.
3. **Multi-Layout Switcher**:
   - Supports 2-column grid (`grid`), 3-column compact grid (`grid3`), and detailed single-column list (`list`).
4. **Server-Style Offset Pagination**:
   - Controlled by `currentPageAtom` and `pageSizeAtom` (persisted to storage).
   - `PaginationBar` with first/prev/next/last controls and jump-to-page capability.
5. **Item Interaction**:
   - Tapping any card opens `media/[id]` in a modal inspector.

---

### 2.5 Collections Screen (`(tabs)/albums.tsx`)

[src/app/(tabs)/albums.tsx](file:///home/destiny/Documents/projects/d-stream/src/app/(tabs)/albums.tsx) manages album directories and taxonomy tags.

#### Key Features
1. **Segmented View**:
   - **Albums View**: Displays album cards with thumbnail cover art (from `cover_media_id`), item count, and relative storage path. Tapping navigates to `/album/[id]`.
   - **Tags & Categories View**: Groups tags by category (e.g., "General", "People", "Events") with colored badge indicators and item counts. Tapping a tag sets `selectedTagIdAtom` and opens the Media Explorer filtered by that tag.
2. **Live Client-Side Search Filtering**:
   - Debounced search filter over album names and tag names.
3. **React Query Integration**:
   - Uses `useAlbumsQuery` and `useTagsQuery` hooks for caching and background updates.

---

### 2.6 LAN Sync & Settings Screen (`(tabs)/sync.tsx`)

[src/app/(tabs)/sync.tsx](file:///home/destiny/Documents/projects/d-stream/src/app/(tabs)/sync.tsx) manages connection configuration, database synchronization, and local storage settings.

#### Key Features
1. **Server Connection Manager**:
   - IP address and port input with live "Apply & Test" connection diagnostic.
   - Displays real-time round-trip latency (`latencyMs`) and server status.
2. **Full Database Snapshot Sync**:
   - "Sync Database Snapshot" button initiates download from `/download/db`.
   - Live progress indicator during transfer and database migration.
3. **Connection History**:
   - Remembers up to 5 recently connected servers with timestamps and drive labels.
   - Allows instant reconnection or deletion of individual history profiles.
4. **Storage & Download Preferences**:
   - Download destination directory configuration (default: `Movies/d-stream`).
   - Pagination limit selector (`24`, `48`, `72`, `96`, `120`, `144`, `168`, `180`).
5. **Local Database Diagnostics**:
   - Shows database existence, disk footprint in MB/KB, total item count, and downloaded offline files count.
6. **Troubleshooting FAQ Accordion**:
   - In-app assistance for Wi-Fi subnet isolation, firewall ports, and desktop server requirements.

---

### 2.7 Album Gallery Screen (`album/[id].tsx`)

[src/app/album/[id].tsx](file:///home/destiny/Documents/projects/d-stream/src/app/album/[id].tsx) displays the media items belonging to a specific album.

#### Key Features
1. **Dynamic Routing**:
   - Uses `useLocalSearchParams<{ id: string }>()` to parse `albumId`.
2. **Album Header Hero**:
   - Displays album title, description, total item count, creation date, and cover art.
3. **Scoped Search & Filtering**:
   - Search within the album by keyword.
   - Filter by `All`, `Photos`, or `Videos`.
   - Sort by date, size, or path in ascending or descending order.
4. **Virtualized Gallery**:
   - Rendered using `@legendapp/list` with 2-column, 3-column, or list view toggles.
   - TanStack Query (`useQuery(['album-media', ...])`) for caching.

---

### 2.8 Media Inspector Modal (`media/[id].tsx`)

[src/app/media/[id].tsx](file:///home/destiny/Documents/projects/d-stream/src/app/media/[id].tsx) is a modal screen for media preview, playback, and metadata inspection.

#### Key Features
1. **Seamless Online / Offline Playback Switching**:
   - Checks `downloadedItems[item.id]`. If the item has been downloaded locally, it plays directly from `downloadedRecord.localUri` without requiring network access.
   - If connected over LAN, it streams from `${baseUrl}/media/${item.id}`.
   - If offline and not downloaded, displays a friendly offline notification.
2. **Native Video Player**:
   - Uses `expo-video` (`useVideoPlayer` and `VideoView`) with native playback controls, fullscreen mode, and picture-in-picture support.
3. **Image Viewer**:
   - Uses `expo-image` with smooth transition animations and containment aspect ratios.
4. **Offline Download Manager**:
   - Download button initiates local caching via `startDownloadMediaItem`.
   - Live download progress reported via Sonner toasts and store state.
   - If already downloaded, allows viewing the local storage path or deleting the local copy to free space.
5. **External Sharing & Apps**:
   - "Open In..." opens the media URL or file path in external apps or browser (`expo-linking`, `expo-web-browser`).
   - "Share" triggers native OS sharing (`Share.share`).
6. **Detailed Metadata Tabs**:
   - **Details**: Relative path, file size, MIME type, dimensions, duration.
   - **EXIF / Codec**: Camera make, model, ISO, shutter speed, f-number, video codec, bitrate, FPS, GPS coordinates.
   - **Tags**: List of associated tags with quick filters.
7. **Jump to Album**:
   - Quick action to dismiss modal and navigate directly to the parent album's gallery.
