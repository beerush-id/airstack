import { anchor } from '../engine/anchor.js';
import { assign } from '../engine/helper.js';
import { mutable, passive } from '../reactive/index.js';
import type { AnyType } from '../types.js';
import { uuid } from '../utils/uuid.js';
import { frameToTime, timeToFrame } from './helper.js';
import type { Timeline } from './timeline.js';

export type TimelineMarkerOptions = {
  type?: string;
  name?: string;
  atFrame: number;
  meta?: Record<string, AnyType>;
};

export type TimelineMarkerSnapshot = {
  id: string;
  options: TimelineMarkerOptions;
};

/**
 * Visual cue point or bookmark at a specific discrete frame on a Timeline.
 */
export class TimelineMarker {
  /**
   * Unique identifier for this marker instance.
   */
  public id = uuid();

  /**
   * Creates a cue point marker on the master timeline.
   *
   * @param {Timeline} timeline - Master timeline coordinator owning this marker.
   * @param {Partial<TimelineMarkerOptions>} [options] - Initial marker configuration.
   */
  constructor(
    public readonly timeline: Timeline,
    options: Partial<TimelineMarkerOptions> = {}
  ) {
    this.options = mutable({ atFrame: 0, ...options });
    this.atFrame = this.options.atFrame;
    timeline.markers.add(this);
  }

  /**
   * Consumer routing or classification type (e.g. 'cue', 'chapter', 'audio', 'action').
   */
  public get type(): string | undefined {
    return this.options.type;
  }

  public set type(value: string | undefined) {
    this.options.type = value;
  }

  /**
   * Descriptive marker name or cue label.
   */
  public get name(): string | undefined {
    return this.options.name;
  }

  public set name(value: string | undefined) {
    this.options.name = value;
  }

  /**
   * Discrete frame on the timeline where this marker is positioned.
   */
  public get atFrame(): number {
    return this.options.atFrame;
  }

  public set atFrame(value: number) {
    this.options.atFrame = Math.max(0, Math.round(value));
  }

  /**
   * Target position in seconds derived from the master timeline frame rate.
   */
  public get atTime(): number {
    return frameToTime(this.options.atFrame, this.timeline.frameRate);
  }

  public set atTime(value: number) {
    this.atFrame = timeToFrame(value, this.timeline.frameRate);
  }

  /**
   * Arbitrary user-defined metadata associated with this marker.
   */
  public get meta(): Record<string, AnyType> | undefined {
    return this.options.meta;
  }

  public set meta(value: Record<string, AnyType> | undefined) {
    this.options.meta = value;
  }

  /**
   * Captures a plain serializable snapshot of the marker identity and options.
   *
   * @returns {TimelineMarkerSnapshot} Serialized snapshot of this marker.
   */
  @passive
  public snapshot(): TimelineMarkerSnapshot {
    return {
      id: this.id,
      options: { ...anchor.get(this.options, true) },
    };
  }

  /**
   * Hydrates marker configuration and identity from a snapshot.
   *
   * @param {Partial<TimelineMarkerSnapshot>} snapshot - Snapshot to restore onto this marker.
   */
  @passive
  public hydrate(snapshot: Partial<TimelineMarkerSnapshot>): void {
    if (snapshot.id) {
      this.id = snapshot.id;
    }
    if (snapshot.options) {
      assign(this.options, snapshot.options);
    }
  }

  /**
   * Removes this marker from the parent timeline.
   */
  public remove(): void {
    this.timeline.removeMarker(this);
  }

  private options: TimelineMarkerOptions;
}
