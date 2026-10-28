/** How long deltas are collected before they are pushed as one chunk. */
export const CHUNK_WINDOW_MS = 30;

/**
 * Collects deltas and hands them over joined, once per window, so a stream of tiny deltas becomes a
 * few pushes on the wire.
 *
 * @param onFlush - Receives each joined batch.
 * @param windowMs - How long deltas are collected before a flush.
 * @returns `write` for each delta and `flush` to hand over what is pending now.
 */
export function createBatcher(
  onFlush: (batch: string) => void,
  windowMs = CHUNK_WINDOW_MS
): { write: (delta: string) => void; flush: () => void } {
  let pending = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!pending) return;
    const batch = pending;
    pending = '';
    onFlush(batch);
  };

  return {
    write(delta) {
      if (!delta) return;
      pending += delta;
      timer ??= setTimeout(flush, windowMs);
    },
    flush,
  };
}

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
  const batcher = createBatcher((batch) => {
    output.chunks ??= [];
    output.chunks.push(batch);
  }, windowMs);

  return {
    write: batcher.write,
    end() {
      batcher.flush();
      output.text = (output.chunks ?? []).join('');
    },
  };
}
