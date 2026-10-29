import { anchor } from '../engine/anchor.js';
import { assign } from '../engine/helper.js';
import { passive } from '../reactive/index.js';
import type { AnyType } from '../types.js';
import { uuid } from '../utils/uuid.js';
import { frameToTime, keepNode, timeToFrame } from './helper.js';
import type { TimelineSegment } from './segment.js';
import type { Timeline } from './timeline.js';

export type TimelineSceneOptions = {
  atFrame: number;
  type?: string;
  name?: string;
  meta?: Record<string, AnyType>;
};

/**
 * Initialization options for creating a keyframe scene.
 * Accepts either `atFrame` or `atTime` (converted to discrete frame).
 */
export type TimelineSceneInit = Omit<Partial<TimelineSceneOptions>, 'atFrame'> & {
  atFrame?: number;
  atTime?: number;
};

export type TimelineSceneSnapshot = {
  id: string;
  options: TimelineSceneOptions;
  data: Record<string, AnyType>;
};

/**
 * Pure declarative keyframe snapshot positioned at a local frame within a TimelineSegment.
 */
export class TimelineScene {
  /**
   * The scene's branch of the timeline's storage: its identity, options and data.
   */
  public readonly source!: TimelineSceneSnapshot;

  /**
   * Unique identifier for this scene instance.
   */
  public get id(): string {
    return this.source.id;
  }

  public set id(value: string) {
    this.source.id = value;
  }

  /**
   * Opaque user-land payload (e.g. animation properties, styling targets, driver data).
   */
  public get data(): Record<string, AnyType> {
    return this.source.data;
  }

  public set data(value: Record<string, AnyType>) {
    this.source.data = value;
  }

  /**
   * Reference to the master timeline coordinator.
   */
  public get timeline(): Timeline {
    return this.segment.timeline;
  }

  /**
   * Creates a declarative keyframe scene on a timeline segment: over its node in the timeline's
   * storage when given one, or over a new node.
   *
   * @param {TimelineSegment} segment - Parent segment owning this keyframe scene.
   * @param {TimelineSceneInit} [options] - Initial scene configuration, for a new node.
   * @param {Record<string, AnyType>} [data] - User-land data payload, for a new node.
   * @param {TimelineSceneSnapshot} [source] - The scene's existing node in the timeline's storage.
   */
  constructor(
    public readonly segment: TimelineSegment,
    options: TimelineSceneInit = {},
    data: Record<string, AnyType> = {},
    source?: TimelineSceneSnapshot
  ) {
    if (source) {
      this.source = source;
      source.id ??= uuid();
      source.options.atFrame ??= 0;
      source.data ??= {};
    } else {
      const maxFrame = segment.offsetFrame + segment.state.totalFrames;
      const rawFrame = options.atFrame !== undefined
        ? options.atFrame
        : options.atTime !== undefined
          ? timeToFrame(options.atTime, this.timeline.frameRate)
          : 0;
      const atFrame = Math.min(maxFrame, Math.max(0, Math.round(rawFrame)));

      const { atTime, ...rest } = options;
      this.source = keepNode(segment.source.scenes ??= [], { id: uuid(), options: { ...rest, atFrame }, data: { ...data } });
    }

    segment.scenes.push(this);
    segment.sortScenes();
  }

  /**
   * Integer frame on the parent segment where this keyframe is positioned.
   */
  public get atFrame(): number {
    return this.options.atFrame;
  }

  public set atFrame(value: number) {
    const maxFrame = this.segment.offsetFrame + this.segment.state.totalFrames;
    this.options.atFrame = Math.min(maxFrame, Math.max(0, Math.round(value)));
    this.segment.sortScenes();
  }

  /**
   * Frame position in seconds derived from the master timeline frame rate.
   */
  public get atTime(): number {
    return frameToTime(this.options.atFrame, this.timeline.frameRate);
  }

  public set atTime(value: number) {
    this.atFrame = timeToFrame(value, this.timeline.frameRate);
  }

  /**
   * Consumer routing or classification type (e.g. 'gsap', 'shader', 'action').
   */
  public get type(): string | undefined {
    return this.options.type;
  }

  public set type(value: string | undefined) {
    this.options.type = value;
  }

  /**
   * Descriptive scene name or label.
   */
  public get name(): string | undefined {
    return this.options.name;
  }

  public set name(value: string | undefined) {
    this.options.name = value;
  }

  /**
   * Arbitrary metadata associated with this scene.
   */
  public get meta(): Record<string, AnyType> | undefined {
    return this.options.meta;
  }

  public set meta(value: Record<string, AnyType> | undefined) {
    this.options.meta = value;
  }

  /**
   * Captures a plain serializable snapshot of the scene identity, options, and user data.
   *
   * @returns {TimelineSceneSnapshot} Serialized snapshot of this scene.
   */
  @passive
  public snapshot(): TimelineSceneSnapshot {
    return {
      id: this.id,
      options: { ...anchor.get(this.options, true) },
      data: { ...anchor.get(this.data, true) },
    };
  }

  /**
   * Hydrates scene configuration, identity, and user data from a snapshot.
   *
   * @param {Partial<TimelineSceneSnapshot>} snapshot - Snapshot to restore onto this scene.
   */
  @passive
  public hydrate(snapshot: Partial<TimelineSceneSnapshot>): void {
    if (snapshot.id) {
      this.id = snapshot.id;
    }
    if (snapshot.options) {
      assign(this.options, snapshot.options);
      if (snapshot.options.atFrame !== undefined) {
        this.atFrame = snapshot.options.atFrame;
      }
    }
    if (snapshot.data) {
      assign(this.data, snapshot.data);
    }
  }

  /**
   * Removes this scene from its parent segment.
   */
  public remove(): void {
    this.segment.removeScene(this);
  }

  private get options(): TimelineSceneOptions {
    return this.source.options;
  }
}
