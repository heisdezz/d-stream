import * as Network from 'expo-network';
import { requireOptionalNativeModule } from 'expo';
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
  knownIps?: string[];
  knownServers?: Array<{ ip: string; port: number }>;
  timeoutPerHostMs?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onServerFound?: (server: DiscoveredServer) => void;
  onSubnetResolved?: (subnet: string) => void;
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
      return /^\d{1,3}$/.test(p) && n >= 0 && n <= 255;
    });
    if (isNumeric) {
      return parts.slice(0, 3).map(Number).join('.');
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
    if (ip && getSubnetPrefix(ip) && ip !== '0.0.0.0' && !ip.startsWith('127.')) {
      return ip;
    }
  } catch (err) {
    console.warn('[LAN Discovery] Could not get device IP address:', err);
  }
  return null;
}

export interface DeviceNetwork {
  ip: string;
  prefixLength: number;
  name?: string;
}

const nativeNetwork = requireOptionalNativeModule<{
  getInterfaces(): Promise<DeviceNetwork[]>;
}>('DStreamNetwork');

/** Prefer actual interface masks; older binaries/iOS fall back to Expo's Wi-Fi IP. */
export async function getDeviceNetworks(): Promise<DeviceNetwork[]> {
  if (nativeNetwork) {
    try {
      const interfaces = await nativeNetwork.getInterfaces();
      const valid = interfaces.filter(({ ip, prefixLength }) =>
        getSubnetPrefix(ip) && ip !== '0.0.0.0' && !ip.startsWith('127.') &&
        Number.isInteger(prefixLength) && prefixLength > 0 && prefixLength <= 32);
      if (valid.length) return valid;
    } catch (error) {
      console.warn('[LAN Discovery] Could not enumerate network interfaces:', error);
    }
  }
  const ip = await getDeviceIpAddress();
  return ip ? [{ ip, prefixLength: 24 }] : [];
}

function ipNumber(ip: string): number {
  return ip.split('.').reduce((value, octet) => value * 256 + Number(octet), 0);
}

function ipString(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

type AddressRange = { start: number; end: number; label: string };

function addressRange(network: DeviceNetwork): AddressRange {
  const size = 2 ** (32 - network.prefixLength);
  const base = Math.floor(ipNumber(network.ip) / size) * size;
  // /31 point-to-point links and /32 hosts have no network/broadcast exclusions.
  return {
    start: base + (network.prefixLength < 31 ? 1 : 0),
    end: base + size - (network.prefixLength < 31 ? 2 : 1),
    label: `${ipString(base)}/${network.prefixLength}`,
  };
}

function serverAddress(value: string, defaultPort: number): { ip: string; port: number } | null {
  const match = /^(?:https?:\/\/)?((?:\d{1,3}\.){3}\d{1,3})(?::(\d+))?(?:\/.*)?$/i.exec(value.trim());
  if (!match || !getSubnetPrefix(match[1])) return null;
  const port = match[2] ? Number(match[2]) : defaultPort;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { ip: ipString(ipNumber(match[1])), port };
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

  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const startTime = Date.now();
  const address = serverAddress(ip, port);
  if (!address) {
    externalSignal?.removeEventListener('abort', onExternalAbort);
    return null;
  }

  try {
    const aborted = new Promise<null>((resolve) => {
      onAbort = () => resolve(null);
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);
    const request = (async (): Promise<DiscoveredServer | null> => {
      const url = `http://${address.ip}:${address.port}/api/info`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (controller.signal.aborted || !data ||
          !(data.server || data.status === 'online' || data.drive_name || data.download_url)) return null;
      const serverInfo: ServerInfo = {
        status: 'online',
        server: data.server || 'Media Library Mobile Sync Server',
        drive_name: data.drive_name,
        drive_path: data.drive_path,
        download_url: data.download_url || `http://${address.ip}:${address.port}/download/db`,
        server_ip: data.server_ip || address.ip,
        server_port: data.server_port || address.port,
        stats: data.stats,
      };
      return {
        ...address,
        serverName: serverInfo.server,
        driveName: serverInfo.drive_name,
        drivePath: serverInfo.drive_path,
        latencyMs: Math.max(1, Date.now() - startTime),
        serverInfo,
      };
    })();
    // Abort must release a worker even if the fetch implementation ignores it.
    return await Promise.race([request, aborted]);
  } catch {
    return null; // Expected for hosts without a D-Stream server.
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    controller.signal.removeEventListener('abort', onAbort);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Scan active IPv4 interface ranges and reachable saved server addresses. */
export async function scanLocalNetwork(
  options: ScanOptions = {}
): Promise<{ servers: DiscoveredServer[]; scannedSubnet: string }> {
  const port = options.port ?? 8080;
  const timeoutMs = options.timeoutPerHostMs ?? 1500;
  const concurrency = Number.isFinite(options.concurrency)
    ? Math.max(1, Math.min(64, Math.floor(options.concurrency!))) : 32;
  const networks = await getDeviceNetworks();
  if (options.signal?.aborted) return { servers: [], scannedSubnet: '' };

  const detected = networks.map(addressRange);
  const ranges: AddressRange[] = [];
  for (const range of [...detected].sort((a, b) => a.start - b.start)) {
    const previous = ranges[ranges.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else ranges.push({ ...range });
  }
  const inRange = (ip: string) => ranges.some(({ start, end }) => {
    const address = ipNumber(ip);
    return address >= start && address <= end;
  });
  const priority = new Map<string, { ip: string; port: number; saved: boolean }>();
  const add = (value: string, candidatePort = port, saved = false) => {
    const address = serverAddress(value, candidatePort);
    if (address) {
      const key = `${address.ip}:${address.port}`;
      if (!priority.has(key)) priority.set(key, { ...address, saved });
    }
  };
  // Routed/VPN/public saved servers must be checked even outside a local subnet.
  options.knownServers?.forEach((server) => add(server.ip, server.port, true));
  options.knownIps?.forEach((ip) => add(ip, port, true));
  networks.forEach(({ ip }) => add(ip));
  for (const { ip } of networks) {
    const subnet = getSubnetPrefix(ip);
    for (const host of [1, 2, 100, 101, 102, 105, 110, 150, 200, 254]) {
      const candidate = `${subnet}.${host}`;
      if (inRange(candidate)) add(candidate);
    }
  }
  if (!ranges.length && !priority.size) {
    throw new Error('No active IPv4 network detected. Connect to a network or add a server address.');
  }
  const scannedSubnet = [...new Set(detected.map(({ label }) => label))].join(', ') || 'Saved server addresses';
  options.onSubnetResolved?.(scannedSubnet);
  const total = ranges.reduce((sum, { start, end }) => sum + end - start + 1, 0) +
    [...priority.values()].filter(({ ip, port: candidatePort }) => candidatePort !== port || !inRange(ip)).length;

  // Generate lazily: large masks must not allocate millions of IP strings or
  // block the UI before scanning begins. Overlapping ranges are scanned once.
  function* targets() {
    yield* priority.values();
    for (const { start, end } of ranges) {
      for (let address = start; address <= end; address++) {
        const ip = ipString(address);
        if (!priority.has(`${ip}:${port}`)) yield { ip, port, saved: false };
      }
    }
  }
  const queue = targets();
  const servers: DiscoveredServer[] = [];
  let scanned = 0;
  let lastProgress = 0;
  options.onProgress?.(0, total, '');
  async function worker() {
    while (!options.signal?.aborted) {
      const next = queue.next();
      if (next.done) break;
      const target = next.value;
      const server = await probeServer(target.ip, target.port,
        target.saved ? Math.max(timeoutMs, 4000) : timeoutMs, options.signal);
      if (options.signal?.aborted) break;
      scanned++;
      if (server) {
        servers.push(server);
        options.onServerFound?.(server);
      }
      const now = Date.now();
      if (now - lastProgress >= 200 || scanned === total) {
        lastProgress = now;
        options.onProgress?.(scanned, total, target.ip);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return { servers, scannedSubnet };
}
