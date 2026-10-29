import { anchor } from '../engine/anchor.js';
import { assign } from '../engine/helper.js';
import { $static, mutable, passive } from '../reactive/index.js';
import type { AnyType } from '../types.js';
import { uuid } from '../utils/uuid.js';
import { animationFrame, cancelFrame, dropNode, type FrameId, frameToTime, isThenable, timeToFrame } from './helper.js';
import { TimelineMarker, type TimelineMarkerInit, type TimelineMarkerSnapshot } from './marker.js';
import { TimelineTrack, type TimelineTrackOptions, type TimelineTrackSnapshot } from './track.js';

export type FrameState = {
  time: number;
  frame: number;
  status: 'idle' | 'playing';
  totalTime: number;
  totalFrames: number;
};

/**
 * The master timeline's state: the frame state, plus the last frame every handler finished with.
 * Without async ticking `presented` follows `frame` at once; with it, `presented` trails `frame`
 * while handlers are still working on it.
 */
export type TimelineState = FrameState & {
  presented: number;
};

/**
 * Whether each frame waits for what its handlers return. `false` follows the clock alone, so heavy
 * handlers drop frames. `true` holds every frame until all its handlers settle, so time stretches
 * and no frame is skipped, e.g. to export. `{ tolerance }` waits at most that many milliseconds per
 * frame, then aborts it and follows the clock again, e.g. for a live preview with heavy layers.
 */
export type TimelineAsync = boolean | { tolerance: number };

export type TimelineOptions = {
  repeat?: boolean | number;
  frameRate: number;
  startFrame?: number;
  endFrame?: number;
  speed?: number;
  async?: TimelineAsync;
};

/**
 * Initialization options for creating a master timeline coordinator.
 * Accepts `startTime` and `endTime` in addition to `startFrame` and `endFrame`.
 */
export type TimelineInit = Omit<Partial<TimelineOptions>, 'startFrame' | 'endFrame'> & {
  startFrame?: number;
  startTime?: number;
  endFrame?: number;
  endTime?: number;
  /**
   * The storage to act on in place — its options, props, tracks and markers, in the snapshot's
   * shape — such as a document's composition: every edit lands in it. The other options are then
   * read from it. Without it, the timeline makes its own storage from the other options and owns it.
   */
  source?: TimelineSnapshot;
};

/**
 * Receives each clock update. In an async timeline, a promise it returns holds the frame until it
 * settles; the signal aborts once a later frame replaces this one or it runs past its tolerance.
 */
export type TimelineSubscriber = (state: FrameState, signal: AbortSignal) => unknown;

/**
 * Receives a handler's failure while a frame was being delivered, and the frame it happened on.
 * The frame still counts as finished, so one failing handler never stalls the timeline.
 */
export type TimelineErrorListener = (error: unknown, frame: number) => void;

/**
 * One frame on its way to every handler: the signal that aborts it, and what the handlers
 * returned, so an async timeline can wait for it.
 */
export type TimelineDelivery = {
  signal: AbortSignal;
  pending: unknown[];
};

const RESOLVED = Promise.resolve();

/** The marker type that makes a marker a page: where a presentation holds. */
const PAGE_MARKER = 'page';

export type TimelineSnapshot = {
  id: string;
  options: TimelineOptions;
  props?: Record<string, AnyType>;
  tracks: TimelineTrackSnapshot[];
  markers?: TimelineMarkerSnapshot[];
};

/**
 * Real-time master timeline controller driven by requestAnimationFrame. Its tracks, segments, scenes
 * and markers are kept in one storage, `source`, in the snapshot's shape: one it was given and acts
 * on in place, or one it made itself. Only its playback state is its own.
 */
export class Timeline<P extends Record<string, AnyType> = Record<string, AnyType>> {
  /**
   * The timeline's storage, reactive throughout: its identity, options, props, and every track,
   * segment, scene and marker, each instance acting on its own branch of it.
   */
  public readonly source!: TimelineSnapshot;

  /**
   * Unique identifier for this timeline instance.
   */
  public get id(): string {
    return this.source.id;
  }

  public set id(value: string) {
    this.source.id = value;
  }

  /**
   * Reactive consumer-owned data slot (e.g. composition-wide defaults such as base CSS properties).
   * The timeline never reads or writes it; it only persists it through snapshot and hydrate.
   */
  public get props(): P {
    return this.source.props as P;
  }

  public set props(value: P) {
    this.source.props = value;
  }

  /**
   * Reactive playback and timing state of the master timeline.
   */
  public state = mutable<TimelineState>({
    time: 0,
    frame: 0,
    presented: 0,
    status: 'idle',
    totalTime: 0,
    totalFrames: 0,
  });

  /**
   * Collection of synchronized child tracks driven by this master timeline clock.
   */
  public tracks = mutable(new Set<TimelineTrack>(), { recursive: false });

  /**
   * Collection of cue point markers registered on this master timeline.
   */
  public markers = mutable(new Set<TimelineMarker>(), { recursive: false });

  /**
   * Creates a real-time master timeline coordinator: over the storage it's given, its tracks and
   * markers made from what's there, or over storage of its own made from the options.
   *
   * @param {TimelineInit} [options] - Initial configuration (framerate, speed, bounds, repeat), or the storage to act on.
   * @param {P} [props] - Consumer-owned data slot, for storage of its own.
   */
  constructor(options: TimelineInit = {}, props: P = {} as P) {
    if (options.source) {
      const source = options.source;
      this.source = (anchor.has(source) ? source : mutable(source)) as TimelineSnapshot;
      // Making the instances over the storage is the timeline's own work, as its passive methods are.
      $static(() => {
        this.source.id ??= uuid();
        this.source.options.frameRate ??= 30;
        this.source.props ??= {};
        this.source.tracks ??= [];
        this.source.markers ??= [];
        for (const node of [...this.source.tracks]) new TimelineTrack(this, undefined, undefined, node);
        for (const node of [...this.source.markers]) new TimelineMarker(this, undefined, node);
      });
      this.refresh();
      return;
    }

    const frameRate = Math.max(1, options.frameRate ?? 30);
    const startFrame =
      options.startFrame !== undefined
        ? Math.max(0, Math.round(options.startFrame))
        : options.startTime !== undefined
          ? timeToFrame(options.startTime, frameRate)
          : undefined;
    const endFrame =
      options.endFrame !== undefined
        ? Math.max(0, Math.round(options.endFrame))
        : options.endTime !== undefined
          ? timeToFrame(options.endTime, frameRate)
          : undefined;

    const { startTime, endTime, source, ...rest } = options;
    this.source = mutable<TimelineSnapshot>({
      id: uuid(),
      options: { frameRate, speed: 1, ...rest, startFrame, endFrame },
      props: { ...props },
      tracks: [],
      markers: [],
    });
    this.refresh();
  }

  /**
   * Target playback frame rate in frames per second.
   */
  public get frameRate(): number {
    return this.options.frameRate;
  }

  public set frameRate(value: number) {
    const prevRate = this.options.frameRate;
    const nextRate = Math.max(1, Math.round(value));
    if (prevRate === nextRate) return;

    this.options.frameRate = nextRate;
    this.state.frame = Math.round((this.state.frame / prevRate) * nextRate);
    this.state.time = frameToTime(this.state.frame, nextRate);

    if (this.options.startFrame !== undefined) {
      this.options.startFrame = Math.round((this.options.startFrame / prevRate) * nextRate);
    }
    if (this.options.endFrame !== undefined) {
      this.options.endFrame = Math.round((this.options.endFrame / prevRate) * nextRate);
    }

    for (const track of this.tracks) {
      for (const segment of track.segments) {
        segment.refresh(false);
      }
    }

    for (const marker of this.markers) {
      marker.atFrame = Math.round((marker.atFrame / prevRate) * nextRate);
    }

    this.refresh();

    if (this.state.status === 'playing') {
      this.play(this.state.frame);
    }
  }

  /**
   * Repetition behavior: `true` for continuous loop, a positive integer for fixed repeat count, or `undefined`/`false` for single play.
   */
  public get repeat(): boolean | number | undefined {
    return this.options.repeat;
  }

  public set repeat(value: boolean | number | undefined) {
    this.options.repeat = value;
  }

  /**
   * Minimum frame boundary for playback and looping.
   */
  public get startFrame(): number | undefined {
    return this.options.startFrame;
  }

  public set startFrame(value: number | undefined) {
    this.options.startFrame = value;
    this.refresh();
  }

  /**
   * Maximum frame boundary for playback and looping.
   */
  public get endFrame(): number | undefined {
    return this.options.endFrame;
  }

  public set endFrame(value: number | undefined) {
    this.options.endFrame = value;
    this.refresh();
  }

  /**
   * Minimum time boundary in seconds for playback and looping, derived from startFrame.
   */
  public get startTime(): number | undefined {
    return this.options.startFrame !== undefined ? frameToTime(this.options.startFrame, this.frameRate) : undefined;
  }

  public set startTime(value: number | undefined) {
    this.startFrame = value !== undefined ? timeToFrame(value, this.frameRate) : undefined;
  }

  /**
   * Maximum time boundary in seconds for playback and looping, derived from endFrame.
   */
  public get endTime(): number | undefined {
    return this.options.endFrame !== undefined ? frameToTime(this.options.endFrame, this.frameRate) : undefined;
  }

  public set endTime(value: number | undefined) {
    this.endFrame = value !== undefined ? timeToFrame(value, this.frameRate) : undefined;
  }

  /**
   * Global playback speed multiplier scaling real-time frame advancement.
   */
  public get speed(): number {
    return this.options.speed ?? 1;
  }

  public set speed(value: number) {
    this.options.speed = Math.max(0, value);
    if (this.state.status === 'playing') {
      this.play(this.state.frame);
    }
  }

  /**
   * Whether each frame waits for what its handlers return; see {@link TimelineAsync}.
   */
  public get async(): TimelineAsync {
    return this.options.async ?? false;
  }

  public set async(value: TimelineAsync) {
    this.options.async = value;
  }

  /**
   * The last frame every handler finished with. Equal to `frame` unless async ticking is on and
   * handlers are still working on the current frame.
   */
  public get presented(): number {
    return this.state.presented;
  }

  /**
   * Current master timeline position in seconds.
   */
  public get time(): number {
    return this.state.time;
  }

  public set time(value: number) {
    this.seek(value);
  }

  /**
   * Current discrete integer frame index of the master playhead.
   */
  public get frame(): number {
    return this.state.frame;
  }

  public set frame(value: number) {
    this.scrub(value);
  }

  /**
   * Global playback status: 'playing' when actively ticking, otherwise 'idle'.
   */
  public get status(): 'idle' | 'playing' {
    return this.state.status;
  }

  /**
   * Aggregated composition duration in seconds across all registered tracks and limits.
   */
  public get totalTime(): number {
    return this.state.totalTime;
  }

  /**
   * Aggregated composition frame count across all registered tracks and limits.
   */
  public get totalFrames(): number {
    return this.state.totalFrames;
  }

  /**
   * Subscribes a listener to timeline clock updates.
   *
   * @param {TimelineSubscriber} subscriber - Callback receiving current timeline state.
   * @returns {() => void} Teardown function to unsubscribe.
   */
  public subscribe(subscriber: TimelineSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  /**
   * Listens for handlers failing while a frame is delivered. Without a listener, failures go to
   * `console.error`.
   *
   * @param {TimelineErrorListener} listener - Callback receiving the failure and its frame.
   * @returns {() => void} Teardown function to stop listening.
   */
  public onError(listener: TimelineErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Adds a track to the timeline.
   *
   * @param {Partial<TimelineTrackOptions>} [options] - Track configuration options.
   * @param {TP} [props] - Consumer-owned data slot for the track.
   * @returns {TimelineTrack<TP>} The instantiated track.
   */
  public addTrack<TP extends Record<string, AnyType> = Record<string, AnyType>>(
    options: Partial<TimelineTrackOptions> = {},
    props?: TP
  ): TimelineTrack<TP> {
    return this.createTrack(options, props) as TimelineTrack<TP>;
  }

  /**
   * Removes a track from the timeline.
   *
   * @param {TimelineTrack} track - Track instance to remove.
   */
  @passive
  public removeTrack(track: TimelineTrack): void {
    if (this.tracks.delete(track)) {
      dropNode(this.source.tracks, track.id);
      track.destroy();
      this.refresh();
    }
  }

  /**
   * Puts the tracks in a new order, which is the order they stack and are kept in: a later track
   * draws over an earlier one.
   *
   * @param {TimelineTrack[]} order - The timeline's tracks in their new order.
   */
  @passive
  public orderTracks(order: TimelineTrack[]): void {
    const tracks = order.filter((track) => this.tracks.has(track));
    this.tracks.clear();
    for (const track of tracks) this.tracks.add(track);
    this.source.tracks.splice(0, this.source.tracks.length, ...tracks.map((track) => track.source));
    this.refresh();
  }

  /**
   * Adds a cue point marker to the timeline.
   *
   * @param {TimelineMarkerInit} [options] - Marker configuration options.
   * @returns {TimelineMarker} The instantiated marker.
   */
  @passive
  public addMarker(options: TimelineMarkerInit = {}): TimelineMarker {
    return new TimelineMarker(this, options);
  }

  /**
   * Removes a marker from the timeline.
   *
   * @param {TimelineMarker} marker - Marker instance to remove.
   */
  @passive
  public removeMarker(marker: TimelineMarker): void {
    if (this.markers.delete(marker)) dropNode(this.source.markers, marker.id);
  }

  /**
   * Starts or resumes timeline playback.
   *
   * @param {number} [startFrame] - Frame to start from. Defaults to current frame, or 0 if playback previously finished.
   * @returns {() => void} Teardown function to pause playback.
   */
  @passive
  public play(startFrame?: number): () => void {
    if (this.state.status === 'playing' && startFrame === undefined) {
      return () => this.pause();
    }

    this.cancel();

    const loop = this.loop;
    const minFrame = this.minFrame;
    const maxFrame = this.maxFrame;
    const isEnded = this.state.frame >= maxFrame;

    if (this.state.status !== 'playing' && (isEnded || startFrame !== undefined)) {
      this.iteration = 0;
    }

    let currentFrame = startFrame ?? (isEnded || this.state.frame < minFrame ? minFrame : this.state.frame);
    let currentTime = frameToTime(currentFrame, this.options.frameRate);

    if (currentFrame >= maxFrame) {
      assign(this.state, {
        frame: maxFrame,
        time: frameToTime(maxFrame, this.options.frameRate),
        status: 'idle',
      });
      this.notify();
      return () => this.pause();
    }

    assign(this.state, { frame: currentFrame, time: currentTime, status: 'playing' });
    const started = this.notify();

    let startTimestamp = performance.now();
    const jitterMargin = (1000 / this.options.frameRate) * 0.15;
    const frameAt = (now: number) =>
      currentFrame + Math.floor(((now - startTimestamp + jitterMargin) / 1000) * this.speed * this.options.frameRate);

    // The frame a held frame's wait ended on, so the next tick continues right after it.
    let resume: number | undefined;

    // Schedules the next tick once the frame just delivered allows it. Without async ticking that is
    // at once. With it, the frame's handlers settle first; when they must all finish (`async: true`),
    // the next tick continues from that frame, so the wait stretches time instead of skipping frames.
    const schedule = (delivered: Promise<void>, frame: number) => {
      if (!this.options.async) {
        this.frameId = animationFrame(tick, this.options.frameRate);
        return;
      }

      delivered.then(() => {
        if (loop !== this.loop || this.state.status !== 'playing') return;
        if (this.options.async === true) resume = frame;
        this.frameId = animationFrame(tick, this.options.frameRate);
      });
    };

    const tick = (now: number) => {
      if (this.state.status !== 'playing' || loop !== this.loop) return;

      if (resume !== undefined) {
        if (this.speed > 0 && frameAt(now) > resume + 1) {
          currentFrame = resume;
          startTimestamp = now - 1000 / (this.speed * this.options.frameRate);
        }
        resume = undefined;
      }

      const targetFrame = frameAt(now);
      const maxFrame = this.maxFrame;

      // Playing a page holds at its marker, and settles whoever asked for it there.
      if (this.hold && targetFrame >= this.hold.frame) {
        const { frame, resolve } = this.hold;
        this.hold = undefined;
        assign(this.state, { frame, time: frameToTime(frame, this.options.frameRate), status: 'idle' });
        void this.notify().then(resolve);
        this.frameId = undefined;
        return;
      }

      if (targetFrame >= maxFrame) {
        const repeat = this.options.repeat;
        const canRepeat =
          maxFrame > minFrame && (repeat === true || (typeof repeat === 'number' && this.iteration < repeat));

        if (canRepeat) {
          this.iteration++;
          startTimestamp = now;
          currentFrame = minFrame;
          currentTime = frameToTime(minFrame, this.options.frameRate);
          assign(this.state, { frame: minFrame, time: currentTime });
          schedule(this.notify(), minFrame);
          return;
        } else {
          assign(this.state, { frame: maxFrame, time: frameToTime(maxFrame, this.options.frameRate), status: 'idle' });
          this.notify();
          this.frameId = undefined;
          return;
        }
      }

      if (targetFrame !== this.state.frame) {
        const time = frameToTime(targetFrame, this.options.frameRate);
        assign(this.state, { frame: targetFrame, time });
        schedule(this.notify(), targetFrame);
        return;
      }

      this.frameId = animationFrame(tick, this.options.frameRate);
    };

    schedule(started, currentFrame);

    return () => this.pause();
  }

  /**
   * Pauses timeline playback at the current frame.
   */
  @passive
  public pause(): void {
    this.cancel();
    assign(this.state, { status: 'idle' });
    this.notify();
  }

  /**
   * Stops timeline playback and resets frame and time to 0.
   */
  @passive
  public stop(): void {
    this.cancel();
    this.iteration = 0;
    const minFrame = this.minFrame;
    assign(this.state, {
      time: frameToTime(minFrame, this.options.frameRate),
      frame: minFrame,
      status: 'idle',
    });
    this.notify();
  }

  /**
   * Seeks timeline to a specific position in seconds.
   *
   * @param {number} time - Target position in seconds.
   * @returns {Promise<void>} Settles once that frame's handlers are done, or a later frame replaces it.
   */
  @passive
  public seek(time: number): Promise<void> {
    return this.scrub(timeToFrame(time, this.options.frameRate));
  }

  /**
   * Scrubs timeline to a specific frame number.
   *
   * @param {number} frame - Target frame number.
   * @returns {Promise<void>} Settles once that frame's handlers are done, or a later frame replaces it.
   */
  @passive
  public scrub(frame: number): Promise<void> {
    const frameRate = this.options.frameRate;
    const clampedFrame = Math.min(Math.max(this.minFrame, Math.round(frame)), this.maxFrame);

    if (this.state.status === 'playing') {
      this.play(clampedFrame);
      return this.delivered;
    }

    const time = frameToTime(clampedFrame, frameRate);
    assign(this.state, { frame: clampedFrame, time });
    return this.notify();
  }

  /**
   * Advances or rewinds the timeline by a relative frame offset.
   *
   * @param {number} [delta=1] - Number of frames to advance (negative to rewind).
   * @returns {Promise<void>} Settles once that frame's handlers are done, or a later frame replaces it.
   */
  @passive
  public step(delta = 1): Promise<void> {
    return this.scrub(this.state.frame + delta);
  }

  /**
   * Advances playback to the next landmark (track boundary).
   *
   * @returns {Promise<void>} Settles once that frame's handlers are done; at once when there is no later landmark.
   */
  @passive
  public next(): Promise<void> {
    const current = this.state.frame;
    const landmarks = this.getLandmarks();

    for (const frame of landmarks) {
      if (frame > current) {
        return this.scrub(frame);
      }
    }
    return RESOLVED;
  }

  /**
   * Rewinds playback to the previous landmark (track boundary).
   *
   * @returns {Promise<void>} Settles once that frame's handlers are done; at once when there is no earlier landmark.
   */
  @passive
  public prev(): Promise<void> {
    const current = this.state.frame;
    const landmarks = this.getLandmarks();

    for (let i = landmarks.length - 1; i >= 0; i--) {
      const frame = landmarks[i];
      if (frame < current) {
        return this.scrub(frame);
      }
    }
    return RESOLVED;
  }

  /**
   * The timeline's pages, in time order: its markers of type `page`. A page runs from the page
   * before it, or the start, to its own marker, where a presentation holds — so one timeline plays
   * through as a video, or a page at a time.
   */
  public get pages(): TimelineMarker[] {
    return [...this.markers].filter((marker) => marker.type === PAGE_MARKER).sort((a, b) => a.atFrame - b.atFrame);
  }

  /**
   * The page the playhead is on: the last one whose marker it has reached; -1 before the first.
   */
  public get page(): number {
    const frame = this.state.frame;
    return this.pages.reduce((at, page, index) => (page.atFrame <= frame ? index : at), -1);
  }

  /**
   * Plays a page: from the page before it, or the start, to its own marker, and holds there.
   *
   * @param {number} page - The page, by its place in `pages`.
   * @returns {Promise<void>} Settles once the playhead holds at the page, or once playback is moved or stopped first.
   */
  @passive
  public goto(page: number): Promise<void> {
    const pages = this.pages;
    if (!pages[page]) return RESOLVED;

    const from = page > 0 ? pages[page - 1].atFrame : this.minFrame;
    const to = Math.min(pages[page].atFrame, this.maxFrame);
    if (to <= from) return this.scrub(to);

    return new Promise((resolve) => {
      this.play(from);
      this.hold = { frame: to, resolve };
    });
  }

  /**
   * Plays the next page, from the page the playhead is on to the next one's marker. While a page
   * is still playing, goes straight to its end instead, as a presentation skips its animation.
   *
   * @returns {Promise<void>} Settles once the playhead holds at the page; at once when there is no later page.
   */
  @passive
  public nextPage(): Promise<void> {
    if (this.hold) {
      const { frame } = this.hold;
      this.pause();
      return this.scrub(frame);
    }
    return this.goto(this.page + 1);
  }

  /**
   * Plays the previous page, from the page before it, or the start, to its marker.
   *
   * @returns {Promise<void>} Settles once the playhead holds at the page; at once when there is no earlier page.
   */
  @passive
  public prevPage(): Promise<void> {
    const page = this.page;
    return page > 0 ? this.goto(page - 1) : RESOLVED;
  }

  /**
   * Gathers all critical snap boundaries (timeline bounds, segment edges, keyframes, markers).
   *
   * @returns {number[]} Sorted list of unique frame landmarks.
   */
  @passive
  public getLandmarks(): number[] {
    const frames = new Set<number>();
    frames.add(this.minFrame);
    frames.add(this.maxFrame);

    for (const track of this.tracks) {
      for (const segment of track.segments) {
        frames.add(segment.startFrame);
        // A clip's far edge is where its last frame ends, which is where a clip butted after it starts.
        frames.add(Math.min(segment.startFrame + segment.totalFrames * segment.cycles, this.maxFrame));

        for (const scene of segment.scenes) {
          for (let i = 0; i < segment.cycles; i++) {
            frames.add(segment.startFrame + segment.totalFrames * i + scene.atFrame);
          }
        }
      }
    }

    for (const marker of this.markers) {
      frames.add(marker.atFrame);
    }

    return Array.from(frames).sort((a, b) => a - b);
  }

  /**
   * Recalculates total time and frame bounds from registered tracks.
   */
  @passive
  public refresh(): void {
    let totalFrames = 0;

    for (const track of this.tracks) {
      for (const segment of track.segments) {
        if (segment.endFrame > totalFrames) {
          totalFrames = segment.endFrame;
        }
      }
    }

    const totalTime = totalFrames / this.options.frameRate;
    assign(this.state, { totalTime, totalFrames });
    this.notify();
  }

  /**
   * Captures a plain serializable snapshot of the timeline identity, options, and child tracks.
   *
   * @returns {TimelineSnapshot} The persisted timeline schema.
   */
  @passive
  public snapshot(): TimelineSnapshot {
    return {
      id: this.id,
      options: { ...anchor.get(this.options, true) },
      props: { ...anchor.get(this.props, true) },
      tracks: Array.from(this.tracks, (track) => track.snapshot()),
      markers: Array.from(this.markers, (marker) => marker.snapshot()),
    };
  }

  /**
   * Hydrates the timeline identity, configuration, and child tracks from a persisted snapshot.
   *
   * @param {Partial<TimelineSnapshot>} snapshot - Snapshot containing timeline options and track configurations.
   */
  @passive
  public hydrate(snapshot: Partial<TimelineSnapshot>): void {
    if (snapshot.id) {
      this.id = snapshot.id;
    }

    if (snapshot.options) {
      const prevRate = this.options.frameRate;
      const frameRateChanged = snapshot.options.frameRate !== undefined && snapshot.options.frameRate !== prevRate;
      assign(this.options, snapshot.options);

      if (frameRateChanged) {
        this.state.frame = Math.round((this.state.frame / prevRate) * this.options.frameRate);
        this.state.time = frameToTime(this.state.frame, this.options.frameRate);
        for (const track of this.tracks) {
          for (const segment of track.segments) {
            segment.refresh(false);
          }
        }
        for (const marker of this.markers) {
          marker.atFrame = Math.round((marker.atFrame / prevRate) * this.options.frameRate);
        }
      }

      this.refresh();
    }

    if (snapshot.props) {
      assign(this.props, snapshot.props as Partial<P>);
    }

    if (snapshot.tracks) {
      for (const track of this.tracks) {
        track.destroy();
      }
      this.tracks.clear();
      this.source.tracks.length = 0;
      for (const trackSnapshot of snapshot.tracks) {
        const track = this.addTrack(trackSnapshot.options);
        if (trackSnapshot.id) {
          track.id = trackSnapshot.id;
        }
        track.hydrate(trackSnapshot);
      }
    }

    if (snapshot.markers) {
      this.markers.clear();
      this.source.markers = [];
      for (const markerSnapshot of snapshot.markers) {
        const marker = this.addMarker(markerSnapshot.options);
        if (markerSnapshot.id) {
          marker.id = markerSnapshot.id;
        }
      }
    }
  }

  /**
   * Destroys this timeline, stopping playback and tearing down all child tracks and markers.
   */
  @passive
  public destroy(): void {
    this.stop();
    this.subscribers.clear();
    for (const track of this.tracks) {
      track.destroy();
    }
    this.tracks.clear();
    this.markers.clear();
    this.refresh();
  }

  private get options(): TimelineOptions {
    return this.source.options;
  }

  private frameId?: FrameId;
  // The page being played to: the frame playback holds at, and who's waiting for it.
  private hold?: { frame: number; resolve: () => void };
  private iteration = 0;
  private subscribers = new Set<TimelineSubscriber>();
  private errorListeners = new Set<TimelineErrorListener>();
  // The frame still being delivered, aborted when a later one replaces it.
  private delivery?: AbortController;
  private delivered: Promise<void> = RESOLVED;
  // Bumped whenever playback is cancelled, so a tick still waiting on its frame stops.
  private loop = 0;

  private get minFrame(): number {
    return Math.max(0, this.options.startFrame ?? 0);
  }

  private get maxFrame(): number {
    return Math.max(this.minFrame, this.options.endFrame ?? this.state.totalFrames);
  }

  @passive
  private createTrack(options: Partial<TimelineTrackOptions>, props?: Record<string, AnyType>): TimelineTrack {
    return new TimelineTrack(this, options, props);
  }

  /**
   * Delivers the current frame to every track and subscriber. The frame before it, if still being
   * delivered, is aborted first: the latest frame always wins.
   *
   * @returns {Promise<void>} Settles once the handlers are done with this frame (at once without async
   * ticking), it runs past its tolerance, or a later frame replaces it.
   */
  private notify(): Promise<void> {
    this.delivery?.abort();

    const controller = new AbortController();
    const frame = this.state.frame;
    const delivery: TimelineDelivery = { signal: controller.signal, pending: [] };
    this.delivery = controller;

    for (const track of this.tracks) {
      track.tick(this.state, delivery);
    }
    for (const subscriber of this.subscribers) {
      delivery.pending.push(subscriber(this.state, controller.signal));
    }

    const waiting = this.options.async ? delivery.pending.filter(isThenable) : [];
    if (!waiting.length) {
      this.delivery = undefined;
      this.state.presented = frame;
      this.delivered = RESOLVED;
    } else {
      this.delivered = this.settle(waiting, controller, frame);
    }
    return this.delivered;
  }

  /**
   * Waits for a frame's handlers, at most its tolerance, then marks the frame presented when they
   * all finished. A frame that ran late is aborted so its handlers can stop.
   */
  private async settle(waiting: PromiseLike<unknown>[], controller: AbortController, frame: number): Promise<void> {
    const tolerance = typeof this.options.async === 'object' ? this.options.async.tolerance : Infinity;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finished = Promise.allSettled(waiting).then((results) => {
      if (controller.signal.aborted) return 'replaced' as const;
      for (const result of results) {
        if (result.status === 'rejected') this.report(result.reason, frame);
      }
      return 'finished' as const;
    });
    const replaced = new Promise<'replaced'>((resolve) => {
      controller.signal.addEventListener('abort', () => resolve('replaced'), { once: true });
    });
    const late = Number.isFinite(tolerance)
      ? new Promise<'late'>((resolve) => {
          timer = setTimeout(() => resolve('late'), Math.max(0, tolerance));
        })
      : undefined;

    const outcome = await Promise.race(late ? [finished, replaced, late] : [finished, replaced]);
    clearTimeout(timer);

    if (this.delivery !== controller) return;
    this.delivery = undefined;

    if (outcome === 'finished') {
      this.state.presented = frame;
    } else if (outcome === 'late') {
      controller.abort();
    }
  }

  private report(error: unknown, frame: number): void {
    if (!this.errorListeners.size) {
      console.error(error);
      return;
    }
    for (const listener of this.errorListeners) {
      listener(error, frame);
    }
  }

  private cancel(): void {
    this.loop++;
    if (this.frameId !== undefined) {
      cancelFrame(this.frameId);
      this.frameId = undefined;
    }
    // A page left playing is let go: whoever asked for it is settled where playback stopped.
    if (this.hold) {
      this.hold.resolve();
      this.hold = undefined;
    }
  }
}

/**
 * Creates and initializes a new master Timeline instance.
 *
 * @param {TimelineInit} [options] - Initial configuration (framerate, speed, bounds, repeat).
 * @param {P} [props] - Consumer-owned data slot (e.g. composition-wide defaults).
 * @returns {Timeline<P>} A configured Timeline coordinator instance.
 */
export function createTimeline<P extends Record<string, AnyType> = Record<string, AnyType>>(
  options?: TimelineInit,
  props?: P
): Timeline<P> {
  return new Timeline(options, props);
}
