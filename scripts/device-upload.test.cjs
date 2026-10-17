const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(upload, remove) {
  const code = ts.transpileModule(fs.readFileSync('src/services/device-upload.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name === './catalog-api') return { uploadDeviceMedia: upload };
    if (name === './device-media') return { deleteDeviceMedia: remove };
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports.uploadDeviceSelection;
}

const files = [{ id: 'a' }, { id: 'b' }];
const server = { ip: '192.168.1.2', port: 8080, albumId: 4 };

test('device originals are deleted only after their individual uploads succeed', async () => {
  const order = [];
  const upload = load(
    async (_ip, _port, _albumId, asset) => { order.push(`upload:${asset.id}`); },
    async (id) => { order.push(`delete:${id}`); return true; },
  );
  const result = await upload(files, server, true, () => {}, () => {});
  assert.deepEqual(order, ['upload:a', 'delete:a', 'upload:b', 'delete:b']);
  assert.equal(result.uploaded, 2);
  assert.equal(result.deleted, 2);
});

test('a failed upload never deletes its device original', async () => {
  const order = [];
  const upload = load(
    async (_ip, _port, _albumId, asset) => {
      order.push(`upload:${asset.id}`);
      if (asset.id === 'b') throw new Error('server unavailable');
    },
    async (id) => { order.push(`delete:${id}`); return true; },
  );
  const result = await upload(files, server, true, () => {}, () => {});
  assert.deepEqual(order, ['upload:a', 'delete:a', 'upload:b']);
  assert.equal(result.uploaded, 1);
  assert.match(result.error.message, /server unavailable/);
});

test('denied device deletion leaves uploads successful and reports remaining originals', async () => {
  const upload = load(async () => {}, async () => false);
  const result = await upload(files, server, true, () => {}, () => {});
  assert.equal(result.uploaded, 2);
  assert.equal(result.deleted, 0);
  assert.equal(result.deletionFailures, 2);
});
