const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, console: { log() {}, warn() {}, error() {} },
    require(name) {
      assert.ok(name in mocks, `Unexpected dependency: ${name}`);
      return mocks[name];
    },
  });
  return exports;
}

function harness() {
  const directory = 'file:///data/user/0/com.destiny.dstream/files/SQLite/';
  const files = new Map([['media_library.db', 4096]]);
  const opened = [], inspected = [];
  const handles = new Map();
  const sqlite = {
    defaultDatabaseDirectory: directory,
    async openDatabaseAsync(name, _options, location) {
      assert.equal(name.includes('/'), false, 'SQLite must receive a filename');
      assert.equal(location, directory.slice(7, -1));
      opened.push(name);
      const handle = {
        closed: false,
        async execAsync() {},
        async getFirstAsync() {
          if (handle.failRead) throw new Error('Invalid snapshot');
          return { count: 1 };
        },
        async getAllAsync() { return []; },
        async closeAsync() { handle.closed = true; },
      };
      handles.set(name, handle);
      return handle;
    },
  };
  const service = load('src/services/local-db.ts', {
    'expo-sqlite': sqlite,
    'expo-file-system/legacy': {
      documentDirectory: directory.slice(0, -7),
      async getInfoAsync(uri) {
        inspected.push(uri);
        assert.equal(uri.includes('/SQLite/file:'), false);
        if (uri === directory) return { exists: true, isDirectory: true, size: 0 };
        const name = uri.slice(directory.length);
        return files.has(name) ? { exists: true, size: files.get(name) } : { exists: false };
      },
      async readDirectoryAsync() { return [...files.keys()]; },
      async deleteAsync(uri) { files.delete(uri.slice(directory.length)); },
    },
  });
  return { service, directory, files, opened, inspected, handles, sqlite };
}

test('full store sync imports the filename rather than the downloaded URI', async () => {
  const state = harness();
  const store = load('src/store/use-app-store.ts', {
    zustand: require('zustand'),
    '@/services/background-downloader': { observeBackgroundDownloads() {} },
    '@/services/storage': { DEFAULT_PAGE_SIZE: 96, setLastSyncTime: async () => {} },
    '@/services/local-db': state.service,
    '@/services/downloader': {},
    '@/services/sync-api': {
      async downloadDatabaseSnapshot(_ip, _port, uri) {
        assert.equal(uri.startsWith(state.directory), true);
        state.files.set(uri.slice(state.directory.length), 8192);
        return { success: true, uri };
      },
    },
  }).useAppStore;
  const result = await store.getState().syncDatabase('192.168.1.2', 8080);
  assert.equal(result.success, true);
  assert.equal(store.getState().status, 'connected');
  assert.match(state.opened[0], /^media_library_\d+\.db$/);
  assert.equal(state.service.getDatabasePath(), state.directory + state.opened[0]);
});

test('missing or empty snapshots cannot replace the current database', async () => {
  for (const size of [undefined, 0]) {
    const state = harness();
    const previous = await state.service.getDatabase();
    if (size !== undefined) state.files.set('media_library_123.db', size);
    assert.equal(await state.service.importDownloadedSnapshot('media_library_123.db'), false);
    assert.equal(await state.service.getDatabase(), previous);
    assert.equal(previous.closed, false);
    assert.equal(state.opened.length, 1);
  }
});

test('a full URI is rejected before constructing an invalid filesystem path', async () => {
  const state = harness();
  assert.equal(await state.service.importDownloadedSnapshot(state.directory + 'media_library_123.db'), false);
  assert.equal(state.inspected.length, 0);
  assert.equal(state.opened.length, 0);
});

test('failed snapshot validation closes its handle and preserves the active database', async () => {
  const state = harness();
  const previous = await state.service.getDatabase();
  state.files.set('media_library_123.db', 8192);
  const open = state.sqlite.openDatabaseAsync;
  state.sqlite.openDatabaseAsync = async (...args) => {
    const handle = await open(...args);
    handle.failRead = true;
    return handle;
  };
  assert.equal(await state.service.importDownloadedSnapshot('media_library_123.db'), false);
  assert.equal(state.handles.get('media_library_123.db').closed, true);
  assert.equal(previous.closed, false);
  assert.equal(await state.service.getDatabase(), previous);
});
