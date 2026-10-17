import axios, { AxiosInstance } from "axios";
import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { ServerInfo, SyncProgress } from "@/types/models";

export function getServerBaseUrl(ip: string, port: number): string {
  const cleanIp = ip
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  return `http://${cleanIp}:${port}`;
}

export function getMediaStreamUrl(
  ip: string,
  port: number,
  itemId: number,
): string {
  const baseUrl = getServerBaseUrl(ip, port);
  return `${baseUrl}/media/${itemId}`;
}

export function getThumbnailUrl(
  ip: string,
  port: number,
  itemId: number,
): string {
  const baseUrl = getServerBaseUrl(ip, port);
  return `${baseUrl}/thumbnail/${itemId}`;
}

function createAxiosClient(
  ip: string,
  port: number,
  timeoutMs = 4000,
): AxiosInstance {
  return axios.create({
    baseURL: getServerBaseUrl(ip, port),
    timeout: timeoutMs,
    headers: {
      Accept: "application/json",
    },
  });
}

export async function fetchServerInfo(
  ip: string,
  port: number,
  timeoutMs: number = 4000,
): Promise<ServerInfo> {
  const client = createAxiosClient(ip, port, timeoutMs);
  const baseUrl = getServerBaseUrl(ip, port);
  console.log("base_url", baseUrl);
  try {
    const response = await client.get("/api/info");
    const data = response.data;

    return {
      status: "online",
      server: data.server || "Media Library Mobile Sync Server",
      drive_name: data.drive_name,
      drive_path: data.drive_path,
      download_url: data.download_url || `${baseUrl}/download/db`,
      server_ip: data.server_ip || ip,
      server_port: data.server_port || port,
      stats: data.stats,
    };
  } catch (error: any) {
    const isTimeout =
      error.code === "ECONNABORTED" || error.message?.includes("timeout");
    console.log("[SyncAPI] fetchServerInfo failed:", {
      code: error.code,
      message: error.message,
      status: error.response?.status,
      responseData: error.response?.data,
      isTimeout,
      url: `${getServerBaseUrl(ip, port)}/api/info`,
    });
    return {
      status: "offline",
      server: "Unreachable",
      error: isTimeout
        ? `Connection timed out after ${timeoutMs / 1000}s. Check LAN connection.`
        : error.response?.data?.error ||
          error.message ||
          "Unable to connect to sync server.",
    };
  }
}

export async function testServerConnection(
  ip: string,
  port: number,
): Promise<{
  reachable: boolean;
  latencyMs: number;
  error?: string;
  serverInfo?: ServerInfo;
}> {
  const start = Date.now();
  const info = await fetchServerInfo(ip, port, 3500);
  const latencyMs = Date.now() - start;
  if (info.status === "online") {
    return {
      reachable: true,
      latencyMs,
      serverInfo: info,
    };
  }

  return {
    reachable: false,
    latencyMs,
    error: info.error || "Server is not reachable on the local network.",
  };
}

export async function downloadDatabaseSnapshot(
  ip: string,
  port: number,
  targetUri: string,
  onProgress?: (progress: SyncProgress) => void,
): Promise<{ success: boolean; uri?: string; error?: string }> {
  const baseUrl = getServerBaseUrl(ip, port);
  const downloadUrl = `${baseUrl}/download/db`;
  const startedAt = Date.now();
  let firstByteLogged = false;
  let lastReportedBytes = 0;
  let progressTimer: ReturnType<typeof setInterval> | undefined;

  try {
    const dir = targetUri.substring(0, targetUri.lastIndexOf("/"));
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    try {
      await FileSystem.deleteAsync(targetUri, { idempotent: true });
    } catch {
      // Ignored
    }

    const outputFile = new File(targetUri);
    if (onProgress) {
      progressTimer = setInterval(() => {
        try {
          const bytesWritten = outputFile.size ?? 0;
          if (bytesWritten <= lastReportedBytes) return;
          lastReportedBytes = bytesWritten;
          if (!firstByteLogged) {
            firstByteLogged = true;
            console.log(
              `[SyncAPI] Snapshot first bytes after ${Date.now() - startedAt} ms`,
            );
          }
          onProgress({ bytesWritten, contentLength: 0, percentage: 0 });
        } catch {
          // The file may not exist until the server starts responding.
        }
      }, 250);
    }

    const result = await File.downloadFileAsync(downloadUrl, outputFile);
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = undefined;
    }

    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    if (!fileInfo.exists || (fileInfo.size ?? 0) === 0) {
      return {
        success: false,
        error: "Downloaded database file is empty or missing.",
      };
    }

    onProgress?.({
      bytesWritten: fileInfo.size ?? 0,
      contentLength: fileInfo.size ?? 0,
      percentage: 100,
    });

    console.log(
      `[SyncAPI] Snapshot download complete in ${Date.now() - startedAt} ms (${fileInfo.size ?? 0} bytes)`,
    );

    return { success: true, uri: result.uri };
  } catch (error: any) {
    console.log("[SyncAPI] downloadDatabaseSnapshot failed:", {
      code: error.code,
      message: error.message,
      status: error.response?.status,
      url: `${getServerBaseUrl(ip, port)}/download/db`,
      targetUri,
    });
    try {
      await FileSystem.deleteAsync(targetUri, { idempotent: true });
    } catch {
      // Ignored
    }
    return {
      success: false,
      error: error.message || "Failed to stream database from sync server.",
    };
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }
}
