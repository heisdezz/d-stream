const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load({ token = 'a'.repeat(64), response = { status: 201, body: JSON.stringify({ item: { id: 7 } }) } } = {}) {
  const tokenCode = ts.transpileModule(fs.readFileSync('src/services/write-token.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const tokenExports = {};
  vm.runInNewContext(tokenCode, { exports: tokenExports });
  const code = ts.transpileModule(fs.readFileSync('src/services/catalog-api.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calls = { released: 0 };
  class File { constructor(uri) { calls.uri = uri; } }
  class UploadTask {
    constructor(file, url, options) { Object.assign(calls, { file, url, options }); }
    async uploadAsync() { calls.options.onProgress({ bytesSent: 50, totalBytes: 100 }); return response; }
    release() { calls.released += 1; }
  }
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'axios') return { __esModule: true, default: { create: () => ({}) } };
    if (name === 'expo-file-system') return { File, UploadTask, UploadType: { BINARY_CONTENT: 0 } };
    if (name === './device-media') return { getDeviceMediaUploadUri: async () => 'content://media/42' };
    if (name === './sync-api') return { getServerBaseUrl: () => 'http://192.168.1.2:8080' };
    if (name === './storage') return { getSavedWriteKey: async () => token };
    if (name === './write-token') return tokenExports;
    throw new Error(`Unexpected import: ${name}`);
  } });
  return { api: exports, calls };
}

test('uploads stream a content URI with authorization and release the native task', async () => {
  const { api, calls } = load({ token: 'short-token!' });
  const progress = [];
  const item = await api.uploadDeviceMedia('192.168.1.2', 8080, 5, { filename: 'My Video.mp4' }, (value) => progress.push(value));
  assert.equal(item.id, 7);
  assert.equal(calls.uri, 'content://media/42');
  assert.match(calls.url, /albumId=5&filename=My%20Video.mp4$/);
  assert.equal(calls.options.headers.Authorization, 'Bearer short-token!');
  assert.deepEqual(progress, [0.5]);
  assert.equal(calls.released, 1);
});

test('missing write token fails before starting a native upload', async () => {
  const { api, calls } = load({ token: '' });
  await assert.rejects(api.uploadDeviceMedia('192.168.1.2', 8080, 5, { filename: 'photo.jpg' }), /write token/);
  assert.equal(calls.uri, undefined);
});

test('nonprintable write tokens fail before starting a native upload', async () => {
  const { api, calls } = load({ token: 'abc\n123' });
  await assert.rejects(api.uploadDeviceMedia('192.168.1.2', 8080, 5, { filename: 'photo.jpg' }), /printable write token/);
  assert.equal(calls.uri, undefined);
});

test('server upload errors are surfaced and still release the native task', async () => {
  const { api, calls } = load({ response: { status: 401, body: '{"error":"A valid write token is required."}' } });
  await assert.rejects(api.uploadDeviceMedia('192.168.1.2', 8080, 5, { filename: 'photo.jpg' }), /valid write token/);
  assert.equal(calls.released, 1);
});
