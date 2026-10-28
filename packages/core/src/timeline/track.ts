import { anchor } from '../engine/anchor.js';
import { assign } from '../engine/helper.js';
import { mutable, passive } from '../reactive/index.js';
import type { AnyType } from '../types.js';
import { uuid } from '../utils/uuid.js';
import { TimelineSegment, type TimelineSegmentInit, type TimelineSegmentSnapshot } from './segment.js';
import type { FrameState, Timeline, TimelineDelivery } from './timeline.js';

export type TimelineTrackOptions = {
  type?: string;
  name?: string;
  meta?: Record<string, AnyType>;
  disabled?: boolean;
};

export type TimelineTrackSnapshot = {
  id: string;
  options: TimelineTrackOptions;
  props?: Record<string, AnyType>;
  segments: TimelineSegmentSnapshot[];
};

/**
 * Organizational lane container grouping synchronized child segments on a Timeline.
 */
export class TimelineTrack<P extends Record<string, AnyType> = Record<string, AnyType>> {
  /**
   * Unique identifier for this track instance.
   */
  public id = uuid();

  /**
   * Reactive consumer-owned data slot (e.g. lane-wide defaults shared by every segment on this track).
   * The timeline never reads or writes it; it only persists it through snapshot and hydrate.
   */
  public props: P;

  /**
   * Collection of synchronized child segments belonging to this track.
   */
  public segments = mutable(new Set<TimelineSegment>(), { recursive: false });

  /**
   * Creates an organizational track container on the master timeline.
   *
   * @param {Timeline} timeline - Master timeline coordinator owning this track.
   * @param {Partial<TimelineTrackOptions>} [options] - Initial track configuration.
   * @param {P} [props] - Consumer-owned data slot.
   */
  constructor(
    public readonly timeline: Timeline,
    options: Partial<TimelineTrackOptions> = {},
    props: P = {} as P
  ) {
    this.options = mutable({ ...options });
    this.props = mutable({ ...props });
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
   * @param {TimelineSegmentInit} [options] - Segment configuration options.
   * @param {SP} [props] - Consumer-owned data slot for the segment.
   * @returns {TimelineSegment<SP>} The instantiated segment.
   */
  public addSegment<SP extends Record<string, AnyType> = Record<string, AnyType>>(
    options: TimelineSegmentInit = {},
    props?: SP
  ): TimelineSegment<SP> {
    return this.createSegment(options, props) as TimelineSegment<SP>;
  }

  /**
   * Applies a single tick from the master timeline to all child segments.
   *
   * @param {FrameState} state - Current master timeline playback state.
   * @param {TimelineDelivery} [delivery] - The frame being delivered, collecting what handlers return so an async timeline can wait for it.
   */
  @passive
  public tick(state: FrameState, delivery?: TimelineDelivery): void {
    for (const segment of this.segments) {
      segment.tick(state, delivery);
    }
  }

  /**
   * Removes a segment from this track.
   *
   * @param {TimelineSegment} segment - Segment instance to remove.
   */
  @passive
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
  @passive
  public snapshot(): TimelineTrackSnapshot {
    return {
      id: this.id,
      options: { ...anchor.get(this.options, true) },
      props: { ...anchor.get(this.props, true) },
      segments: Array.from(this.segments, (segment) => segment.snapshot()),
    };
  }

  /**
   * Hydrates track configuration, identity, and child segments from a snapshot.
   *
   * @param {Partial<TimelineTrackSnapshot>} snapshot - Snapshot to restore onto this track.
   */
  @passive
  public hydrate(snapshot: Partial<TimelineTrackSnapshot>): void {
    if (snapshot.id) {
      this.id = snapshot.id;
    }
    if (snapshot.options) {
      assign(this.options, snapshot.options);
    }
    if (snapshot.props) {
      assign(this.props, snapshot.props as Partial<P>);
    }
    if (snapshot.segments) {
      for (const segment of this.segments) {
        /* istanbul ignore next */
        segment.destroy();
      }
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
  @passive
  public destroy(): void {
    for (const segment of this.segments) {
      segment.destroy();
    }
    this.segments.clear();
  }

  private options: TimelineTrackOptions;

  @passive
  private createSegment(options: TimelineSegmentInit, props?: Record<string, AnyType>): TimelineSegment {
    return new TimelineSegment(this, options, props);
  }
}
