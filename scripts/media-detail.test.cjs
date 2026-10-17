const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness() {
  const slots = [], effects = [];
  let cursor = 0, dirty = false, route = '1', queries = 0, source;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => {
        const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; }
      }];
    },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() };
      return slots[i].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) {
        const old = slots[i];
        slots[i] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  const state = { ip: '10.27.147.205', port: 8080, status: 'connected', albums: [], downloadedItems: {}, activeDownloads: {} };
  const catalog = { id: 1, mime_type: 'video/mp4', current_relative_path: 'video.mp4', created_at: '', file_size: 100 };
  const load = (file, mocks) => {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { exports, console, require(name) {
      assert.ok(name in mocks, `Unexpected dependency ${name}`);
      return mocks[name];
    } });
    return exports;
  };
  const playback = load('src/hooks/use-media-playback-source.ts', { react });
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { View: 'View', ScrollView: 'ScrollView', StyleSheet: { create: (value) => value }, useWindowDimensions: () => ({ width: 400 }) },
    'expo-router': { useFocusEffect() {}, useLocalSearchParams: () => ({ id: route }), useRouter: () => ({}) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/hooks/use-media-playback-source': playback,
    '@/hooks/use-async-video-player': { useAsyncVideoPlayer(uri) { source = uri; return {}; } },
    '@/hooks/use-material-theme': { useMaterialTheme: () => ({ colors: {} }) },
    '@/store/use-app-store': { useAppStore: (selector) => selector(state) },
    '@/services/local-db': { getMediaItemById: async (id) => { queries++; return id === 1 ? catalog : null; } },
    '@/services/sync-api': { getMediaStreamUrl: (_ip, _port, id) => `http://server/${id}`, getThumbnailUrl: () => 'thumbnail' },
    '@/services/catalog-api': {},
    jotai: { useSetAtom: () => () => {} },
    '@/constants/theme': { Spacing: {}, Shapes: {}, Elevation: {} },
  };
  for (const name of ['expo-image', 'expo-video', 'expo-linking', 'expo-web-browser', '@/store/atoms', '@/types/models',
    '@/components/material/m3-card', '@/components/material/m3-badge', '@/components/material/m3-button',
    '@/components/common/screen-loader', 'sonner-native', '@expo/vector-icons']) mocks[name] = {};
  const Screen = load('src/app/media/[id].tsx', mocks).default;
  function render(fn = Screen) {
    let tree;
    for (let i = 0; i < 10; i++) {
      dirty = false; cursor = 0; tree = fn();
      while (effects.length) effects.shift()();
      if (!dirty) return tree;
    }
    throw new Error('Render loop');
  }
  return { state, playback, render, get queries() { return queries; }, get source() { return source; }, setRoute(id) { route = id; } };
}

test('download completion updates status without reloading the catalog or unmounting the page', async () => {
  const h = harness();
  h.render();
  await new Promise(setImmediate);
  assert.equal(h.render().type, 'ScrollView');
  h.state.downloadedItems[2] = { mediaId: 2, localUri: 'file:///other.mp4' };
  assert.equal(h.render().type, 'ScrollView');
  h.state.downloadedItems[1] = { mediaId: 1, localUri: 'file:///current.mp4' };
  assert.equal(h.render().type, 'ScrollView');
  assert.equal(h.queries, 1);
});

test('playback source survives completion and follows offline, deletion, and route changes', () => {
  const h = harness();
  const select = (id, local, stream) => h.render(() => h.playback.useMediaPlaybackSource(id, local, stream));
  assert.equal(select(1, undefined, 'http://server/1'), 'http://server/1');
  assert.equal(select(1, 'file:///1', 'http://server/1'), 'http://server/1');
  assert.equal(select(1, 'file:///1', null), 'file:///1');
  assert.equal(select(1, 'file:///1', 'http://server/1'), 'file:///1');
  assert.equal(select(1, undefined, 'http://server/1'), 'http://server/1');
  assert.equal(select(2, 'file:///2', 'http://server/2'), 'file:///2');
  assert.equal(select(2, undefined, null), null);
  assert.equal(select(NaN, undefined, null), null);
  assert.equal(select(NaN, undefined, null), null);
});

test('offline-only metadata becomes available without another database lookup', async () => {
  const h = harness();
  h.setRoute('2'); h.render();
  await new Promise(setImmediate);
  h.render();
  h.state.downloadedItems[2] = { mediaId: 2, localUri: 'file:///2', mimeType: 'video/mp4', fileName: '2.mp4', downloadedAt: '', fileSize: 100 };
  assert.equal(h.render().type, 'ScrollView');
  assert.equal(h.queries, 1);
});
