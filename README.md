# D-Stream Mobile Application

D-Stream is a local-first, offline-capable mobile media streaming and library companion app built with **Expo (SDK 57)**, **React Native**, **Expo SQLite**, and **Material Design 3**. It connects to a local desktop media sync server over Wi-Fi/LAN, synchronizes full SQLite catalog snapshots, and streams or downloads media on demand.

---

## 📚 Technical Documentation

Comprehensive architectural and implementation guides are available in the [`docs/`](./docs) directory:

- [**Services & Store Architecture (`docs/SERVICES_AND_STORE.md`)**](./docs/SERVICES_AND_STORE.md)
  - Detailed breakdown of `storage.ts`, `sync-api.ts`, `local-db.ts`, and `downloader.ts`.
  - Jotai atomic state management (`atoms.ts`) and Zustand global store (`use-app-store.ts`).
  - Single-flight SQLite locks, atomic database swapping, and Android 13+ permission handling.
- [**Application Routes & Data Models (`docs/APP_ROUTING_AND_MODELS.md`)**](./docs/APP_ROUTING_AND_MODELS.md)
  - Full TypeScript entity definitions (`MediaItem`, `Album`, `Tag`, `LibraryStats`, etc.).
  - File-based navigation hierarchy under `src/app/` (Dashboard, Explorer, Collections, Sync, Album Gallery, Media Inspector).
  - Native video playback (`expo-video`), LegendList virtualization, and offline-first playback fallback.

---

## 🚀 Key Features

- ⚡ **Local-First SQLite Database**: Fast offline browsing of large photo and video catalogs with dynamic filtering, full-text search, and multi-field sorting.
- 🔄 **Atomic LAN Snapshot Sync**: Download full binary database snapshots from your desktop server with zero-downtime hot swapping.
- 📱 **Adaptive Media Playback**: Native video streaming via `expo-video` and high-res photo viewing via `expo-image`, seamlessly falling back to downloaded offline files when not on your home Wi-Fi.
- 📥 **Background Resumable Downloads**: Download media directly to device storage with live toast progress bars and automatic thumbnail caching for offline grids.
- 🎨 **Material Design 3 Theming**: Expressive M3 components with dynamic light and dark modes, rounded active tab pills, and responsive layouts.
- 🚀 **Smooth 60 FPS Lists**: Virtualized gallery grids and lists powered by `@legendapp/list`.

---

## 🛠 Tech Stack

- **Framework**: [Expo SDK 57](https://expo.dev) with [Expo Router](https://docs.expo.dev/router/introduction/) (React 19, React Native 0.86)
- **State Management**: [Zustand 5](https://zustand-demo.pmnd.rs/) (global application state) + [Jotai 2](https://jotai.org/) (granular UI atoms)
- **Local Database**: [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **File System & Downloads**: [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- **Media Playback**: [Expo Video](https://docs.expo.dev/versions/latest/sdk/video/) & [Expo Image](https://docs.expo.dev/versions/latest/sdk/image/)
- **Data Fetching & Caching**: [TanStack React Query v5](https://tanstack.com/query/latest)
- **Notifications**: [Sonner Native](https://github.com/gunnartorfis/sonner-native)

---

## 🏃 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Development Server

```bash
npx expo start
```

### 3. Run on Target Platform

- **Android**: `npm run android`
- **iOS**: `npm run ios`
- **Web**: `npm run web`

---

## 📁 Project Structure

```
src/
├── app/                  # Expo Router file-based pages and layouts
│   ├── (tabs)/           # Bottom tabs (Dashboard, Explorer, Collections, Sync)
│   ├── album/[id].tsx    # Album gallery view
│   └── media/[id].tsx    # Media inspector modal
├── components/           # Reusable UI & Material 3 components
├── constants/            # Theme tokens, colors, elevation, spacing
├── hooks/                # Custom React & TanStack query hooks
├── services/             # Local SQLite, sync API, storage, downloader
├── store/                # Zustand global store & Jotai atoms
└── types/                # TypeScript interfaces and model definitions
```
