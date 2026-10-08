import { useEffect, useRef } from "react";
import { useVideoPlayer } from "expo-video";

/** Keep one player instance and load sources without blocking the UI thread. */
export function useAsyncVideoPlayer(source: string | null, loop: boolean, autoplay = false) {
  const player = useVideoPlayer(null, (instance) => { instance.loop = loop; });
  const shouldPlay = useRef(autoplay);
  shouldPlay.current = autoplay;
  const pending = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    // Serialize replacements: a slower old request cannot replace the new source.
    pending.current = pending.current.then(async () => {
      if (cancelled) return;
      player.pause();
      await player.replaceAsync(source);
      if (!cancelled && source && shouldPlay.current) player.play();
    }).catch((error) => {
      if (!cancelled) console.warn("[Player] Could not load media:", error);
    });
    return () => { cancelled = true; };
  }, [player, source]);

  return player;
}
