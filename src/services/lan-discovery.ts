import * as Network from 'expo-network';
import { ServerInfo } from '@/types/models';

export interface DiscoveredServer {
  ip: string;
  port: number;
  serverName: string;
  driveName?: string;
  drivePath?: string;
  latencyMs: number;
  serverInfo: ServerInfo;
}

export interface ScanOptions {
  port?: number;
  preferredSubnet?: string;
  knownIps?: string[];
  timeoutPerHostMs?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onServerFound?: (server: DiscoveredServer) => void;
  onProgress?: (scanned: number, total: number, currentIp: string) => void;
}

/**
 * Derives a /24 subnet prefix from an IPv4 string.
 * Example: '192.168.1.45' -> '192.168.1'
 */
export function getSubnetPrefix(ip: string): string | null {
  const parts = ip.trim().split('.');
  if (parts.length === 4) {
    const isNumeric = parts.every((p) => {
      const n = Number(p);
      return !isNaN(n) && n >= 0 && n <= 255;
    });
    if (isNumeric) {
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
  }
  return null;
}

/**
 * Attempts to retrieve the device's local network IPv4 address.
 */
export async function getDeviceIpAddress(): Promise<string | null> {
  try {
    const ip = await Network.getIpAddressAsync();
    if (ip && ip !== '0.0.0.0' && !ip.startsWith('127.')) {
      return ip;
    }
  } catch (err) {
    console.warn('[LAN Discovery] Could not get device IP address:', err);
  }
  return null;
}

/**
 * Tests an individual IP and port for an active d-stream server.
 */
export async function probeServer(
  ip: string,
  port: number,
  timeoutMs: number = 900,
  externalSignal?: AbortSignal
): Promise<DiscoveredServer | null> {
  if (externalSignal?.aborted) return null;

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    const cleanIp = ip.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const url = `http://${cleanIp}:${port}/api/info`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutTimer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const latencyMs = Math.max(1, Date.now() - startTime);

    if (data && (data.server || data.status === 'online' || data.drive_name || data.download_url)) {
      const serverInfo: ServerInfo = {
        status: 'online',
        server: data.server || 'Media Library Mobile Sync Server',
        drive_name: data.drive_name,
        drive_path: data.drive_path,
        download_url: data.download_url || `http://${cleanIp}:${port}/download/db`,
        server_ip: data.server_ip || cleanIp,
        server_port: data.server_port || port,
        stats: data.stats,
      };

      return {
        ip: cleanIp,
        port,
        serverName: serverInfo.server,
        driveName: serverInfo.drive_name,
        drivePath: serverInfo.drive_path,
        latencyMs,
        serverInfo,
      };
    }
  } catch {
    // Expected for hosts without a d-stream server
  } finally {
    clearTimeout(timeoutTimer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  return null;
}

/**
 * Scans the local network subnet for available d-stream desktop sync servers.
 */
export async function scanLocalNetwork(
  options: ScanOptions = {}
): Promise<{ servers: DiscoveredServer[]; scannedSubnet: string }> {
  const port = options.port ?? 8080;
  const timeoutMs = options.timeoutPerHostMs ?? 850;
  const concurrency = options.concurrency ?? 24;

  const deviceIp = await getDeviceIpAddress();
  let subnet = options.preferredSubnet
    ? getSubnetPrefix(options.preferredSubnet)
    : null;

  if (!subnet && deviceIp) {
    subnet = getSubnetPrefix(deviceIp);
  }

  // Fallbacks if device IP or subnet is indeterminate
  if (!subnet) {
    subnet = '192.168.1';
  }

  const priorityIps: string[] = [];

  // 1. Add known / previously connected IPs if they match this subnet or are valid
  if (options.knownIps) {
    for (const known of options.knownIps) {
      if (known && !priorityIps.includes(known)) {
        priorityIps.push(known);
      }
    }
  }

  // 2. Add device IP and emulator loopbacks
  if (deviceIp && !priorityIps.includes(deviceIp)) {
    priorityIps.push(deviceIp);
  }
  if (!priorityIps.includes('10.0.2.2')) {
    priorityIps.push('10.0.2.2'); // Android emulator host
  }
  if (!priorityIps.includes('127.0.0.1')) {
    priorityIps.push('127.0.0.1'); // Local loopback
  }

  // 3. Add common router/server gateway IPs
  const commonHostOctets = [1, 2, 100, 101, 102, 105, 110, 150, 200, 254];
  for (const octet of commonHostOctets) {
    const candidate = `${subnet}.${octet}`;
    if (!priorityIps.includes(candidate)) {
      priorityIps.push(candidate);
    }
  }

  // 4. Generate all other 1..254 IP addresses in subnet
  const allIps: string[] = [...priorityIps];
  for (let i = 1; i <= 254; i++) {
    const candidate = `${subnet}.${i}`;
    if (!allIps.includes(candidate)) {
      allIps.push(candidate);
    }
  }

  const discoveredServers: DiscoveredServer[] = [];
  const foundIpMap = new Set<string>();
  let scannedCount = 0;

  // Process in chunks of `concurrency`
  for (let i = 0; i < allIps.length; i += concurrency) {
    if (options.signal?.aborted) break;

    const chunk = allIps.slice(i, i + concurrency);
    const promises = chunk.map(async (ip) => {
      if (options.signal?.aborted) return;
      options.onProgress?.(scannedCount, allIps.length, ip);

      const res = await probeServer(ip, port, timeoutMs, options.signal);
      scannedCount++;
      options.onProgress?.(scannedCount, allIps.length, ip);

      if (res && !foundIpMap.has(res.ip)) {
        foundIpMap.add(res.ip);
        discoveredServers.push(res);
        options.onServerFound?.(res);
      }
    });

    await Promise.allSettled(promises);
  }

  return {
    servers: discoveredServers,
    scannedSubnet: subnet,
  };
}
