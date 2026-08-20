import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { Album, LibraryStats, MediaItem, Tag } from '@/types/models';

export const DEFAULT_DB_NAME = 'media_library.db';

let activeDbName: string = DEFAULT_DB_NAME;
let activeDbConnection: SQLite.SQLiteDatabase | null = null;
// Single-flight lock: concurrent callers (getLibraryStats, getRecentMedia,
// getAlbums, ... all fire on screen mount) await the SAME open instead of each
// racing to open its own handle to the same file name. Multiple native handles
// to one name, or a handle left dangling by a concurrent switch, is what
// surfaces as `NativeDatabase.execAsync ... NullPointerException`.
let openPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getDatabasePath(dbName: string = activeDbName): string {
  const baseDir = FileSystem.documentDirectory ?? '';
  return `${baseDir}SQLite/${dbName}`;
}

// The plain filesystem directory (no file:// scheme) that expo-sqlite should
// open databases from. We pin it to the SAME `documentDirectory/SQLite` folder
// the downloader writes into, so `openDatabaseAsync` can never resolve to a
// different (empty) directory and hand back a 0-row database.
export function getSqliteDirectory(): string {
  const baseDir = FileSystem.documentDirectory ?? '';
  return `${baseDir}SQLite`.replace(/^file:\/\//, '');
}

export function getNewSnapshotDownloadPath(): { path: string; dbName: string } {
  const baseDir = FileSystem.documentDirectory ?? '';
  const dbName = `media_library_${Date.now()}.db`;
  return {
    path: `${baseDir}SQLite/${dbName}`,
    dbName,
  };
}

export async function ensureDatabaseSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await db.execAsync(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;

      CREATE TABLE IF NOT EXISTS media_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_hash TEXT NOT NULL,
        original_relative_path TEXT UNIQUE NOT NULL,
        current_relative_path TEXT UNIQUE NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        duration_seconds INTEGER DEFAULT NULL,
        metadata_json TEXT,
        album_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        relative_path TEXT UNIQUE NOT NULL,
        description TEXT,
        media_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color_hex TEXT NOT NULL DEFAULT '#3B82F6',
        category TEXT DEFAULT 'General'
      );

      CREATE TABLE IF NOT EXISTS media_tags (
        media_id INTEGER,
        tag_id INTEGER,
        PRIMARY KEY (media_id, tag_id)
      );

      CREATE TRIGGER IF NOT EXISTS after_media_insert
      AFTER INSERT ON media_items
      BEGIN
        UPDATE albums SET media_count = media_count + 1 WHERE id = NEW.album_id;
      END;

      CREATE TRIGGER IF NOT EXISTS after_media_delete
      AFTER DELETE ON media_items
      BEGIN
        UPDATE albums SET media_count = MAX(0, media_count - 1) WHERE id = OLD.album_id;
      END;

      CREATE TRIGGER IF NOT EXISTS after_media_update
      AFTER UPDATE OF album_id ON media_items
      WHEN OLD.album_id != NEW.album_id
      BEGIN
        UPDATE albums SET media_count = MAX(0, media_count - 1) WHERE id = OLD.album_id;
        UPDATE albums SET media_count = media_count + 1 WHERE id = NEW.album_id;
      END;

      CREATE INDEX IF NOT EXISTS idx_media_album_created ON media_items(album_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_media_created ON media_items(created_at);
      CREATE INDEX IF NOT EXISTS idx_media_mime ON media_items(mime_type);

      INSERT OR IGNORE INTO albums (name, relative_path, description)
      VALUES ('unknown', 'albums/unknown', 'Default album for unsorted media');
    `);
  } catch (err) {
    console.warn('[LocalDB] Schema initialization warning:', err);
  }
}

export async function findLatestDatabaseFile(): Promise<string> {
  const dir = `${FileSystem.documentDirectory ?? ''}SQLite/`;
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      return DEFAULT_DB_NAME;
    }

    const files = await FileSystem.readDirectoryAsync(dir);
    const dbFiles = files.filter(
      (f) => f.startsWith('media_library') && f.endsWith('.db')
    );

    if (dbFiles.length === 0) return DEFAULT_DB_NAME;

    // Sort to find newest timestamped db file
    dbFiles.sort().reverse();
    return dbFiles[0];
  } catch {
    return DEFAULT_DB_NAME;
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase | null> {
  if (activeDbConnection) return activeDbConnection;

  // Coalesce concurrent open attempts into one.
  if (!openPromise) {
    openPromise = (async () => {
      try {
        const name = await findLatestDatabaseFile();
        const db = await SQLite.openDatabaseAsync(name, undefined, getSqliteDirectory());
        await ensureDatabaseSchema(db);
        activeDbName = name;
        activeDbConnection = db;
        return db;
      } catch (err) {
        console.warn('[LocalDB] Failed to open SQLite DB:', err);
        return null;
      } finally {
        openPromise = null;
      }
    })();
  }
  return openPromise;
}

export async function closeDatabase(): Promise<void> {
  if (activeDbConnection) {
    try {
      await activeDbConnection.closeAsync();
    } catch {
      // Ignored
    }
    activeDbConnection = null;
  }
}

export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const db = await getDatabase();
    if (!db) return false;
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM media_items'
    );
    return (row?.count ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function getDatabaseFileInfo(): Promise<{
  exists: boolean;
  sizeBytes: number;
  sizeFormatted: string;
}> {
  const dbPath = getDatabasePath();
  try {
    const info = await FileSystem.getInfoAsync(dbPath);
    if (!info.exists) {
      return { exists: false, sizeBytes: 0, sizeFormatted: '0 B' };
    }
    const size = info.size ?? 0;
    return {
      exists: true,
      sizeBytes: size,
      sizeFormatted: formatBytes(size),
    };
  } catch {
    return { exists: false, sizeBytes: 0, sizeFormatted: '0 B' };
  }
}

export async function importDownloadedSnapshot(newDbName: string): Promise<boolean> {
  try {
    // 0. Let any in-flight getDatabase() open finish so we don't race the
    //    module-level activeDbConnection singleton with it.
    if (openPromise) {
      await openPromise;
    }

    // 1. Diagnostic: confirm the downloaded file is where expo-sqlite will look.
    const expectedPath = getDatabasePath(newDbName);
    const info = await FileSystem.getInfoAsync(expectedPath);
    console.log(
      `[LocalDB] Snapshot file check: exists=${info.exists} size=${
        info.exists ? (info as any).size : 0
      } | sqliteDir=${getSqliteDirectory()} | defaultDir=${SQLite.defaultDatabaseDirectory}`
    );

    // 2. Open the fresh new database file directly. Unique filename => no
    //    overwrite of a file another handle already has open. Pass the explicit
    //    directory so open resolves to the exact folder we downloaded into.
    const newDb = await SQLite.openDatabaseAsync(newDbName, undefined, getSqliteDirectory());
    await ensureDatabaseSchema(newDb);

    const row = await newDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM media_items'
    );
    const mediaCount = row?.count ?? 0;

    // 2. Close the previous handle before switching so it isn't left dangling.
    const previous = activeDbConnection;
    activeDbConnection = newDb;
    activeDbName = newDbName;
    if (previous && previous !== newDb) {
      try {
        await previous.closeAsync();
      } catch {
        // Ignored
      }
    }

    console.log(`[LocalDB] Imported snapshot '${newDbName}' successfully. Media items count: ${mediaCount}`);

    // 3. Clean up older snapshot files in the background
    cleanupOldDatabases(newDbName).catch(() => {});

    return true;
  } catch (error) {
    console.error('[LocalDB] Database import failed:', error);
    return false;
  }
}

async function cleanupOldDatabases(keepDbName: string): Promise<void> {
  const dir = `${FileSystem.documentDirectory ?? ''}SQLite/`;
  try {
    const files = await FileSystem.readDirectoryAsync(dir);
    for (const file of files) {
      if (
        file.startsWith('media_library') &&
        file.endsWith('.db') &&
        file !== keepDbName
      ) {
        await FileSystem.deleteAsync(`${dir}${file}`, { idempotent: true });
      }
    }
  } catch {
    // Ignored
  }
}

export async function getLibraryStats(): Promise<LibraryStats> {
  const fileInfo = await getDatabaseFileInfo();
  const db = await getDatabase();

  if (!db) {
    return {
      total_items: 0,
      images: 0,
      videos: 0,
      albums: 0,
      tags: 0,
      db_size_bytes: fileInfo.sizeBytes,
      db_size_formatted: fileInfo.sizeFormatted,
      db_exists: false,
    };
  }

  try {
    const row = await db.getFirstAsync<{
      total_items: number;
      total_images: number;
      total_videos: number;
      total_bytes: number;
      total_albums: number;
      total_tags: number;
    }>(`
      SELECT 
        COUNT(*) AS total_items,
        COALESCE(SUM(CASE WHEN mime_type LIKE 'image/%' THEN 1 ELSE 0 END), 0) AS total_images,
        COALESCE(SUM(CASE WHEN mime_type LIKE 'video/%' THEN 1 ELSE 0 END), 0) AS total_videos,
        COALESCE(SUM(file_size), 0) AS total_bytes,
        (SELECT COUNT(*) FROM albums) AS total_albums,
        (SELECT COUNT(*) FROM tags) AS total_tags
      FROM media_items;
    `);

    const total = row?.total_items ?? 0;

    return {
      total_items: total,
      images: row?.total_images ?? 0,
      videos: row?.total_videos ?? 0,
      albums: row?.total_albums ?? 0,
      tags: row?.total_tags ?? 0,
      db_size_bytes: fileInfo.sizeBytes > 0 ? fileInfo.sizeBytes : (row?.total_bytes ?? 0),
      db_size_formatted: fileInfo.sizeBytes > 0 ? fileInfo.sizeFormatted : formatBytes(row?.total_bytes ?? 0),
      db_exists: total > 0 || fileInfo.exists,
    };
  } catch {
    return {
      total_items: 0,
      images: 0,
      videos: 0,
      albums: 0,
      tags: 0,
      db_size_bytes: fileInfo.sizeBytes,
      db_size_formatted: fileInfo.sizeFormatted,
      db_exists: false,
    };
  }
}

export interface GetMediaOptions {
  query?: string;
  type?: 'all' | 'image' | 'video';
  albumId?: number;
  tagId?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'file_size' | 'current_relative_path';
  sortOrder?: 'ASC' | 'DESC';
}

export async function getMediaItems(
  options: GetMediaOptions = {}
): Promise<{ items: MediaItem[]; totalCount: number }> {
  const db = await getDatabase();
  if (!db) {
    return { items: [], totalCount: 0 };
  }

  const {
    query = '',
    type = 'all',
    albumId,
    tagId,
    limit = 50,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'DESC',
  } = options;

  const conditions: string[] = [];
  const params: any[] = [];

  if (query.trim()) {
    conditions.push('(m.current_relative_path LIKE ? OR m.original_relative_path LIKE ?)');
    params.push(`%${query.trim()}%`, `%${query.trim()}%`);
  }

  if (type === 'image') {
    conditions.push("m.mime_type LIKE 'image/%'");
  } else if (type === 'video') {
    conditions.push("m.mime_type LIKE 'video/%'");
  }

  if (albumId !== undefined && albumId !== null) {
    conditions.push('m.album_id = ?');
    params.push(albumId);
  }

  let joinTagClause = '';
  if (tagId !== undefined && tagId !== null) {
    joinTagClause = 'INNER JOIN media_tags mt ON mt.media_id = m.id AND mt.tag_id = ?';
    params.push(tagId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) as count 
    FROM media_items m
    ${joinTagClause}
    ${whereClause}
  `;

  let totalCount = 0;
  try {
    const countRow = await db.getFirstAsync<{ count: number }>(countSql, params);
    totalCount = countRow?.count ?? 0;
  } catch {
    totalCount = 0;
  }

  const validSortColumns = ['created_at', 'file_size', 'current_relative_path'];
  const sanitizedSort = validSortColumns.includes(sortBy) ? `m.${sortBy}` : 'm.created_at';
  const sanitizedOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

  const selectSql = `
    SELECT 
      m.id,
      m.file_hash,
      m.original_relative_path,
      m.current_relative_path,
      m.file_size,
      m.mime_type,
      m.duration_seconds,
      m.metadata_json,
      m.album_id,
      m.created_at,
      a.name as album_name
    FROM media_items m
    LEFT JOIN albums a ON a.id = m.album_id
    ${joinTagClause}
    ${whereClause}
    ORDER BY ${sanitizedSort} ${sanitizedOrder}
    LIMIT ? OFFSET ?
  `;

  try {
    const rows = await db.getAllAsync<MediaItem>(selectSql, [...params, limit, offset]);
    return { items: rows, totalCount };
  } catch (error) {
    return { items: [], totalCount: 0 };
  }
}

export async function getMediaItemById(id: number): Promise<MediaItem | null> {
  const db = await getDatabase();
  if (!db) return null;

  try {
    const item = await db.getFirstAsync<MediaItem>(
      `
      SELECT 
        m.id,
        m.file_hash,
        m.original_relative_path,
        m.current_relative_path,
        m.file_size,
        m.mime_type,
        m.duration_seconds,
        m.metadata_json,
        m.album_id,
        m.created_at,
        a.name as album_name
      FROM media_items m
      LEFT JOIN albums a ON a.id = m.album_id
      WHERE m.id = ?
    `,
      [id]
    );

    if (!item) return null;

    const tags = await db.getAllAsync<Tag>(
      `
      SELECT t.id, t.name, t.color_hex, t.category
      FROM tags t
      INNER JOIN media_tags mt ON mt.tag_id = t.id
      WHERE mt.media_id = ?
      ORDER BY t.category, t.name
    `,
      [id]
    );

    return {
      ...item,
      tags,
    };
  } catch {
    return null;
  }
}

export async function getAlbums(): Promise<Album[]> {
  const db = await getDatabase();
  if (!db) return [];

  try {
    const rows = await db.getAllAsync<Album>(`
      SELECT 
        a.id, 
        a.name, 
        a.relative_path, 
        a.description, 
        a.media_count,
        a.created_at,
        (
          SELECT m.id 
          FROM media_items m 
          WHERE m.album_id = a.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) AS cover_media_id
      FROM albums a
      ORDER BY a.media_count DESC, a.name ASC
    `);
    return rows;
  } catch {
    return [];
  }
}

export async function getAlbumById(id: number): Promise<Album | null> {
  const db = await getDatabase();
  if (!db) return null;

  try {
    const row = await db.getFirstAsync<Album>(`
      SELECT 
        a.id, 
        a.name, 
        a.relative_path, 
        a.description, 
        a.media_count,
        a.created_at,
        (
          SELECT m.id 
          FROM media_items m 
          WHERE m.album_id = a.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) AS cover_media_id
      FROM albums a
      WHERE a.id = ?
    `, [id]);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function getTags(): Promise<Tag[]> {
  const db = await getDatabase();
  if (!db) return [];

  try {
    const rows = await db.getAllAsync<Tag>(`
      SELECT 
        t.id, 
        t.name, 
        t.color_hex, 
        t.category,
        COUNT(mt.media_id) as media_count
      FROM tags t
      LEFT JOIN media_tags mt ON mt.tag_id = t.id
      GROUP BY t.id
      ORDER BY media_count DESC, t.name ASC
    `);
    return rows;
  } catch {
    return [];
  }
}

export async function getRecentMedia(limit: number = 10): Promise<MediaItem[]> {
  const db = await getDatabase();
  if (!db) return [];

  try {
    return await db.getAllAsync<MediaItem>(
      `
      SELECT 
        m.id,
        m.file_hash,
        m.original_relative_path,
        m.current_relative_path,
        m.file_size,
        m.mime_type,
        m.duration_seconds,
        m.metadata_json,
        m.album_id,
        m.created_at,
        a.name as album_name
      FROM media_items m
      LEFT JOIN albums a ON a.id = m.album_id
      ORDER BY m.created_at DESC
      LIMIT ?
    `,
      [limit]
    );
  } catch {
    return [];
  }
}
