import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import type { Album, MediaItem } from '@/types/models';
import type { DeviceMedia } from './device-media';
import { getDeviceMediaFileUri } from './device-media';
import { getServerBaseUrl } from './sync-api';
import { getSavedWriteKey } from './storage';

async function writeHeaders(ip: string, port: number) {
  const key = await getSavedWriteKey(ip, port);
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('Enter the 64-character write token shown in the desktop Sync settings.');
  return { Authorization: `Bearer ${key}` };
}

async function client(ip: string, port: number) {
  return axios.create({ baseURL: getServerBaseUrl(ip, port), timeout: 15000, headers: await writeHeaders(ip, port) });
}

export function catalogError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    return typeof message === 'string' ? message : error.message;
  }
  return error instanceof Error ? error.message : 'The server could not complete this change.';
}

export async function createServerAlbum(ip: string, port: number, name: string, description = ''): Promise<Album> {
  const response = await (await client(ip, port)).post('/api/albums', { name: name.trim(), description: description.trim() });
  return response.data.album;
}

export async function updateServerAlbum(ip: string, port: number, albumId: number, name: string, description: string): Promise<void> {
  const response = await (await client(ip, port)).patch(`/api/albums/${albumId}`, { name: name.trim(), description: description.trim() });
  if (!response.data.success) throw new Error(response.data.error || 'Album update failed.');
}

export async function deleteServerAlbum(ip: string, port: number, albumId: number): Promise<void> {
  const response = await (await client(ip, port)).delete(`/api/albums/${albumId}`);
  if (!response.data.success) throw new Error(response.data.error || 'Album delete failed.');
}

export async function updateServerMedia(ip: string, port: number, mediaId: number, albumId: number): Promise<void> {
  const response = await (await client(ip, port)).patch(`/api/media/${mediaId}`, { albumId });
  if (!response.data.success) throw new Error(response.data.error || 'Move failed.');
}

export async function deleteServerMedia(ip: string, port: number, mediaId: number): Promise<void> {
  const response = await (await client(ip, port)).delete(`/api/media/${mediaId}`);
  if (!response.data.success) throw new Error(response.data.error || 'Media delete failed.');
}

export async function uploadDeviceMedia(
  ip: string,
  port: number,
  albumId: number,
  asset: DeviceMedia,
  onProgress?: (fraction: number) => void,
): Promise<MediaItem> {
  const fileUri = await getDeviceMediaFileUri(asset);
  const url = `${getServerBaseUrl(ip, port)}/api/media?albumId=${albumId}&filename=${encodeURIComponent(asset.filename)}`;
  const task = FileSystem.createUploadTask(url, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { ...(await writeHeaders(ip, port)), 'Content-Type': 'application/octet-stream' },
  }, ({ totalBytesSent, totalBytesExpectedToSend }) => {
    if (totalBytesExpectedToSend > 0) onProgress?.(totalBytesSent / totalBytesExpectedToSend);
  });
  const response = await task.uploadAsync();
  if (!response) throw new Error('Upload was interrupted.');
  let body: { item?: MediaItem; error?: string } = {};
  try { body = JSON.parse(response.body); } catch { /* An older server may return plain text. */ }
  if (response.status < 200 || response.status >= 300 || !body.item) {
    throw new Error(body.error || `Upload failed (HTTP ${response.status}). Update the desktop sync server if it does not support uploads.`);
  }
  return body.item;
}
