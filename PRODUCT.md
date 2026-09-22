# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Self-hosters, media curators, and privacy-conscious users who manage personal photo and video collections on a home computer or NAS and want fast, private LAN streaming and offline viewing on their mobile devices without public cloud lock-in or subscription storage fees.

## Product Purpose

Deliver high-performance, private media streaming and browsing over local Wi-Fi, backed by offline SQLite metadata synchronization and selective media downloads so users retain full ownership and instant access to their personal library anywhere.

## Positioning

Unlike cloud-bound photo platforms (Google Photos, Apple Photos) or heavyweight server suites (Plex, Jellyfin), D-Stream uses a lightweight local-first snapshot synchronization model: server database snapshots are synced directly into an embedded SQLite database on device for sub-millisecond local search and filtering, with direct LAN media streaming and lossless offline downloads.

## Operating Context

- **Environment**: Android mobile client built with React Native and Expo.
- **Connectivity**: Local Area Network (Wi-Fi) connection to the user's desktop server with automatic offline fallback when disconnected.
- **Storage**: Local device storage for SQLite database snapshots, downloaded media files, and cached thumbnails.
- **Primary Workflows**:
  1. Server connection and health verification over LAN.
  2. SQLite snapshot database sync and seamless migration.
  3. Instant library browsing with multi-layout views (grid, list), tag/album filtering, and sorting.
  4. Full-screen media viewing with video playback, image zooming, and EXIF inspection.
  5. Offline downloads management with progress tracking, storage metrics, and offline playback.

## Capabilities and Constraints

- **Capabilities**:
  - Live LAN server connectivity testing with latency measurement and server history.
  - Database snapshot download, integrity verification, and instant local SQLite querying.
  - Media catalog filtering by query, media type (photo/video), album, and tags with flexible sorting.
  - High-resolution media viewer with gesture zooming, EXIF metadata display, sharing, and external app launch.
  - Background media and thumbnail downloader with progress tracking and persistent disk caching.
  - Dedicated offline downloads screen with storage statistics, filtering, and local file deletion.
- **Constraints**:
  - Zero cloud dependency; relies entirely on user-configured local network IP and port.
  - Storage consumption constrained by mobile device flash storage capacity.
  - Video streaming and playback formats constrained by device hardware decoders.

## Brand Commitments

- **Name**: D-Stream.
- **Design System**: Material Design 3 (M3) design tokens, expressive rounded containers (`rounded-3xl`, `rounded-2xl`), tonal surface elevations, and adaptive light/dark theming generated via `twrnc`.
- **Voice & Tone**: Modern, utilitarian, private, responsive, and robust.

## Evidence on Hand

- Complete Expo Router file-based architecture under [`src/app/`](src/app/).
- Persistent SQLite database layer in [`src/services/local-db.ts`](src/services/local-db.ts).
- Network sync and streaming client in [`src/services/sync-api.ts`](src/services/sync-api.ts).
- File storage and download manager in [`src/services/downloader.ts`](src/services/downloader.ts) and [`src/services/storage.ts`](src/services/storage.ts).
- Global reactive state management via Zustand in [`src/store/use-app-store.ts`](src/store/use-app-store.ts).
- Production Android APK build workflow in [`.github/workflows/build-android.yml`](.github/workflows/build-android.yml).

## Product Principles

1. **Local-First & Private**: User media and metadata never pass through third-party cloud infrastructure.
2. **Instant Responsiveness**: Browsing and search queries run on the local SQLite engine with zero network latency.
3. **Resilient Offline Experience**: Synced metadata and downloaded media remain fully explorable and playable when disconnected.
4. **Deliberate Material Polish**: Every surface follows Material 3 ergonomics, tactile contrast, and clean visual rhythm.

## Accessibility & Inclusion

- Adherence to Android touch target standards (minimum 48x48dp for interactive elements).
- High-contrast color pairings across light and dark surface themes.
- Scalable typography supporting system font sizing without layout truncation.
