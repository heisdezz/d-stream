const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadDiscovery(getIp, fetch) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/services/lan-discovery.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require(name) {
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
  assert.equal(result.scannedSubnet, '172.16.42');
  assert.deepEqual(subnets, ['172.16.42']);
  assert.equal(requested[0], '172.16.42.220');
  assert.equal(requested.length, 254);
  assert.equal(new Set(requested).size, 254);
  for (let host = 1; host <= 254; host++) assert.ok(requested.includes(`172.16.42.${host}`));
  assert.deepEqual(found.sort(), ['172.16.42.237', '172.16.42.41']);
  assert.deepEqual(progress.at(-1), [254, 254]);
});

test('does not guess a subnet from manual input when the device network is unavailable', async () => {
  for (const ip of ['0.0.0.0', '127.0.0.1', '::1', '192.168..42']) {
    const discovery = loadDiscovery(async () => ip, () => assert.fail('No network should be probed'));
    await assert.rejects(discovery.scanLocalNetwork({ preferredSubnet: '192.168.1.100' }), /Connect to Wi-Fi/);
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
