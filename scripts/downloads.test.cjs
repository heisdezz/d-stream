const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: (name) => {
      assert.ok(name in mocks, `Unexpected dependency: ${name}`);
      return mocks[name];
    }, console: { warn() {}, log() {}, error() {} }, ...globals,
  }, { filename: file });
  return exports;
}

const record = (mediaId) => ({
  mediaId, localUri: `file:///downloads/${mediaId}.mp4`, fileName: `${mediaId}.mp4`,
  albumName: 'Test', fileSize: 100, mimeType: 'video/mp4', downloadedAt: '',
});
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise(setImmediate);
};

function backgroundHarness(jobs = []) {
  const events = [], progress = [], finished = [], timers = new Set();
  let appStateListener;
  let failSave = false;
  const appState = { currentState: 'active', addEventListener(_, listener) { appStateListener = listener; } };
  const native = {
    async getJobs() { events.push('query'); return jobs.slice(); },
    async enqueue(_url, _path, json) {
      const id = String(jobs.length + 1);
      jobs.push({ id, recordJson: JSON.stringify({ ...JSON.parse(json), localUri: `file:///downloads/${id}.mp4` }), status: 1, written: 0, total: -1 });
      return id;
    },
    async forget(id, failed) {
      events.push(failed ? 'remove-failed' : 'acknowledge');
      jobs.splice(jobs.findIndex((job) => job.id === id), 1);
    },
  };
  const service = load('src/services/background-downloader.ts', {
    expo: { requireOptionalNativeModule: () => native },
    'react-native': { Platform: { OS: 'android' }, AppState: appState },
    'expo-file-system/legacy': { getInfoAsync: async () => ({ exists: true, size: 100 }) },
    'sonner-native': { toast: { success() {}, error() {}, info() {} } },
    './storage': { saveDownloadedItemRecord: async () => {
      events.push('persist');
      if (failSave) throw new Error('Disk full');
    } },
  }, {
    setTimeout(fn) { timers.add(fn); return fn; }, clearTimeout(fn) { timers.delete(fn); },
  });
  service.observeBackgroundDownloads((value) => progress.push(value), (id, result) => finished.push({ id, ...result }));
  return {
    service, jobs, events, progress, finished,
    failSave(value) { failSave = value; },
    async tick() { const pending = [...timers]; timers.clear(); pending.forEach((fn) => fn()); await settle(); },
    async state(value) { appState.currentState = value; appStateListener(value); await settle(); },
  };
}

test('recovers a completed native job after relaunch and persists before acknowledging it', async () => {
  const harness = backgroundHarness([{ id: '41', recordJson: JSON.stringify(record(7)), status: 8, written: 100, total: 100 }]);
  await settle();
  assert.deepEqual(harness.events.slice(0, 3), ['query', 'persist', 'acknowledge']);
  assert.equal(harness.finished[0].record.mediaId, 7);
  assert.equal(harness.jobs.length, 0);
});

test('retains durable jobs when record persistence fails, then retries', async () => {
  const harness = backgroundHarness([{ id: '41', recordJson: JSON.stringify(record(7)), status: 8, written: 100, total: 100 }]);
  harness.failSave(true);
  await settle();
  assert.equal(harness.jobs.length, 1);
  assert.equal(harness.finished.length, 0);
  harness.failSave(false);
  await harness.tick();
  assert.equal(harness.finished[0].success, true);
  assert.equal(harness.jobs.length, 0);
});

test('rejects truncated native downloads and removes failed jobs without registering them', async () => {
  const harness = backgroundHarness([{ id: '41', recordJson: JSON.stringify(record(7)), status: 8, written: 100, total: 200 }]);
  await settle();
  assert.equal(harness.finished[0].success, false);
  assert.equal(harness.events.includes('persist'), false);
  assert.equal(harness.events.includes('remove-failed'), true);
});

test('reports system download failures and clears the active task', async () => {
  const harness = backgroundHarness([{ id: '41', recordJson: JSON.stringify(record(7)), status: 16, reason: 1006 }]);
  await settle();
  assert.equal(harness.finished[0].success, false);
  assert.match(harness.finished[0].error, /1006/);
  assert.equal(harness.jobs.length, 0);
});

test('uses catalog size for unknown content length, stops JS polling in background, resumes on foreground', async () => {
  const harness = backgroundHarness([{ id: '41', recordJson: JSON.stringify(record(7)), status: 2, written: 50, total: -1 }]);
  await settle();
  assert.equal(harness.progress[0].percentage, 50);
  await harness.state('background');
  const queries = harness.events.length;
  await harness.tick();
  assert.equal(harness.events.length, queries);
  harness.jobs[0].status = 8;
  harness.jobs[0].total = 100;
  await harness.state('active');
  assert.equal(harness.finished[0].success, true);
});

test('new native downloads resolve to the completed offline record', async () => {
  const harness = backgroundHarness();
  await settle();
  const pending = harness.service.downloadInBackground('http://lan/media/7', 'Test/7.mp4', record(7));
  await settle();
  assert.equal(harness.jobs.length, 1);
  harness.jobs[0].status = 8;
  harness.jobs[0].written = 100;
  harness.jobs[0].total = 100;
  await harness.tick();
  const result = await pending;
  assert.equal(result.success, true);
  assert.equal(result.record.mediaId, 7);
  assert.equal(result.localUri, 'file:///downloads/1.mp4');
});

test('concurrent record saves serialize atomic writes and preserve both records', async () => {
  const files = new Map();
  let writing = 0, maxWriting = 0;
  const storage = load('src/services/storage.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system/legacy': {
      documentDirectory: 'file:///app/',
      async getInfoAsync() { await settle(); return { exists: false }; },
      async writeAsStringAsync(path, content) {
        writing++; maxWriting = Math.max(maxWriting, writing);
        await settle(); files.set(path, content); writing--;
      },
      async moveAsync({ from, to }) { files.set(to, files.get(from)); files.delete(from); },
    },
  });
  await Promise.all([storage.saveDownloadedItemRecord(record(1)), storage.saveDownloadedItemRecord(record(2))]);
  const saved = JSON.parse(files.get('file:///app/dstream_settings.json'));
  assert.equal(maxWriting, 1);
  assert.deepEqual(Object.keys(saved.downloadedItems), ['1', '2']);
  assert.equal(files.has('file:///app/dstream_settings.json.tmp'), false);
});

test('Expo transport throttles noisy native progress and ignores negative content length', async () => {
  let now = 0;
  const progress = [], notifications = [];
  const filesystem = {
    documentDirectory: 'file:///app/',
    FileSystemSessionType: { BACKGROUND: 0 },
    getInfoAsync: async () => ({ exists: true, size: 100 }),
    downloadAsync: async () => ({ uri: 'file:///thumbnail.jpg', status: 200 }),
    createDownloadResumable(_url, uri, options, callback) {
      assert.equal(options.sessionType, 0);
      return { async downloadAsync() {
        for (let i = 1; i <= 10000; i++) {
          now += 1;
          callback({ totalBytesWritten: i / 100, totalBytesExpectedToWrite: -1 });
        }
        return { uri, status: 200 };
      } };
    },
  };
  const downloader = load('src/services/downloader.ts', {
    'expo-file-system/legacy': filesystem,
    'react-native': { Platform: { OS: 'ios' } },
    'sonner-native': { toast: { loading() {}, success() {}, error() {} } },
    '@/services/sync-api': { getMediaStreamUrl: () => 'http://lan/media/1', getThumbnailUrl: () => 'http://lan/thumbnail/1' },
    '@/services/storage': { getSavedDownloadLocation: async () => 'Movies', saveDownloadedItemRecord: async () => {} },
    './background-downloader': { hasBackgroundDownloader: false },
    './download-notifications': { notifyDownload: async (_id, _name, phase) => notifications.push(phase) },
  }, { Date: class extends Date { static now() { return now; } } });
  const result = await downloader.downloadMediaItem({ id: 1, current_relative_path: 'a.mp4', mime_type: 'video/mp4', file_size: 100 }, 'lan', 8080, (value) => progress.push(value));
  assert.equal(result.success, true);
  assert.equal(progress.length, 20);
  assert.equal(progress.at(-1).totalBytesExpectedToWrite, 100);
  assert.deepEqual(notifications, ['downloading', 'completed']);
});

test('store prevents duplicate transfers from rapid repeated taps', async () => {
  let calls = 0, finish;
  const store = load('src/store/use-app-store.ts', {
    zustand: require('zustand'),
    '@/services/background-downloader': { observeBackgroundDownloads() {} },
    '@/services/storage': { DEFAULT_PAGE_SIZE: 96, getDownloadedItemsMap: async () => ({}) },
    '@/services/sync-api': {},
    '@/services/local-db': {},
    '@/services/downloader': {
      downloadMediaItem() {
        calls++;
        return new Promise((resolve) => { finish = resolve; });
      },
    },
  }).useAppStore;
  const first = store.getState().startDownloadMediaItem({ id: 1, file_size: 100 });
  const second = await store.getState().startDownloadMediaItem({ id: 1, file_size: 100 });
  assert.equal(calls, 1);
  assert.equal(second.success, false);
  assert.match(second.error, /already downloading/);
  finish({ success: false, error: 'Cancelled' });
  await first;
  assert.equal(store.getState().activeDownloads[1], undefined);
});
