import { anchor } from '../engine/anchor.ts';
import { assign } from '../engine/helper.ts';
import { mutable } from '../reactive/index.ts';
import type { AnyType } from '../types.ts';
import { uuid } from '../utils/uuid.ts';
import { frameToTime, timeToFrame } from './helper.ts';
import { TimelineScene, type TimelineSceneOptions, type TimelineSceneSnapshot } from './scene.ts';
import type { FrameState, Timeline, TimelineSubscriber } from './timeline.ts';
import type { TimelineTrack } from './track.ts';

export type TimelineSegmentOptions = {
  type?: string;
  name?: string;
  meta?: Record<string, AnyType>;
  disabled?: boolean;
  repeat?: boolean | number;
  speed: number;
  duration: number;
  startFrame: number;
};

export type TimelineSegmentSnapshot = {
  id: string;
  options: TimelineSegmentOptions;
  scenes?: TimelineSceneSnapshot[];
};

export type TimelineTransitionState = {
  segment: TimelineSegment;
  from: TimelineScene;
  to?: TimelineScene;
  progress: number;
  frame: number;
  time: number;
};

export type TimelineTransitionSubscriber = (state: TimelineTransitionState) => void;

/**
 * Individual bounded segment synchronized by subscribing to a master Timeline clock.
 */
export class TimelineSegment {
  /**
   * Unique identifier for this segment instance.
   */
  public id = uuid();

  /**
   * Reactive playback and timing state of this segment.
   */
  public state: FrameState;

  /**
   * Collection of keyframe scenes belonging to this segment, ordered by atFrame.
   */
  public scenes = mutable<TimelineScene[]>([], { recursive: false });

  /**
   * Currently active keyframe scene positioned at or before the local playhead.
   */
  public activeScene?: TimelineScene;

  /**
   * Target keyframe scene positioned immediately after the local playhead.
   */
  public nextScene?: TimelineScene;

  /**
   * Normalized interpolation progress between activeScene and nextScene (0 to 1).
   */
  public progress = 0;

  /**
   * Reference to the master timeline coordinator.
   */
  public get timeline(): Timeline {
    return this.track.timeline;
  }

  /**
   * Creates an individual timeline segment belonging to a track.
   *
   * @param {TimelineTrack} track - Parent track owning this segment.
   * @param {Partial<TimelineSegmentOptions>} [options] - Initial segment configuration.
   */
  constructor(
    public readonly track: TimelineTrack,
    options: Partial<TimelineSegmentOptions> = {}
  ) {
    this.frameRate = this.track.timeline.frameRate;
    this.options = mutable({ speed: 1, duration: 0, startFrame: 0, ...options });

    this.state = mutable<FrameState>({
      time: 0,
      frame: 0,
      status: 'idle',
      totalTime: 0,
      totalFrames: 0,
    });

    track.segments.add(this);
    this.refresh();
  }

  /**
   * Consumer routing type (e.g. 'video', 'webgl', 'html', 'audio', 'marker').
   * Used by downstream drivers to dispatch segment rendering to specialized engines.
   */
  public get type(): string | undefined {
    return this.options.type;
  }

  public set type(value: string | undefined) {
    this.options.type = value;
  }

  /**
   * Descriptive segment name or cue identifier for editor UI representation and landmark navigation.
   */
  public get name(): string | undefined {
    return this.options.name;
  }

  public set name(value: string | undefined) {
    this.options.name = value;
  }

  /**
   * Arbitrary user-defined metadata associated with this segment (e.g. assets, styling, driver payloads).
   */
  public get meta(): Record<string, AnyType> | undefined {
    return this.options.meta;
  }

  public set meta(value: Record<string, AnyType> | undefined) {
    this.options.meta = value;
  }

  /**
   * Whether this segment is disabled, skipping playback updates.
   */
  public get disabled(): boolean {
    return Boolean(this.options.disabled || this.track.disabled);
  }

  public set disabled(value: boolean | undefined) {
    this.options.disabled = value;
    if (this.disabled) {
      this.reset();
    } else {
      this.tick(this.timeline.state);
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
    this.refresh();
  }

  /**
   * Playback speed multiplier applied when calculating frame progression.
   */
  public get speed(): number {
    return this.options.speed;
  }

  public set speed(value: number) {
    this.options.speed = value;
    this.refresh();
  }

  /**
   * Nominal cycle duration in seconds before repetition or completion.
   */
  public get duration(): number {
    return this.options.duration;
  }

  public set duration(value: number) {
    this.options.duration = Math.max(0, value);
    this.refresh();
  }

  /**
   * Start offset in seconds on the master timeline, derived from startFrame.
   */
  public get startTime(): number {
    return frameToTime(this.options.startFrame, this.timeline.frameRate);
  }

  public set startTime(value: number) {
    this.startFrame = timeToFrame(value, this.timeline.frameRate);
  }

  /**
   * Integer frame on the master timeline where this segment begins playback.
   */
  public get startFrame(): number {
    return this.options.startFrame;
  }

  public set startFrame(value: number) {
    this.options.startFrame = value;
    this.refresh();
  }

  /**
   * Number of finite playback cycles laid out on the master timeline: 1 plus a numeric repeat count.
   * Infinite loops (`repeat: true`) count as a single cycle.
   */
  public get cycles(): number {
    const repeat = this.options.repeat;
    return typeof repeat === 'number' && repeat > 0 ? 1 + repeat : 1;
  }

  /**
   * Frame on the master timeline where the last finite cycle of this segment ends.
   */
  public get endFrame(): number {
    return this.state.totalFrames > 0
      ? this.options.startFrame + this.state.totalFrames * this.cycles - 1
      : this.options.startFrame;
  }

  /**
   * Current local playback position in seconds, derived from current local frame.
   */
  public get time(): number {
    return this.state.time;
  }

  /**
   * Current local frame index within the active cycle (0 to totalFrames).
   */
  public get frame(): number {
    return this.state.frame;
  }

  /**
   * Segment playback status: 'playing' when playhead is within active window, otherwise 'idle'.
   */
  public get status(): 'idle' | 'playing' {
    return this.state.status;
  }

  /**
   * Whether this segment is currently within its active playback window on the master timeline.
   */
  public get active(): boolean {
    if (this.disabled) {
      return false;
    }

    const frame = this.timeline.state.frame;
    if (frame < this.options.startFrame) {
      return false;
    }

    return this.options.repeat === true || frame <= this.endFrame;
  }

  /**
   * Total duration in seconds for a single playback cycle.
   */
  public get totalTime(): number {
    return this.state.totalTime;
  }

  /**
   * Total frame count for a single playback cycle.
   */
  public get totalFrames(): number {
    return this.state.totalFrames;
  }

  /**
   * Subscribes a listener to segment clock updates.
   *
   * @param {TimelineSubscriber} subscriber - Callback receiving current segment state.
   * @returns {() => void} Teardown function to unsubscribe.
   */
  public subscribe(subscriber: TimelineSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  /**
   * Subscribes a listener to keyframe transition updates between activeScene and nextScene.
   *
   * @param {TimelineTransitionSubscriber} subscriber - Callback receiving current transition state.
   * @returns {() => void} Teardown function to unsubscribe.
   */
  public onTransition(subscriber: TimelineTransitionSubscriber): () => void {
    this.transitionSubscribers.add(subscriber);
    return () => this.transitionSubscribers.delete(subscriber);
  }

  /**
   * Adds a keyframe scene to this segment.
   *
   * @param {Partial<TimelineSceneOptions>} [options] - Scene configuration options.
   * @param {Record<string, AnyType>} [data] - User-land data payload.
   * @returns {TimelineScene} The instantiated scene.
   */
  public addScene(options: Partial<TimelineSceneOptions> = {}, data: Record<string, AnyType> = {}): TimelineScene {
    return new TimelineScene(this, options, data);
  }

  /**
   * Removes a keyframe scene from this segment.
   *
   * @param {TimelineScene} scene - Scene instance to remove.
   */
  public removeScene(scene: TimelineScene): void {
    const index = this.scenes.indexOf(scene);
    if (index !== -1) {
      this.scenes.splice(index, 1);
      this.sceneSpanValid = false;
      this.tick(this.timeline.state);
    }
  }

  /**
   * Re-orders keyframe scenes chronologically by atFrame and re-resolves the active span at the current playhead.
   */
  public sortScenes(): void {
    this.orderScenes();
    this.tick(this.timeline.state);
  }

  /**
   * Recalculates total duration and frame bounds from options.
   */
  public refresh(notifyTimeline = true): void {
    const frameRate = this.timeline.frameRate;

    const totalFrames = Math.round((this.options.duration * frameRate) / (this.options.speed || 1));
    const totalTime = totalFrames / frameRate;
    assign(this.state, { totalTime, totalFrames });

    if (this.frameRate !== frameRate) {
      if (this.options.startFrame && this.frameRate > 0) {
        this.options.startFrame = Math.round((this.options.startFrame / this.frameRate) * frameRate);
      }
      for (const scene of this.scenes) {
        scene.atFrame = Math.round((scene.atFrame / this.frameRate) * frameRate);
      }
      this.frameRate = frameRate;
    }

    for (const scene of this.scenes) {
      if (scene.atFrame > totalFrames) {
        scene.atFrame = totalFrames;
      }
    }

    this.orderScenes();

    if (notifyTimeline) {
      this.timeline.refresh();
    }
  }

  /**
   * Resets local playhead position to 0 and transitions status to idle.
   */
  public reset(): void {
    this.activeScene = undefined;
    this.nextScene = undefined;
    this.sceneSpanValid = false;
    this.progress = 0;

    if (this.state.frame !== 0 || this.state.time !== 0 || this.state.status !== 'idle') {
      assign(this.state, { time: 0, frame: 0, status: 'idle' });
      this.notify();
    }
  }

  /**
   * Captures a plain serializable snapshot of the segment identity and options.
   *
   * @returns {TimelineSegmentSnapshot} Serialized snapshot of this segment.
   */
  public snapshot(): TimelineSegmentSnapshot {
    return {
      id: this.id,
      options: { ...anchor.get(this.options, true) },
      scenes: anchor.get(this.scenes, true).map((scene) => scene.snapshot()),
    };
  }

  /**
   * Hydrates segment configuration and identity from a snapshot and recalculates bounds.
   *
   * @param {Partial<TimelineSegmentSnapshot>} snapshot - Snapshot to restore onto this segment.
   */
  public hydrate(snapshot: Partial<TimelineSegmentSnapshot>): void {
    if (snapshot.id) {
      this.id = snapshot.id;
    }
    if (snapshot.options) {
      assign(this.options, snapshot.options);
      this.refresh();
    }
    if (snapshot.scenes) {
      this.scenes.length = 0;
      for (const sceneSnapshot of snapshot.scenes) {
        const scene = this.addScene(sceneSnapshot.options, sceneSnapshot.data);
        if (sceneSnapshot.id) {
          scene.id = sceneSnapshot.id;
        }
      }
    }
  }

  /**
   * Removes this segment from its parent track and destroys it.
   */
  public remove(): void {
    this.track.removeSegment(this);
    this.destroy();
  }

  /**
   * Destroys this segment, clearing subscribers and removing all child scenes.
   */
  public destroy(): void {
    this.subscribers.clear();
    this.transitionSubscribers.clear();
    this.scenes.length = 0;
    this.activeScene = undefined;
    this.nextScene = undefined;
    this.progress = 0;
  }

  /**
   * Applies a single tick from the parent track.
   *
   * @param {FrameState} timelineState - Current master timeline playback state.
   */
  public tick(timelineState: FrameState): void {
    if (this.disabled) {
      this.reset();
      return;
    }

    const elapsed = timelineState.frame - this.options.startFrame;
    const baseFrames = this.state.totalFrames;

    if (baseFrames <= 0) {
      if (elapsed === 0) {
        assign(this.state, { time: 0, frame: 0, status: timelineState.status });
        this.notify();
      } else {
        this.reset();
      }
      return;
    }

    if (elapsed < 0) {
      this.reset();
      return;
    }

    const isLooping = this.options.repeat === true;
    const maxElapsed = this.cycles * baseFrames;

    if (!isLooping && elapsed >= maxElapsed) {
      this.reset();
      return;
    }

    let frame: number;

    if (isLooping) {
      frame = elapsed % baseFrames;
    } else {
      frame = elapsed % baseFrames;
    }

    const time = frameToTime(frame, this.timeline.frameRate);
    const status = timelineState.status;
    assign(this.state, { time, frame, status });

    if (this.scenes.length > 0) {
      const isSpanCurrent =
        this.sceneSpanValid &&
        (this.activeScene
          ? frame >= this.activeScene.atFrame && (!this.nextScene || frame < this.nextScene.atFrame)
          : frame < this.scenes[0].atFrame);

      if (!isSpanCurrent) {
        let activeIndex = -1;

        for (let i = 0; i < this.scenes.length; i++) {
          if (this.scenes[i].atFrame <= frame) {
            activeIndex = i;
          } else {
            break;
          }
        }

        this.activeScene = activeIndex >= 0 ? this.scenes[activeIndex] : undefined;
        this.nextScene = activeIndex + 1 < this.scenes.length ? this.scenes[activeIndex + 1] : undefined;
        this.sceneSpanValid = true;
      }

      this.progress =
        this.activeScene && this.nextScene && this.nextScene.atFrame > this.activeScene.atFrame
          ? (frame - this.activeScene.atFrame + 1) / (this.nextScene.atFrame - this.activeScene.atFrame + 1)
          : this.activeScene
            ? 1
            : 0;

      this.notifyTransition();
    } else {
      this.activeScene = undefined;
      this.nextScene = undefined;
      this.progress = 0;
    }

    this.notify();
  }

  private frameRate: number;
  private options: TimelineSegmentOptions;
  private sceneSpanValid = false;
  private subscribers = new Set<TimelineSubscriber>();
  private transitionSubscribers = new Set<TimelineTransitionSubscriber>();

  private notify(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.state);
    }
  }

  private notifyTransition(): void {
    if (this.transitionSubscribers.size === 0 || !this.activeScene) {
      return;
    }

    const transitionState: TimelineTransitionState = {
      segment: this,
      from: this.activeScene,
      to: this.nextScene,
      progress: this.progress,
      frame: this.state.frame,
      time: this.state.time,
    };

    for (const subscriber of this.transitionSubscribers) {
      subscriber(transitionState);
    }
  }

  private orderScenes(): void {
    this.scenes.sort((a, b) => a.atFrame - b.atFrame);
    this.sceneSpanValid = false;
  }
}
