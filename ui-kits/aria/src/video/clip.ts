import { type AnyType, effect } from '@airlib/core';
import { isSegmentOn, type MotionBox, sampleSegment, segmentTime, type TimelineSegment } from '@airlib/core/timeline';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import {
  MEDIA_CATCHUP,
  MEDIA_DRIFT,
  isSegmentOff,
  PAINTED_OPACITY,
  settleAll,
  VIDEO_CLIP,
  type VideoMedia,
  type VideoMediaFit,
  videoStageCtx,
} from './shared.js';

/**
 * One frame of a clip, handed to its `draw` so it can update its own content.
 */
export interface VideoClipFrame<P extends Record<string, AnyType> = Record<string, AnyType>> {
  /**
   * The clip's values at this frame, keyframes applied.
   */
  values: P;

  /**
   * The timeline frame.
   */
  frame: number;

  /**
   * Seconds into the clip's segment.
   */
  time: number;

  /**
   * The clip's element.
   */
  element: Element;

  /**
   * Aborts once a later frame replaces this one.
   */
  signal: AbortSignal;
}

/**
 * Reactive input properties for VideoClipAria.
 */
export interface VideoClipProps extends AriaProps {
  /**
   * Seconds into its media a media clip starts at (defaults to 0).
   */
  offset?: number;

  /**
   * Media the stage decodes for this clip, by address, with the stage's `media` loader: its
   * pictures drawn into the clip's canvas frame by frame, its sound played on the stage's clock.
   */
  media?: string;

  /** How the media's picture fills the clip's box (defaults to `cover`). */
  fit?: VideoMediaFit;

  /** Keeps the media's sound out of what the stage plays. */
  muted?: boolean;

  /** How loud the media's sound plays, from 0 for silent; 1, its own level, unless set. */
  volume?: number;

  /** Where the media's sound sits between the speakers, from -1 for left to 1 for right; 0, centred, unless set. */
  pan?: number;
}

/**
 * Static configuration for VideoClipAria.
 */
export interface VideoClipOptions<P extends Record<string, AnyType> = Record<string, AnyType>> extends AriaOptions {
  /**
   * The segment this clip draws.
   */
  segment: TimelineSegment<P>;

  /**
   * Updates the clip's own content for a frame, e.g. its words or a canvas painting, beyond the
   * motion the clip applies itself. A promise it returns holds the frame in an async timeline.
   */
  draw?: (frame: VideoClipFrame<P>) => unknown;
}

/**
 * Compiled attributes for a clip element.
 *
 * @template E - Target Element type
 */
export interface VideoClipAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  'data-video-clip': string;
}

/**
 * One clip of a video stage: an element that is a direct child of the stage, bound to one segment
 * on one of the timeline's tracks. Each frame it shows while its segment is on, places
 * itself by the segment's sampled motion — its box, growth, turn and opacity — and, for media,
 * follows the timeline: seeked to the frame while capturing or paused, playing along while the
 * timeline plays. Media the stage decodes, named by `media`, is exact instead: its picture for each
 * frame drawn into the clip's canvas, its sound played on the stage's clock, its length capping its
 * segment. It loads its content as it mounts, goes on stage painted but unseen just before its
 * segment starts, and is ready once its images are decoded and its media shows the frame, which an
 * async timeline waits for.
 *
 * @template E - Target Element type
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class VideoClipAria<
  E extends BaseElement = HTMLElement,
  T extends VideoClipProps = VideoClipProps,
  A extends VideoClipAttributes<E> = VideoClipAttributes<E>,
  O extends VideoClipOptions = VideoClipOptions,
> extends Aria<E, T, A, O> {
  protected stage = videoStageCtx.get();
  /** Each image's source and its decoding, so each picture is decoded once, however many frames ask. */
  protected decoded = new WeakMap<Element, { source: string; done: Promise<unknown>; settled: boolean }>();
  /** Whether the clip is on stage ahead of its segment, painted but unseen. */
  protected primed = false;
  /** While hidden: the element's own inline display, to put back when it shows. */
  protected display?: { value: string; priority: string };
  /** The media the stage decodes for this clip, once open. */
  protected source?: VideoMedia;

  /**
   * Whether the clip is on the stage at the frame last presented.
   */
  public showing = false;

  /**
   * Settles once the clip's content has loaded: its images decoded and its media ready to show a
   * frame. Loading starts as soon as the clip mounts, whether or not its segment is on yet.
   */
  public loaded: Promise<unknown> = Promise.resolve();

  /**
   * The clip's motion at the frame last presented, in the stage's units.
   */
  public motion: MotionBox = {};

  /** The clip's sound levels its keyframes set at the frame last presented, if they set any. */
  protected levels: { volume?: unknown; pan?: unknown } = {};

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);
    this.omittedAttrs.push('offset', 'media', 'fit', 'volume', 'pan');
    this.update();
  }

  /**
   * The segment this clip draws.
   */
  public get segment(): TimelineSegment {
    return this.options.segment;
  }

  /**
   * Where the clip stacks on the stage: its track's place among the timeline's tracks, so a later
   * track's clips sit over an earlier one's, whatever order the clips' elements are in.
   */
  public get layer(): number {
    return [...this.segment.timeline.tracks].indexOf(this.segment.track);
  }

  /**
   * Seconds into its media the clip starts at.
   */
  public get offset(): number {
    return this.properties.offset ?? 0;
  }

  /**
   * Whether the clip's sound is kept out of what the stage plays, read each time the stage
   * schedules it, so muting and unmuting take effect as the stage next starts its sound.
   */
  public get muted(): boolean {
    return !!this.properties.muted;
  }

  /**
   * How loud the clip's sound plays now: its segment's `volume` at the frame last presented — so
   * keyframes can fade it — else the clip's own; 1, its own level, unless set.
   */
  public get volume(): number {
    const { volume } = this.levels;
    return typeof volume === 'number' ? volume : (this.properties.volume ?? 1);
  }

  /**
   * Where the clip's sound sits between the speakers now: its segment's `pan` at the frame last
   * presented, else the clip's own; 0, centred, unless set.
   */
  public get pan(): number {
    const { pan } = this.levels;
    return typeof pan === 'number' ? pan : (this.properties.pan ?? 0);
  }

  /**
   * Presents a frame on the clip's element.
   *
   * @param frame - The timeline frame.
   * @param signal - Aborts once a later frame replaces this one.
   * @returns What to wait for before the clip shows this frame, if anything.
   */
  public present(frame: number, signal: AbortSignal = new AbortController().signal): Promise<unknown> | undefined {
    const element = this.element as HTMLElement | null;
    if (!element) return;

    // A hidden track's clips are off the stage throughout.
    const off = isSegmentOff(this.segment);
    const on = !off && isSegmentOn(this.segment, frame);
    this.showing = on;
    if (!on) {
      if (element instanceof HTMLMediaElement && !element.paused) element.pause();
      // Coming up soon: on stage at its first frame, painted but unseen, so it shows without a flicker.
      const ahead = this.segment.startFrame - frame;
      if (!off && ahead > 0 && ahead <= (this.stage?.preroll ?? 0)) return this.prime(element);
      this.primed = false;
      this.reveal(element, false);
      return;
    }

    this.primed = false;
    this.reveal(element, true);
    const values = sampleSegment(this.segment, frame);
    const time = segmentTime(this.segment, frame);
    this.place(element, values);
    // Its sound follows the levels at this frame, so keyframed volume and balance play out.
    this.levels = { volume: values.volume, pan: values.pan };
    this.stage?.tune(this as never);

    // Content first: what `draw` adds, e.g. an SVG image, is then waited for like the rest.
    const drawn = this.options.draw?.({ values, frame, time, element, signal });
    return settleAll([drawn, this.decode(element), this.follow(element, time, signal), this.paint(element, time, signal)]);
  }

  /**
   * Compiles the clip attributes: its segment's kind.
   *
   * @returns Clip attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      'data-video-clip': this.segment?.type ?? VIDEO_CLIP,
    }) as A;
  }

  /**
   * Puts the clip on its stage while its element is mounted, and starts loading its content.
   *
   * @returns Detachment callback
   */
  protected override attach() {
    const element = this.element as HTMLElement | null;
    if (!element || !this.stage) return;
    this.loaded = Promise.allSettled([this.preload(element), this.open(element)]);
    this.stage.add(this as never, element);
    // A change to the clip's volume or balance reaches its sound at once, while it's sounding.
    const stopTuning = effect.client(() => {
      void this.volume;
      void this.pan;
      this.stage?.tune(this as never);
    });
    return () => {
      stopTuning();
      this.stage?.unlisten(this as never);
      this.stage?.remove(element);
      this.source?.dispose?.();
      this.source = undefined;
    };
  }

  /**
   * Opens the clip's media through the stage, when it names some: tells its segment how long the
   * media runs, which caps how far it can be trimmed out, hands its sound to the stage — muted or
   * not, which the stage reads as it plays — and paints its first picture, so the clip shows it
   * before it plays.
   */
  protected async open(element: HTMLElement): Promise<unknown> {
    const src = this.properties.media;
    if (!src || !this.stage) return;
    const source = await this.stage.open(src);
    if (!source || !this.element) return source?.dispose?.();
    this.source = source;

    const frames = Math.round(source.duration * this.segment.timeline.frameRate);
    if (frames > 0 && this.segment.contentFrames !== frames) this.segment.contentFrames = frames;

    const sound = await source.sound?.();
    if (sound && this.source === source) this.stage.listen(this as never, sound);
    return this.paint(element, segmentTime(this.segment, this.segment.startFrame), new AbortController().signal);
  }

  /**
   * Draws the media's picture at a moment into the clip's canvas, sized to the clip's box and
   * filling it as `fit` says. A newer frame aborting this one leaves the canvas to it.
   */
  protected async paint(element: HTMLElement, time: number, signal: AbortSignal): Promise<unknown> {
    const source = this.source;
    if (!source?.frame || !(element instanceof HTMLCanvasElement)) return;
    const picture = await source.frame(time + this.offset, signal);
    if (!picture || signal.aborted) return;

    // The box as last placed, or, before the clip has been, as its segment sets it.
    const box = this.motion.width ? this.motion : (this.segment.props as MotionBox);
    const width = Math.round(box.width ?? 0);
    const height = Math.round(box.height ?? 0);
    if (!width || !height) return;
    if (element.width !== width) element.width = width;
    if (element.height !== height) element.height = height;
    const context = element.getContext('2d');
    if (!context) return;

    const [sourceWidth, sourceHeight] = sizeOf(picture);
    const scale = (this.properties.fit === 'contain' ? Math.min : Math.max)(width / sourceWidth, height / sourceHeight);
    const drawnWidth = sourceWidth * scale;
    const drawnHeight = sourceHeight * scale;
    context.clearRect(0, 0, width, height);
    context.drawImage(picture, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
  }

  /**
   * Puts the clip on stage ahead of its segment, once: placed and drawn at its first frame, its
   * media at its start and paused, and kept just above transparent, so the browser paints its
   * pictures before the clip is seen.
   */
  protected prime(element: HTMLElement): Promise<unknown> | undefined {
    if (this.primed) return;
    this.primed = true;

    const frame = this.segment.startFrame;
    const values = sampleSegment(this.segment, frame);
    this.reveal(element, true);
    this.place(element, values, true);
    if (element instanceof HTMLMediaElement) {
      element.pause();
      element.currentTime = this.properties.offset ?? 0;
    }

    const signal = new AbortController().signal;
    const drawn = this.options.draw?.({ values, frame, time: 0, element, signal });
    return settleAll([drawn, this.decode(element), this.paint(element, segmentTime(this.segment, frame), signal)]);
  }

  /**
   * Loads the clip's content before it is needed: draws its first frame, so content `draw` adds —
   * an SVG image, say — exists, then waits for its images to decode and its media to have a frame.
   */
  protected preload(element: HTMLElement): Promise<unknown> {
    const frame = this.segment.startFrame;
    const drawn = this.options.draw?.({
      values: sampleSegment(this.segment, frame),
      frame,
      time: 0,
      element,
      signal: new AbortController().signal,
    });
    return Promise.allSettled([drawn, this.decode(element), mediaReady(element)]);
  }

  /**
   * Shows or hides the clip's element. Hiding writes `display: none !important` inline, since the
   * clip's own styles may set a display that would beat `hidden`, and keeps that display to put
   * back when it shows again. Works the same for HTML and SVG.
   */
  protected reveal(element: HTMLElement | SVGElement, on: boolean): void {
    const style = element.style;
    const hidden = this.display !== undefined;
    if (on === !hidden) return;

    if (on) {
      style.setProperty('display', this.display?.value ?? '', this.display?.priority);
      if (!this.display?.value) style.removeProperty('display');
      this.display = undefined;
      return;
    }
    this.display = { value: style.getPropertyValue('display'), priority: style.getPropertyPriority('display') };
    style.setProperty('display', 'none', 'important');
  }

  /**
   * Writes the clip's motion onto its element: its box in the stage's units, and its growth, turn
   * and opacity about the box's centre. While capturing, the element keeps only its box: the stage
   * applies the rest while drawing, since drawing ignores the element's transform, would apply its
   * opacity a second time, and misses opacity changes on elements with a backdrop filter. In a
   * preview a clip is never fully transparent, so the browser keeps painting it; `unseen` holds it
   * there, for a clip on stage ahead of its segment.
   */
  protected place(element: HTMLElement | SVGElement, values: MotionBox, unseen = false): void {
    const { x = 0, y = 0, width, height, scale = 1, rotate = 0, opacity = 1 } = values;
    // Without a box of its own, a clip is as big as it lays out, in the stage's units.
    const html = element instanceof HTMLElement ? element : undefined;
    this.motion = {
      x,
      y,
      width: width ?? html?.offsetWidth ?? 0,
      height: height ?? html?.offsetHeight ?? 0,
      scale,
      rotate,
      opacity,
    };

    const style = element.style;
    style.position = 'absolute';
    style.zIndex = String(this.layer);
    style.left = `${x}px`;
    style.top = `${y}px`;
    if (width !== undefined) style.width = `${width}px`;
    if (height !== undefined) style.height = `${height}px`;

    const moved = !this.stage?.capture;
    const shown = unseen ? PAINTED_OPACITY : Math.max(opacity, PAINTED_OPACITY);
    style.transform = moved && (scale !== 1 || rotate !== 0) ? `rotate(${rotate}deg) scale(${scale})` : '';
    style.opacity = moved && shown !== 1 ? String(shown) : '';
  }

  /**
   * Waits for the clip's images that haven't decoded their current picture yet — new ones, or
   * ones whose source changed — so no frame shows a picture still loading.
   */
  protected decode(element: HTMLElement): Promise<unknown> | undefined {
    const images = [
      ...(element instanceof HTMLImageElement ? [element] : []),
      ...Array.from(element.querySelectorAll<HTMLImageElement | SVGImageElement>('img, image')),
    ];
    const waits: Promise<unknown>[] = [];
    for (const image of images) {
      const source = imageSource(image);
      let entry = this.decoded.get(image);
      if (entry?.source !== source) {
        const decoding = { source, done: Promise.resolve(), settled: false };
        decoding.done = Promise.resolve(image.decode?.())
          .catch(() => {})
          .finally(() => (decoding.settled = true));
        entry = decoding;
        this.decoded.set(image, entry);
      }
      if (!entry.settled) waits.push(entry.done);
    }
    return waits.length ? Promise.allSettled(waits) : undefined;
  }

  /**
   * Keeps a media clip on the timeline: plays along while the timeline plays — catching up on a
   * small drift, such as the moment media takes to start, by playing a touch faster or slower,
   * since a seek would show as a jump, and seeking only once it has drifted far — otherwise, and
   * always while capturing, seeks to the frame and waits until the media shows it.
   */
  protected follow(element: HTMLElement, time: number, signal: AbortSignal): Promise<unknown> | undefined {
    if (!(element instanceof HTMLMediaElement)) return;

    const target = Math.max(0, time + (this.properties.offset ?? 0));
    const playing = this.stage?.timeline.status === 'playing' && !this.stage.capture;
    const halfFrame = 0.5 / (this.stage?.timeline.frameRate ?? 30);

    if (playing) {
      if (element.paused) element.play().catch(() => {});
      const drift = target - element.currentTime;
      if (Math.abs(drift) <= halfFrame) element.playbackRate = 1;
      else if (Math.abs(drift) <= MEDIA_DRIFT) {
        element.playbackRate = 1 + Math.max(-MEDIA_CATCHUP, Math.min(MEDIA_CATCHUP, drift));
      } else if (!element.seeking) {
        element.playbackRate = 1;
        element.currentTime = target;
      }
      return;
    }

    if (!element.paused) element.pause();
    element.playbackRate = 1;
    if (Math.abs(element.currentTime - target) <= halfFrame && element.readyState >= 2) return;

    return new Promise<void>((resolve) => {
      const done = () => {
        signal.removeEventListener('abort', done);
        resolve();
      };
      signal.addEventListener('abort', done, { once: true });
      if (element instanceof HTMLVideoElement && 'requestVideoFrameCallback' in element) {
        element.requestVideoFrameCallback(() => done());
      } else {
        element.addEventListener('seeked', done, { once: true });
      }
      element.currentTime = target;
    });
  }
}

/**
 * The picture an image shows now: an HTML image's chosen source, an SVG image's `href`.
 *
 * @param image - The image.
 * @returns Its source, or an empty string when it has none.
 */
function imageSource(image: HTMLImageElement | SVGImageElement): string {
  return image instanceof HTMLImageElement ? image.currentSrc || image.src : (image.getAttribute('href') ?? '');
}

/**
 * A picture's own size, in pixels, whatever kind of picture it is.
 *
 * @param picture - The picture.
 * @returns Its width and height.
 */
function sizeOf(picture: CanvasImageSource): [width: number, height: number] {
  if (picture instanceof HTMLVideoElement) return [picture.videoWidth, picture.videoHeight];
  if (picture instanceof HTMLImageElement) return [picture.naturalWidth, picture.naturalHeight];
  if (typeof VideoFrame !== 'undefined' && picture instanceof VideoFrame) return [picture.displayWidth, picture.displayHeight];
  if (picture instanceof SVGImageElement) return [picture.width.baseVal.value, picture.height.baseVal.value];
  return [(picture as HTMLCanvasElement).width, (picture as HTMLCanvasElement).height];
}

/**
 * Settles once a media clip has a frame to show, or at once for anything else, or media without a source.
 *
 * @param element - The clip's element.
 * @returns The wait, if any.
 */
function mediaReady(element: Element): Promise<void> | undefined {
  if (!(element instanceof HTMLMediaElement) || !element.src || element.readyState >= 2) return;
  return new Promise((resolve) => {
    const done = () => {
      element.removeEventListener('loadeddata', done);
      element.removeEventListener('error', done);
      resolve();
    };
    element.addEventListener('loadeddata', done);
    element.addEventListener('error', done);
  });
}
