import type { AnyType } from '@airlib/core';
import { isSegmentOn, type MotionBox, sampleSegment, segmentTime, type TimelineSegment } from '@airlib/core/timeline';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { MEDIA_DRIFT, PAINTED_OPACITY, settleAll, VIDEO_CLIP, videoStageCtx } from './shared.js';

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
 * timeline plays. It loads its content as it mounts, goes on stage painted but unseen just before
 * its segment starts, and is ready once its images are decoded and its media shows the frame,
 * which an async timeline waits for.
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

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);
    this.omittedAttrs.push('offset');
    this.update();
  }

  /**
   * The segment this clip draws.
   */
  public get segment(): TimelineSegment {
    return this.options.segment;
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

    const on = isSegmentOn(this.segment, frame);
    this.showing = on;
    if (!on) {
      if (element instanceof HTMLMediaElement && !element.paused) element.pause();
      // Coming up soon: on stage at its first frame, painted but unseen, so it shows without a flicker.
      const ahead = this.segment.startFrame - frame;
      if (ahead > 0 && ahead <= (this.stage?.preroll ?? 0)) return this.prime(element);
      this.primed = false;
      this.reveal(element, false);
      return;
    }

    this.primed = false;
    this.reveal(element, true);
    const values = sampleSegment(this.segment, frame);
    const time = segmentTime(this.segment, frame);
    this.place(element, values);

    // Content first: what `draw` adds, e.g. an SVG image, is then waited for like the rest.
    const drawn = this.options.draw?.({ values, frame, time, element, signal });
    return settleAll([drawn, this.decode(element), this.follow(element, time, signal)]);
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
    this.loaded = this.preload(element);
    this.stage.add(this as never, element);
    return () => this.stage?.remove(element);
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

    const drawn = this.options.draw?.({ values, frame, time: 0, element, signal: new AbortController().signal });
    return settleAll([drawn, this.decode(element)]);
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
   * Keeps a media clip on the timeline: plays along while the timeline plays, correcting drift;
   * otherwise, and always while capturing, seeks to the frame and waits until the media shows it.
   */
  protected follow(element: HTMLElement, time: number, signal: AbortSignal): Promise<unknown> | undefined {
    if (!(element instanceof HTMLMediaElement)) return;

    const target = Math.max(0, time + (this.properties.offset ?? 0));
    const playing = this.stage?.timeline.status === 'playing' && !this.stage.capture;

    if (playing) {
      if (element.paused) element.play().catch(() => {});
      if (Math.abs(element.currentTime - target) > MEDIA_DRIFT) element.currentTime = target;
      return;
    }

    if (!element.paused) element.pause();
    const halfFrame = 0.5 / (this.stage?.timeline.frameRate ?? 30);
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
