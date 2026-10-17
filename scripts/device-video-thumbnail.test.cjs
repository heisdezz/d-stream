const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(createVideoPlayer) {
  const source = fs.readFileSync('src/services/device-video-thumbnail.ts', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: () => ({ createVideoPlayer }),
    setTimeout,
    clearTimeout,
    Error,
  });
  return exports;
}

test('video thumbnails bound native decoders and skip tiles that scrolled away', async () => {
  const pending = [];
  let created = 0;
  let released = 0;
  const thumbnails = load(() => {
    created += 1;
    return {
      replaceAsync: async () => {},
      generateThumbnailsAsync: () => new Promise((resolve) => pending.push(resolve)),
      release: () => { released += 1; },
    };
  });
  const signals = Array.from({ length: 4 }, () => new AbortController());
  const requests = signals.map((controller, index) =>
    thumbnails.getDeviceVideoThumbnail(`file:///video-${index}.mp4`, controller.signal));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(created, 2);
  assert.equal(pending.length, 2);

  signals[2].abort();
  await assert.rejects(requests[2], /cancelled/);
  const firstFrame = { release: () => {} };
  pending.shift()([firstFrame]);
  assert.equal(await requests[0], firstFrame);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(created, 3, 'Only the remaining queued tile starts');
  assert.equal(released, 1);

  pending.shift()([{ release: () => {} }]);
  pending.shift()([{ release: () => {} }]);
  await Promise.all([requests[1], requests[3]]);
  assert.equal(released, 3);
});
