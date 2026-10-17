import { createVideoPlayer, type VideoThumbnail } from 'expo-video';

const MAX_CONCURRENT_THUMBNAILS = 2;
const THUMBNAIL_TIMEOUT_MS = 15000;
let running = 0;
const waiting: Array<() => void> = [];

function startNext() {
  while (running < MAX_CONCURRENT_THUMBNAILS && waiting.length > 0) {
    waiting.shift()?.();
  }
}

export function getDeviceVideoThumbnail(uri: string, signal: AbortSignal): Promise<VideoThumbnail> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Thumbnail cancelled'));
      return;
    }

    let started = false;
    const cancelQueued = () => {
      if (started) return;
      const index = waiting.indexOf(start);
      if (index !== -1) waiting.splice(index, 1);
      reject(new Error('Thumbnail cancelled'));
    };
    const start = () => {
      started = true;
      signal.removeEventListener('abort', cancelQueued);
      running += 1;
      void generateThumbnail(uri, signal).then(resolve, reject).finally(() => {
        running -= 1;
        startNext();
      });
    };
    signal.addEventListener('abort', cancelQueued, { once: true });
    waiting.push(start);
    startNext();
  });
}

async function generateThumbnail(uri: string, signal: AbortSignal): Promise<VideoThumbnail> {
  const player = createVideoPlayer(null);
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = async () => {
    await player.replaceAsync(uri);
    if (signal.aborted || finished) throw new Error('Thumbnail cancelled');
    const frames = await player.generateThumbnailsAsync(0, { maxWidth: 256, maxHeight: 256 });
    const [frame, ...unused] = frames;
    unused.forEach((item) => item.release());
    if (signal.aborted || finished) {
      frame?.release();
      throw new Error('Thumbnail cancelled');
    }
    if (!frame) throw new Error('No video frame available');
    return frame;
  };

  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Video thumbnail timed out')), THUMBNAIL_TIMEOUT_MS);
      }),
    ]);
  } finally {
    finished = true;
    if (timer) clearTimeout(timer);
    player.release();
  }
}
