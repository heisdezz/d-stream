import { useState } from 'react';

// Keep a valid source for this media item so completing a download doesn't
// replace an active stream and reset the player's position.
export function useMediaPlaybackSource(mediaId: number, localUri: string | undefined, streamUri: string | null) {
  const preferredUri = localUri || streamUri;
  const [selected, setSelected] = useState({ mediaId, uri: preferredUri });
  const sameItem = Object.is(selected.mediaId, mediaId);
  const uri = sameItem && selected.uri &&
    (selected.uri === localUri || selected.uri === streamUri)
    ? selected.uri
    : preferredUri;

  if (!sameItem || selected.uri !== uri) {
    setSelected({ mediaId, uri });
  }
  return uri;
}
