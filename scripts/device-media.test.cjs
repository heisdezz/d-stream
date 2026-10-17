const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(nativeModule, library) {
  const source = fs.readFileSync('src/services/device-media.ts', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === 'expo') return { requireOptionalNativeModule: () => nativeModule };
      if (name === 'expo-media-library/legacy') {
        assert.ok(nativeModule, 'The media library must not load without its native module');
        return library;
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

test('older app builds can open the device-media screen without loading the missing native module', async () => {
  const media = load(null);
  assert.equal(media.isDeviceMediaAvailable(), false);
  await assert.rejects(media.requestDeviceMediaAccess(), /newer app build/);
});

test('available native library loads one bounded gallery page', async () => {
  let query;
  const media = load({}, {
    getPermissionsAsync: async () => ({ granted: true }),
    getAssetsAsync: async (options) => { query = options; return { assets: [], hasNextPage: false }; },
  });
  assert.equal(media.isDeviceMediaAvailable(), true);
  assert.equal(await media.requestDeviceMediaAccess(), true);
  await media.getDeviceMediaPage();
  assert.equal(query.first, 36);
  assert.deepEqual(Array.from(query.mediaType), ['photo', 'video']);
});

test('device albums come from the native album query and filter album pages', async () => {
  let query;
  const media = load({}, {
    getAlbumsAsync: async () => [
      { id: '2', title: 'Trips', assetCount: 3 },
      { id: '1', title: 'Camera', assetCount: 5 },
    ],
    getAssetsAsync: async (options) => { query = options; return { assets: [] }; },
  });
  assert.deepEqual((await media.getDeviceAlbums()).map((album) => album.title), ['Camera', 'Trips']);
  await media.getDeviceMediaPage(undefined, '1');
  assert.equal(query.album, '1');
  await media.getDeviceMediaPage(undefined, '__all__');
  assert.equal(query.album, undefined);
});
