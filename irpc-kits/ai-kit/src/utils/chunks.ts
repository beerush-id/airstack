/** How long deltas are collected before they are pushed as one chunk. */
export const CHUNK_WINDOW_MS = 30;

/**
 * Streams text deltas into an output as `chunks`, so each update on the wire carries only new
 * text. Deltas arriving within one window are joined into one push; `text` is set once, at the end.
 *
 * @param output - The streaming output; its `chunks` array is created on the first write if missing.
 * @param windowMs - How long deltas are collected before a push.
 * @returns `write` for each delta and `end` once the stream is complete.
 */
export function createChunkWriter(
  output: { chunks?: string[]; text?: string },
  windowMs = CHUNK_WINDOW_MS
): {
  write: (delta: string) => void;
  end: () => void;
} {
  let pending = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!pending) return;
    output.chunks ??= [];
    output.chunks.push(pending);
    pending = '';
  };

  return {
    write(delta) {
      if (!delta) return;
      pending += delta;
      timer ??= setTimeout(flush, windowMs);
    },
    end() {
      flush();
      output.text = (output.chunks ?? []).join('');
    },
  };
}
