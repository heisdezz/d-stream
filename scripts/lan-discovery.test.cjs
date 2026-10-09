const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadDiscovery(getIp, fetch, getInterfaces) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/services/lan-discovery.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (name === 'expo') return {
        requireOptionalNativeModule: () => getInterfaces ? { getInterfaces } : null,
      };
      assert.equal(name, 'expo-network');
      return { getIpAddressAsync: getIp };
    },
    fetch, AbortController, setTimeout, clearTimeout,
    console: { warn() {} },
  });
  return exports;
}

test('scans every host in the device subnet even with a stale manually entered address', async () => {
  const requested = [], found = [], subnets = [], progress = [];
  const discovery = loadDiscovery(async () => '172.16.42.13', async (url) => {
    const address = new URL(url);
    requested.push(address.hostname);
    assert.equal(address.port, '9090');
    assert.equal(address.pathname, '/api/info');
    if (!['172.16.42.41', '172.16.42.237'].includes(address.hostname)) return { ok: false };
    return { ok: true, json: async () => ({ server: 'D-Stream', status: 'online' }) };
  });
  const result = await discovery.scanLocalNetwork({
    // A stale caller supplying the old option cannot change the automatic scan.
    preferredSubnet: '192.168.99.100',
    knownIps: ['192.168.99.100', '172.16.42.220'],
    port: 9090,
    onSubnetResolved: (value) => subnets.push(value),
    onServerFound: (value) => found.push(value.ip),
    onProgress: (scanned, total) => progress.push([scanned, total]),
  });
  assert.equal(result.scannedSubnet, '172.16.42.0/24');
  assert.deepEqual(subnets, ['172.16.42.0/24']);
  assert.equal(requested[0], '192.168.99.100');
  assert.equal(requested[1], '172.16.42.220');
  assert.equal(requested.length, 255);
  assert.equal(new Set(requested).size, 255);
  for (let host = 1; host <= 254; host++) assert.ok(requested.includes(`172.16.42.${host}`));
  assert.deepEqual(found.sort(), ['172.16.42.237', '172.16.42.41']);
  assert.deepEqual(progress.at(-1), [255, 255]);
});

test('does not guess a subnet from manual input when the device network is unavailable', async () => {
  for (const ip of ['0.0.0.0', '127.0.0.1', '::1', '192.168..42']) {
    const discovery = loadDiscovery(async () => ip, () => assert.fail('No network should be probed'));
    await assert.rejects(discovery.scanLocalNetwork({ preferredSubnet: '192.168.1.100' }), /No active IPv4 network/);
  }
});

test('cancellation during device network lookup starts no probes', async () => {
  let resolveIp;
  const controller = new AbortController();
  const discovery = loadDiscovery(() => new Promise((resolve) => { resolveIp = resolve; }), () => assert.fail('Scan was cancelled'));
  const pending = discovery.scanLocalNetwork({ signal: controller.signal });
  controller.abort();
  resolveIp('192.168.2.15');
  const result = await pending;
  assert.equal(result.servers.length, 0);
});

test('cancellation stops scheduling additional batches', async () => {
  const controller = new AbortController();
  const requested = [];
  const discovery = loadDiscovery(async () => '192.168.2.15', async (url) => {
    requested.push(url);
    return { ok: false };
  });
  await discovery.scanLocalNetwork({
    concurrency: 4,
    signal: controller.signal,
    onProgress(scanned) { if (scanned >= 1) controller.abort(); },
  });
  assert.ok(requested.length <= 4);
});

test('host timeout covers response body parsing as well as connection setup', async () => {
  const discovery = loadDiscovery(async () => '192.168.2.15', async (_url, options) => ({
    ok: true,
    json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('Timeout')), { once: true });
    }),
  }));
  assert.equal(await discovery.probeServer('192.168.2.42', 8080, 10), null);
});

const online = { ok: true, json: async () => ({ server: 'D-Stream', status: 'online' }) };

test('finds 10.27.147.205 on secondary Wi-Fi alongside cellular interfaces', async () => {
  const requested = [], progress = [];
  const discovery = loadDiscovery(() => assert.fail('Native interfaces must replace the single Wi-Fi lookup'), async (url) => {
    const address = new URL(url);
    requested.push(address.hostname);
    return address.hostname === '10.27.147.205' ? online : { ok: false };
  }, async () => [
    { ip: '10.159.63.189', prefixLength: 30, name: 'rmnet_data1' },
    { ip: '10.60.129.237', prefixLength: 30, name: 'rmnet_data2' },
    { ip: '10.27.147.65', prefixLength: 24, name: 'wlan2' },
  ]);
  const result = await discovery.scanLocalNetwork({ onProgress: (done, total) => progress.push([done, total]) });
  assert.equal(result.servers[0].ip, '10.27.147.205');
  assert.equal(requested.length, 258);
  assert.equal(new Set(requested).size, 258);
  assert.deepEqual(progress.at(-1), [258, 258]);
});

test('uses actual masks and scans overlapping networks only once', async () => {
  const requested = [];
  const discovery = loadDiscovery(() => assert.fail('Use actual masks'), async (url) => {
    const ip = new URL(url).hostname;
    requested.push(ip);
    return ip === '192.168.11.205' ? online : { ok: false };
  }, async () => [
    { ip: '192.168.10.65', prefixLength: 23 },
    { ip: '192.168.11.65', prefixLength: 24 },
  ]);
  const result = await discovery.scanLocalNetwork();
  assert.equal(result.servers[0].ip, '192.168.11.205');
  assert.equal(requested.length, 510);
  assert.equal(new Set(requested).size, 510);
  assert.ok(requested.includes('192.168.10.255'));
  assert.ok(requested.includes('192.168.11.0'));
});

test('checks saved routed addresses with their own ports and normalizes full URLs', async () => {
  const requested = [];
  const discovery = loadDiscovery(async () => '192.168.1.10', async (url) => {
    requested.push(url);
    return url === 'http://203.0.113.205:9090/api/info' ? online : { ok: false };
  });
  const result = await discovery.scanLocalNetwork({
    knownServers: [{ ip: 'http://203.0.113.205:9090/', port: 8080 }],
    knownIps: ['203.0.113.205:9090'],
  });
  assert.equal(requested[0], 'http://203.0.113.205:9090/api/info');
  assert.equal(result.servers[0].port, 9090);
  assert.equal(requested.length, 255);
});

test('can find a saved server even when the Expo Wi-Fi lookup returns zero', async () => {
  const requested = [];
  const discovery = loadDiscovery(async () => '0.0.0.0', async (url) => {
    requested.push(url);
    return online;
  });
  const result = await discovery.scanLocalNetwork({ knownIps: ['http://10.27.147.205:8080/'] });
  assert.deepEqual(requested, ['http://10.27.147.205:8080/api/info']);
  assert.equal(result.servers[0].ip, '10.27.147.205');
});

test('a host that ignores abort cannot hold the scan worker indefinitely', async () => {
  const discovery = loadDiscovery(async () => '192.168.1.10', () => new Promise(() => {}));
  assert.equal(await discovery.probeServer('192.168.1.20', 8080, 10), null);
});

test('large interface ranges start lazily and remain cancellable', async () => {
  const controller = new AbortController();
  let requests = 0, total;
  const discovery = loadDiscovery(() => assert.fail('Use native interfaces'), async () => {
    requests++;
    return { ok: false };
  }, async () => [{ ip: '10.27.147.65', prefixLength: 8 }]);
  await discovery.scanLocalNetwork({ concurrency: 4, signal: controller.signal,
    onProgress(scanned, count) {
      total = count;
      if (scanned >= 1) controller.abort();
    },
  });
  assert.equal(total, 16_777_214);
  assert.ok(requests <= 4);
});

test('/31 links include both endpoints and /32 interfaces include their host', async () => {
  const requested = [];
  const discovery = loadDiscovery(() => assert.fail('Use actual masks'), async (url) => {
    requested.push(new URL(url).hostname);
    return { ok: false };
  }, async () => [
    { ip: '192.168.1.0', prefixLength: 31 },
    { ip: '192.168.2.7', prefixLength: 32 },
  ]);
  await discovery.scanLocalNetwork();
  assert.deepEqual(requested.sort(), ['192.168.1.0', '192.168.1.1', '192.168.2.7']);
});
