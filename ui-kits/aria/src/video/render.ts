import type { VideoStageAria } from './stage.js';

/**
 * Where a render is: the frame just encoded, and how many it renders in all.
 */
export interface VideoRenderProgress {
  frame: number;
  done: number;
  total: number;
}

/**
 * What to render and where its encoded video goes.
 */
export interface VideoRenderOptions {
  /**
   * The capturing stage whose timeline is rendered; or several, each on its own timeline of the
   * same composition, which render consecutive frames together. The browser paints every stage
   * once per screen refresh, so each extra stage adds a frame per refresh, until the scene's cost
   * catches up.
   */
  stage: VideoStageAria | VideoStageAria[];

  /**
   * Receives each encoded chunk, in order, e.g. to hand to a muxer that writes the file.
   */
  output: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void;

  /**
   * Encoder settings beyond the stage's size and the timeline's frame rate (defaults to VP9 at 8 Mbps).
   */
  encoder?: Partial<VideoEncoderConfig>;

  /**
   * First frame to render (defaults to the timeline's start).
   */
  from?: number;

  /**
   * Last frame to render, included (defaults to the timeline's last frame).
   */
  to?: number;

  /**
   * Seconds between keyframes in the encoded video (defaults to 2).
   */
  keyframeEvery?: number;

  /**
   * Hears each frame as it is encoded.
   */
  progress?: (progress: VideoRenderProgress) => void;

  /**
   * Stops the render; it then rejects with the signal's reason.
   */
  signal?: AbortSignal;
}

/** How many frames may wait in the encoder before the render waits for it. */
const ENCODE_QUEUE = 8;

/**
 * Renders a capturing stage's timeline to encoded video, frame by frame: seeks the timeline to each
 * frame, waits until the stage has drawn it, and encodes what it drew. Given several stages, each
 * step seeks them to consecutive frames at once and encodes their frames in order. Each timeline
 * waits for every frame while rendering, whatever its own async setting, and gets that setting and
 * its position back afterwards. A render pauses while the page is hidden, since the browser stops
 * painting then.
 *
 * @param options - What to render and where its chunks go.
 * @returns Settles once every frame is encoded and flushed.
 */
export async function renderVideo(options: VideoRenderOptions): Promise<void> {
  const { output, signal } = options;
  const stages = Array.isArray(options.stage) ? options.stage : [options.stage];
  const [stage] = stages;
  if (!stage || stages.some((each) => !each.canvas)) throw new Error('Rendering needs capturing stages.');
  if (new Set(stages.map((each) => each.timeline)).size !== stages.length) {
    throw new Error('Each stage needs its own timeline to render frames together.');
  }

  const timeline = stage.timeline;
  const frameRate = timeline.frameRate;
  const from = Math.max(0, options.from ?? timeline.startFrame ?? 0);
  const to = Math.max(from, options.to ?? timeline.endFrame ?? timeline.totalFrames);
  const total = to - from + 1;
  const keyframeEvery = Math.max(1, Math.round((options.keyframeEvery ?? 2) * frameRate));
  const frameDuration = 1e6 / frameRate;

  let failure: unknown;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => output(chunk, meta),
    error: (error) => (failure = error),
  });
  encoder.configure({
    codec: 'vp09.00.40.08',
    bitrate: 8_000_000,
    ...options.encoder,
    width: stage.width,
    height: stage.height,
    framerate: frameRate,
  });

  const previous = stages.map((each) => ({ async: each.timeline.async, frame: each.timeline.frame }));
  for (const each of stages) {
    each.timeline.pause();
    each.timeline.async = true;
  }

  try {
    // Nothing is encoded until every clip's pictures and media have loaded.
    await Promise.all(stages.map((each) => each.ready()));

    for (let base = from; base <= to; base += stages.length) {
      signal?.throwIfAborted();
      if (failure) throw failure;
      await visible(signal);

      // Consecutive frames, one per stage, all painted in the same screen refresh.
      const batch = stages.slice(0, Math.min(stages.length, to - base + 1));
      await Promise.all(batch.map((each, index) => each.timeline.scrub(base + index)));

      for (const [index, each] of batch.entries()) {
        const frame = base + index;
        const picture = each.grab(Math.round((frame - from) * frameDuration), Math.round(frameDuration));
        encoder.encode(picture, { keyFrame: (frame - from) % keyframeEvery === 0 });
        picture.close();
        options.progress?.({ frame, done: frame - from + 1, total });
      }

      if (encoder.encodeQueueSize > ENCODE_QUEUE) await drained(encoder);
    }

    await encoder.flush();
    if (failure) throw failure;
  } finally {
    if (encoder.state !== 'closed') encoder.close();
    for (const [index, each] of stages.entries()) {
      each.timeline.async = previous[index].async;
      each.timeline.scrub(previous[index].frame);
    }
  }
}

/**
 * Settles once the page is visible, at once when it already is.
 */
function visible(signal?: AbortSignal): Promise<void> {
  if (typeof document === 'undefined' || !document.hidden) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const shown = () => {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', shown);
      resolve();
    };
    document.addEventListener('visibilitychange', shown);
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

/**
 * Settles once the encoder has worked through its queue.
 */
function drained(encoder: VideoEncoder): Promise<void> {
  return new Promise((resolve) => encoder.addEventListener('dequeue', () => resolve(), { once: true }));
}
