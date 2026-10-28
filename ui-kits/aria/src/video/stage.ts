import type { FrameState, Timeline } from '@airlib/core/timeline';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import type { VideoClipAria } from './clip.js';
import {
  PAINT_TIMEOUT,
  SOUND_DRIFT,
  settleAll,
  VIDEO_HEIGHT,
  VIDEO_PREROLL,
  VIDEO_WIDTH,
  type VideoMedia,
  type VideoMediaLoader,
  videoStageCtx,
} from './shared.js';

/**
 * Reactive input properties for VideoStageAria.
 */
export interface VideoStageProps extends AriaProps {
  /**
   * Composition width in the stage's own units (defaults to 1920).
   */
  width?: number;

  /**
   * Composition height in the stage's own units (defaults to 1080).
   */
  height?: number;
}

/**
 * Static configuration for VideoStageAria.
 */
export interface VideoStageOptions extends AriaOptions {
  /**
   * The timeline whose frames the stage presents.
   */
  timeline: Timeline;

  /**
   * How long before its segment starts, in seconds, a clip is put on stage painted but unseen, so
   * it shows without a flicker (defaults to 2). Previews only; capture waits for every frame anyway.
   */
  preroll?: number;

  /**
   * Draw the clips into the stage element each frame: the element is a canvas, and its clips are
   * its direct children, drawn with HTML-in-Canvas so the frame can be read back, e.g. to export.
   * Without it the clips are shown as they are.
   */
  capture?: boolean;

  /**
   * Opens the media clips name by `media`: the app's own decoder, so the stage draws each frame's
   * picture exactly and plays every clip's sound on one clock, rather than leaving each to a
   * media element of its own, which drifts.
   */
  media?: VideoMediaLoader;
}

/**
 * Compiled attributes for the stage element.
 *
 * @template E - Target Element type
 */
export interface VideoStageAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  'aria-hidden': 'true';
  'data-video-stage': string;
  width?: number;
  height?: number;
}

/**
 * Whether this browser can draw HTML into a canvas, which capture needs.
 *
 * @returns Whether `drawElementImage` is available.
 */
export function canCaptureVideo(): boolean {
  return typeof CanvasRenderingContext2D !== 'undefined' && 'drawElementImage' in CanvasRenderingContext2D.prototype;
}

/**
 * A video composition's surface: a box of `width` by `height` units holding one element per clip,
 * scaled to fit its container, that presents every frame of a timeline without the view framework
 * re-rendering anything. Each frame, every clip writes its own element; with `capture`, the stage
 * then waits for the browser to paint them and draws them, in DOM order, into itself, so the frame
 * can be read back. Given the app's `media` loader, it decodes the media its clips name, and plays
 * all their sound on one audio clock, scheduled from the timeline as it plays. A composition is a
 * picture, not a control, so it is hidden from assistive tech.
 *
 * @template E - Target Element type: any element, or a canvas for capture
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class VideoStageAria<
  E extends BaseElement = HTMLElement,
  T extends VideoStageProps = VideoStageProps,
  A extends VideoStageAttributes<E> = VideoStageAttributes<E>,
  O extends VideoStageOptions = VideoStageOptions,
> extends Aria<E, T, A, O> {
  /**
   * The clips on this stage, by their element.
   */
  protected clips = new Map<Element, VideoClipAria>();
  protected context?: CanvasRenderingContext2D | null;
  /** How many clips are still loading. */
  protected loading = 0;
  /** Where the stage's sound plays, made once something is to be heard. */
  protected audio?: AudioContext;
  /** Each clip's sound, to schedule while the timeline plays. */
  protected voices = new Map<VideoClipAria, AudioBuffer>();
  /** The sounds scheduled now, by the clip they belong to. */
  protected sounding: { clip: VideoClipAria; node: AudioBufferSourceNode }[] = [];
  /** When the sound now scheduled started: the audio clock's time, and the timeline frame then. */
  protected session?: { at: number; frame: number };

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);
    videoStageCtx.set(this as never);
    this.omittedAttrs.push('width', 'height');
    this.update();
  }

  /**
   * The timeline this stage presents.
   */
  public get timeline(): Timeline {
    return this.options.timeline;
  }

  /**
   * Whether the stage draws its clips into itself each frame.
   */
  public get capture(): boolean {
    return !!this.options.capture;
  }

  /**
   * How many frames before its segment starts a clip is put on stage, painted but unseen; none while capturing.
   */
  public get preroll(): number {
    return this.capture ? 0 : Math.round((this.options.preroll ?? VIDEO_PREROLL) * this.timeline.frameRate);
  }

  /**
   * Composition width in the stage's units.
   */
  public get width(): number {
    return this.properties.width ?? VIDEO_WIDTH;
  }

  /**
   * Composition height in the stage's units.
   */
  public get height(): number {
    return this.properties.height ?? VIDEO_HEIGHT;
  }

  /**
   * The canvas the stage draws into, while capturing.
   */
  public get canvas(): HTMLCanvasElement | undefined {
    return this.capture && this.element instanceof HTMLCanvasElement ? this.element : undefined;
  }

  /**
   * Settles once every clip on the stage has loaded its content: wait for it before playing or
   * rendering, so no frame shows a picture still loading. Marked `data-loading` until then.
   *
   * @returns The wait; settled at once when everything is loaded.
   */
  public ready(): Promise<void> {
    return Promise.allSettled(Array.from(this.clips.values(), (clip) => clip.loaded)).then(() => {});
  }

  /**
   * Puts a clip on the stage and presents the current frame on it.
   *
   * @param clip - The clip.
   * @param element - Its element, a direct child of the stage element.
   */
  public add(clip: VideoClipAria, element: Element): void {
    this.clips.set(element, clip);
    this.track(clip.loaded);
    clip.present(this.timeline.frame);
    if (this.capture) this.present(this.timeline.frame, new AbortController().signal);
  }

  /**
   * Takes a clip off the stage.
   *
   * @param element - The clip's element.
   */
  public remove(element: Element): void {
    this.clips.delete(element);
  }

  /**
   * Opens a clip's media with the app's loader.
   *
   * @param src - Where the media is.
   * @returns The media, or nothing without a loader or when it can't be read.
   */
  public open(src: string): Promise<VideoMedia | undefined> {
    return this.options.media ? this.options.media(src).catch(() => undefined) : Promise.resolve(undefined);
  }

  /**
   * Adds a clip's sound to what the stage plays: scheduled with the others on the stage's one
   * audio clock while the timeline plays, from where the timeline is.
   *
   * @param clip - The clip.
   * @param sound - Its decoded sound.
   */
  public listen(clip: VideoClipAria, sound: AudioBuffer): void {
    this.voices.set(clip, sound);
    if (this.session) this.voice(clip, sound);
  }

  /**
   * Takes a clip's sound out of what the stage plays, stopping it if it's sounding.
   *
   * @param clip - The clip.
   */
  public unlisten(clip: VideoClipAria): void {
    this.voices.delete(clip);
    for (const each of this.sounding.filter((entry) => entry.clip === clip)) each.node.stop();
    this.sounding = this.sounding.filter((entry) => entry.clip !== clip);
  }

  /**
   * Presents a frame: every clip writes its element for it, then, while capturing, the stage
   * waits for the browser to paint them and draws them into itself.
   *
   * @param frame - The timeline frame.
   * @param signal - Aborts once a later frame replaces this one.
   * @returns What to wait for before the frame is presented, if anything.
   */
  public present(frame: number, signal: AbortSignal): Promise<unknown> | undefined {
    const waits: unknown[] = [];
    for (const clip of this.clips.values()) {
      waits.push(clip.present(frame, signal));
    }

    const ready = settleAll(waits);
    if (!this.capture) return ready;

    return (async () => {
      await ready;
      if (signal.aborted) return;
      await document.fonts?.ready;
      await this.painted();
      if (!signal.aborted) this.composite();
    })();
  }

  /**
   * The current frame as a WebCodecs frame, read from the stage while capturing.
   *
   * @param timestamp - The frame's presentation time, in microseconds.
   * @param duration - How long it lasts, in microseconds.
   * @returns The frame; close it once encoded.
   */
  public grab(timestamp: number, duration?: number): VideoFrame {
    const canvas = this.canvas;
    if (!canvas) throw new Error('The stage can only be grabbed while capturing.');
    return new VideoFrame(canvas, { timestamp, duration });
  }

  /**
   * Compiles the stage attributes; a capturing canvas gets the composition's size as its pixels.
   *
   * @returns Stage attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      'aria-hidden': 'true',
      'data-video-stage': this.capture ? 'capture' : 'preview',
      ...(this.capture ? { width: this.width, height: this.height } : {}),
    }) as A;
  }

  /**
   * Lays the stage out at its composition size, keeps it scaled to fit its container, and presents
   * every frame of the timeline.
   *
   * @returns Detachment callback
   */
  protected override attach() {
    const element = this.element as HTMLElement | null;
    if (!element) return;

    if (this.capture) element.setAttribute('layoutsubtree', '');
    // Clips mount before their stage, so some may already be loading.
    if (this.loading) element.setAttribute('data-loading', '');
    element.style.setProperty('--aria-video-width', `${this.width}px`);
    element.style.setProperty('--aria-video-height', `${this.height}px`);

    const fit = () => {
      const box = element.parentElement?.getBoundingClientRect();
      if (!box?.width || !box.height) return;
      element.style.setProperty('--aria-video-scale', String(Math.min(box.width / this.width, box.height / this.height)));
    };
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : undefined;
    if (element.parentElement) resize?.observe(element.parentElement);
    fit();

    const unsubscribe = this.timeline.subscribe((state, signal) => {
      this.hear(state);
      return this.present(state.frame, signal);
    });

    return () => {
      unsubscribe();
      resize?.disconnect();
      this.silence();
      void this.audio?.close();
      this.audio = undefined;
      this.context = undefined;
    };
  }

  /**
   * Keeps the stage's sound with its timeline. Playing, every clip's sound is scheduled on the
   * audio clock from the frame the timeline is at, once, and again only when the two come apart —
   * a seek, a held frame — so the sound runs on undisturbed; paused, it stops. Capture is silent.
   */
  protected hear(state: FrameState): void {
    if (this.capture || !this.voices.size) return;
    if (state.status !== 'playing') return this.silence();

    this.audio ??= new AudioContext();
    // The clock stands still until a press lets the page play sound; until then, nothing is scheduled.
    if (this.audio.state !== 'running') {
      void this.audio.resume();
      return;
    }

    const frameRate = this.timeline.frameRate;
    if (this.session && Math.abs(this.heard() - state.frame) / frameRate <= SOUND_DRIFT) return;

    this.silence();
    this.session = { at: this.audio.currentTime, frame: state.frame };
    for (const [clip, sound] of this.voices) this.voice(clip, sound);
  }

  /**
   * The timeline frame the audio clock is at, by the sound now scheduled.
   */
  protected heard(): number {
    const { audio, session } = this;
    if (!audio || !session) return 0;
    return session.frame + (audio.currentTime - session.at) * this.timeline.frameRate * this.timeline.speed;
  }

  /**
   * Schedules one clip's sound for the rest of its segment, from the frame heard now: what's
   * started now is heard after the output's latency, so it starts that much further in.
   */
  protected voice(clip: VideoClipAria, sound: AudioBuffer): void {
    const audio = this.audio;
    const speed = this.timeline.speed;
    if (!audio || !this.session || speed <= 0) return;

    const frameRate = this.timeline.frameRate;
    const segment = clip.segment;
    const latency = (audio.outputLatency || audio.baseLatency || 0) * frameRate * speed;
    const heard = this.heard() + latency;
    const from = Math.max(heard, segment.startFrame);
    const to = segment.endFrame + 1;
    if (from >= to) return;

    const node = audio.createBufferSource();
    node.buffer = sound;
    node.playbackRate.value = speed;
    node.connect(audio.destination);
    const offset = (from - segment.startFrame + segment.offsetFrame) / frameRate + clip.offset;
    node.start(audio.currentTime + (from - heard) / frameRate / speed, offset, (to - from) / frameRate);
    const entry = { clip, node };
    node.onended = () => (this.sounding = this.sounding.filter((each) => each !== entry));
    this.sounding.push(entry);
  }

  /**
   * Stops every sound scheduled.
   */
  protected silence(): void {
    for (const { node } of this.sounding) node.stop();
    this.sounding = [];
    this.session = undefined;
  }

  /**
   * Marks the stage loading until a clip's content has loaded.
   */
  protected track(loaded: Promise<unknown>): void {
    this.loading++;
    this.element?.setAttribute('data-loading', '');
    loaded.finally(() => {
      this.loading--;
      if (!this.loading) this.element?.removeAttribute('data-loading');
    });
  }

  /**
   * Waits for the browser to paint the stage's clips, so drawing them shows them as they are now.
   */
  protected painted(): Promise<void> {
    const canvas = this.canvas;
    if (!canvas) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, PAINT_TIMEOUT);
      canvas.addEventListener(
        'paint',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      (canvas as HTMLCanvasElement & { requestPaint?: () => void }).requestPaint?.();
    });
  }

  /**
   * Draws every showing clip into the stage, in DOM order, moved by its own motion: media and
   * canvases as images, everything else as HTML.
   */
  protected composite(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    this.context ??= canvas.getContext('2d');
    const ctx = this.context as (CanvasRenderingContext2D & { drawElementImage?: (el: Element, x: number, y: number) => void }) | null;
    if (!ctx) return;

    ctx.reset();
    for (const element of canvas.children) {
      const clip = this.clips.get(element);
      if (!clip?.showing) continue;

      const { x = 0, y = 0, width = 0, height = 0, scale = 1, rotate = 0, opacity = 1 } = clip.motion;
      const cx = x + width / 2;
      const cy = y + height / 2;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(cx, cy);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);

      if (
        element instanceof HTMLVideoElement ||
        element instanceof HTMLCanvasElement ||
        element instanceof HTMLImageElement
      ) {
        ctx.drawImage(element, x, y, width, height);
      } else {
        ctx.drawElementImage?.(element, x, y);
      }
      ctx.restore();
    }
  }
}
