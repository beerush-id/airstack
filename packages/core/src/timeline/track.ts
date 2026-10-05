import { anchor } from '../engine/anchor.ts';
import { assign } from '../engine/helper.ts';
import { mutable } from '../reactive/index.ts';
import type { AnyType } from '../types.ts';
import { uuid } from '../utils/uuid.ts';
import { TimelineSegment, type TimelineSegmentOptions, type TimelineSegmentSnapshot } from './segment.ts';
import type { FrameState, Timeline } from './timeline.ts';

export type TimelineTrackOptions = {
  type?: string;
  name?: string;
  meta?: Record<string, AnyType>;
  disabled?: boolean;
};

export type TimelineTrackSnapshot = {
  id: string;
  options: TimelineTrackOptions;
  segments: TimelineSegmentSnapshot[];
};

/**
 * Organizational lane container grouping synchronized child segments on a Timeline.
 */
export class TimelineTrack {
  /**
   * Unique identifier for this track instance.
   */
  public id = uuid();

  /**
   * Collection of synchronized child segments belonging to this track.
   */
  public segments = mutable(new Set<TimelineSegment>(), { recursive: false });

  /**
   * Creates an organizational track container on the master timeline.
   *
   * @param {Timeline} timeline - Master timeline coordinator owning this track.
   * @param {Partial<TimelineTrackOptions>} [options] - Initial track configuration.
   */
  constructor(
    public readonly timeline: Timeline,
    options: Partial<TimelineTrackOptions> = {}
  ) {
    this.options = mutable({ ...options });
    timeline.tracks.add(this);
  }

  /**
   * Consumer routing type (e.g. 'video', 'webgl', 'html', 'audio', 'marker').
   */
  public get type(): string | undefined {
    return this.options.type;
  }

  public set type(value: string | undefined) {
    this.options.type = value;
  }

  /**
   * Descriptive track name or lane identifier for editor UI representation.
   */
  public get name(): string | undefined {
    return this.options.name;
  }

  public set name(value: string | undefined) {
    this.options.name = value;
  }

  /**
   * Arbitrary user-defined metadata associated with this track.
   */
  public get meta(): Record<string, AnyType> | undefined {
    return this.options.meta;
  }

  public set meta(value: Record<string, AnyType> | undefined) {
    this.options.meta = value;
  }

  /**
   * Whether this track is disabled, muting playback across all child segments.
   */
  public get disabled(): boolean | undefined {
    return this.options.disabled;
  }

  public set disabled(value: boolean | undefined) {
    this.options.disabled = value;
    for (const segment of this.segments) {
      if (value) {
        segment.reset();
      } else {
        segment.tick(this.timeline.state);
      }
    }
  }

  /**
   * Adds a segment to this track.
   *
   * @param {Partial<TimelineSegmentOptions>} [options] - Segment configuration options.
   * @returns {TimelineSegment} The instantiated segment.
   */
  public addSegment(options: Partial<TimelineSegmentOptions> = {}): TimelineSegment {
    return new TimelineSegment(this, options);
  }

  /**
   * Applies a single tick from the master timeline to all child segments.
   *
   * @param {FrameState} state - Current master timeline playback state.
   */
  public tick(state: FrameState): void {
    for (const segment of this.segments) {
      segment.tick(state);
    }
  }

  /**
   * Removes a segment from this track.
   *
   * @param {TimelineSegment} segment - Segment instance to remove.
   */
  public removeSegment(segment: TimelineSegment): void {
    if (this.segments.delete(segment)) {
      segment.destroy();
      if (this.timeline.tracks.has(this)) {
        this.timeline.refresh();
      }
    }
  }

  /**
   * Captures a plain serializable snapshot of the track identity, options, and child segments.
   *
   * @returns {TimelineTrackSnapshot} Serialized snapshot of this track.
   */
  public snapshot(): TimelineTrackSnapshot {
    return {
      id: this.id,
      options: { ...anchor.get(this.options, true) },
      segments: Array.from(this.segments, (segment) => segment.snapshot()),
    };
  }

  /**
   * Hydrates track configuration, identity, and child segments from a snapshot.
   *
   * @param {Partial<TimelineTrackSnapshot>} snapshot - Snapshot to restore onto this track.
   */
  public hydrate(snapshot: Partial<TimelineTrackSnapshot>): void {
    if (snapshot.id) {
      this.id = snapshot.id;
    }
    if (snapshot.options) {
      assign(this.options, snapshot.options);
    }
    if (snapshot.segments) {
      this.segments.clear();
      for (const segmentSnapshot of snapshot.segments) {
        this.addSegment(segmentSnapshot.options).hydrate(segmentSnapshot);
      }
    }
  }

  /**
   * Removes this track from the parent timeline and destroys it.
   */
  public remove(): void {
    this.timeline.removeTrack(this);
    this.destroy();
  }

  /**
   * Destroys this track and all its child segments.
   */
  public destroy(): void {
    for (const segment of this.segments) {
      segment.destroy();
    }
    this.segments.clear();
  }

  private options: TimelineTrackOptions;
}
