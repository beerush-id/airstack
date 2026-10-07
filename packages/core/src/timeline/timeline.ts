import { anchor } from '../engine/anchor.js';
import { assign } from '../engine/helper.js';
import { mutable, passive } from '../reactive/index.js';
import type { AnyType } from '../types.js';
import { uuid } from '../utils/uuid.js';
import { animationFrame, cancelFrame, type FrameId, frameToTime, timeToFrame } from './helper.js';
import { TimelineMarker, type TimelineMarkerInit, type TimelineMarkerSnapshot } from './marker.js';
import { TimelineTrack, type TimelineTrackOptions, type TimelineTrackSnapshot } from './track.js';

export type FrameState = {
  time: number;
  frame: number;
  status: 'idle' | 'playing';
  totalTime: number;
  totalFrames: number;
};

export type TimelineOptions = {
  repeat?: boolean | number;
  frameRate: number;
  startFrame?: number;
  endFrame?: number;
  speed?: number;
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
};

export type TimelineSubscriber = (state: FrameState) => void;

export type TimelineSnapshot = {
  id: string;
  options: TimelineOptions;
  props?: Record<string, AnyType>;
  tracks: TimelineTrackSnapshot[];
  markers?: TimelineMarkerSnapshot[];
};

/**
 * Real-time master timeline controller driven by requestAnimationFrame.
 */
export class Timeline<P extends Record<string, AnyType> = Record<string, AnyType>> {
  /**
   * Unique identifier for this timeline instance.
   */
  public id = uuid();

  /**
   * Reactive consumer-owned data slot (e.g. composition-wide defaults such as base CSS properties).
   * The timeline never reads or writes it; it only persists it through snapshot and hydrate.
   */
  public props: P;

  /**
   * Reactive playback and timing state of the master timeline.
   */
  public state = mutable<FrameState>({
    time: 0,
    frame: 0,
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
   * Creates a real-time master timeline coordinator.
   *
   * @param {TimelineInit} [options] - Initial configuration (framerate, speed, bounds, repeat).
   * @param {P} [props] - Consumer-owned data slot.
   */
  constructor(options: TimelineInit = {}, props: P = {} as P) {
    this.props = mutable({ ...props });

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

    const { startTime, endTime, ...rest } = options;
    this.options = mutable<TimelineOptions>({
      frameRate,
      speed: 1,
      ...rest,
      startFrame,
      endFrame,
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
    this.state.time = this.state.frame === 0 ? 0 : frameToTime(this.state.frame, nextRate);

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
      track.destroy();
      this.refresh();
    }
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
    this.markers.delete(marker);
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
    this.notify();

    let startTimestamp = performance.now();
    const jitterMargin = (1000 / this.options.frameRate) * 0.15;

    const tick = (now: number) => {
      if (this.state.status !== 'playing') return;

      const elapsedMs = now - startTimestamp + jitterMargin;
      const speed = this.options.speed ?? 1;
      const targetFrame = currentFrame + Math.floor((elapsedMs / 1000) * speed * this.options.frameRate);
      const maxFrame = this.maxFrame;

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
          this.notify();
          this.frameId = animationFrame(tick, this.options.frameRate);
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
        this.notify();
      }

      this.frameId = animationFrame(tick, this.options.frameRate);
    };

    this.frameId = animationFrame(tick, this.options.frameRate);

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
      time: minFrame === 0 ? 0 : frameToTime(minFrame, this.options.frameRate),
      frame: minFrame,
      status: 'idle',
    });
    this.notify();
  }

  /**
   * Seeks timeline to a specific position in seconds.
   *
   * @param {number} time - Target position in seconds.
   */
  @passive
  public seek(time: number): void {
    this.scrub(timeToFrame(time, this.options.frameRate));
  }

  /**
   * Scrubs timeline to a specific frame number.
   *
   * @param {number} frame - Target frame number.
   */
  @passive
  public scrub(frame: number): void {
    const frameRate = this.options.frameRate;
    const clampedFrame = Math.min(Math.max(this.minFrame, Math.round(frame)), this.maxFrame);

    if (this.state.status === 'playing') {
      this.play(clampedFrame);
    } else {
      const time = clampedFrame === 0 ? 0 : frameToTime(clampedFrame, frameRate);
      assign(this.state, { frame: clampedFrame, time });
      this.notify();
    }
  }

  /**
   * Advances or rewinds the timeline by a relative frame offset.
   *
   * @param {number} [delta=1] - Number of frames to advance (negative to rewind).
   */
  @passive
  public step(delta = 1): void {
    this.scrub(this.state.frame + delta);
  }

  /**
   * Advances playback to the next landmark (track boundary).
   */
  @passive
  public next(): void {
    const current = this.state.frame;
    const landmarks = this.getLandmarks();

    for (const frame of landmarks) {
      if (frame > current) {
        this.scrub(frame);
        return;
      }
    }
  }

  /**
   * Rewinds playback to the previous landmark (track boundary).
   */
  @passive
  public prev(): void {
    const current = this.state.frame;
    const landmarks = this.getLandmarks();

    for (let i = landmarks.length - 1; i >= 0; i--) {
      const frame = landmarks[i];
      if (frame < current) {
        this.scrub(frame);
        return;
      }
    }
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
        frames.add(segment.endFrame);

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
        this.state.time = this.state.frame === 0 ? 0 : frameToTime(this.state.frame, this.options.frameRate);
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

  private options: TimelineOptions;
  private frameId?: FrameId;
  private iteration = 0;
  private subscribers = new Set<TimelineSubscriber>();

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

  private notify(): void {
    for (const track of this.tracks) {
      track.tick(this.state);
    }
    for (const subscriber of this.subscribers) {
      subscriber(this.state);
    }
  }

  private cancel(): void {
    if (this.frameId !== undefined) {
      cancelFrame(this.frameId);
      this.frameId = undefined;
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
