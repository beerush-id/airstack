import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, register } from '@airlib/aui/utils';
import { $static, type AnyType, type Bindable, For, Snippet, setup, stylex } from '@airlib/react';
import type { Timeline, TimelineSegment, TimelineTrack } from '@airlib/react/timeline';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { AudioFileIcon, AutoAwesomeIcon, DraftIcon, FormatAlignLeftIcon, ImageIcon, MovieIcon } from '../icons/index.js';
import { formatTime, playheadSlider } from '../utils/time.js';

export type TimelineEditorSlots = {
  /** Content of each clip, replacing its picture and name. */
  clip: (segment: TimelineSegment, track: TimelineTrack) => ReactNode;
  /** What sits beside the ruler, above the track names: the timeline's own settings, e.g. snapping. */
  corner: () => ReactNode;
};

export type TimelineEditorProps = ComponentStyles & {
  id?: string;
  /** Names the clips for screen readers, e.g. "Clips in Short drama". */
  label?: string;
  /** The composition's timeline: its tracks become lanes, its segments clips. */
  timeline: Timeline;
  /** How wide one second is, in pixels. Defaults to 48. */
  zoom?: number;
  /** The picked clip, by its segment's `id`; with `multiple`, the picked clips' ids. */
  value?: Bindable<string | string[]>;
  /**
   * Whether several clips can be picked at once: Cmd or Ctrl adds or drops one, Shift picks a run
   * along one track. The value is then a list.
   */
  multiple?: boolean;
  /** Names the playhead for screen readers. */
  playheadLabel?: string;
  /**
   * Whether drags snap: a clip's start or end to the other clips' edges, the playhead, and the
   * start; the playhead to clip edges, keyframes and markers; either to a whole second when
   * nothing else is near. Off by default.
   */
  snap?: boolean;
  /** Hears the pick change: the value as it is now. */
  onchange?: (event: CustomEvent<string | string[]>) => void;
};

const CLIPS_ROLE = 'listbox';
const CLIP_ROLE = 'option';
const SLIDER_ROLE = 'slider';
const TIMELINE_ROLE = 'video-timeline';

/** How often the ruler may name a time, in seconds, and how close, in pixels, two times may sit. */
const TIME_STEPS = [1, 2, 5, 10, 15, 30, 60];
const TIME_GAP = 48;

/** How close, in pixels, two of the ruler's frame ticks may sit. */
const TICK_GAP = 6;

/** Takes a part out of the Tab order, over the stop its behavior gives it: it takes focus by pointer only. */
const pointerFocusOnly = () => ({ tabindex: -1 }) as never;

const CLASS = {
  BODY: branded('timeline-body'),
  CORNER: branded('timeline-corner'),
  RULER: branded('timeline-ruler'),
  SCRUB: branded('timeline-scrub'),
  TICK: branded('timeline-tick'),
  HEADERS: branded('timeline-headers'),
  HEADER: branded('timeline-header'),
  LANES: branded('timeline-lanes'),
  LANE: branded('timeline-lane'),
  CLIP: branded('timeline-clip'),
  CLIP_NAME: branded('timeline-clip-name'),
  CLIP_EDGE: branded('timeline-clip-edge'),
  PLAYHEAD: branded('timeline-playhead'),
  PLAYHEAD_HANDLE: branded('timeline-playhead-handle'),
};

type LaneKind = { icon: (props: { 'aria-hidden': 'true' }) => ReactNode; color: string };

/** Lanes by what they carry: their glyph and their role color. */
const LANE_KINDS: Record<string, LaneKind> = {
  video: { icon: MovieIcon, color: 'primary' },
  image: { icon: ImageIcon, color: 'primary' },
  audio: { icon: AudioFileIcon, color: 'info' },
  text: { icon: FormatAlignLeftIcon, color: 'tertiary' },
  effect: { icon: AutoAwesomeIcon, color: 'secondary' },
};

/** Lanes whose clips play their source's time: footage and sound. */
const SOURCED_LANES = new Set(['video', 'audio']);

/** A lane carrying anything else: still marked, so every header reads alike. */
const OTHER_LANE: LaneKind = { icon: DraftIcon, color: 'secondary' };

/**
 * What a lane carries, by its track's type.
 *
 * @param type - The track's type.
 * @returns Its glyph and role color; a plain mark for a type without its own.
 */
const laneKind = (type?: string): LaneKind => LANE_KINDS[type ?? ''] ?? OTHER_LANE;

register('timelineEditor', {});

/**
 * A composition laid out in time: a ruler with the playhead across the top, one lane per track
 * of a core `Timeline`, and each segment as a clip at its place and length — pictures on video
 * and image lanes, a waveform on audio lanes, words on text lanes. Press or drag the ruler to
 * seek; pick a clip by pointer or with the arrows. It holds no time of its own: the timeline does,
 * so a stage playing the same timeline moves the playhead here, and this playhead moves the stage.
 */
export const TimelineEditor = setup<TimelineEditorProps, TimelineEditorSlots>((props, slots) => {
  const zoom = () => props.zoom ?? 48;
  // The editor carries the timeline's time and length as CSS variables, rewritten each frame
  // without a render: the playhead, the scrub, and the lanes' extent all read them. It also drags
  // the clips along the time, at this zoom.
  // The picked clips' ids, however the value holds them; picking writes them back as the value
  // holds them — all of them with `multiple`, otherwise the last — and says so.
  const picked = (): string[] => {
    const value = props.value as string | string[] | undefined;
    return Array.isArray(value) ? value : value ? [value] : [];
  };
  const pick = (ids: string[]) => {
    const value = props.multiple ? ids : (ids.at(-1) ?? '');
    props.value = value;
    props.onchange?.(new CustomEvent('change', { detail: value }));
  };
  const root = aria(
    TIMELINE_ROLE,
    {
      get zoom() {
        return zoom();
      },
      get snap() {
        return !!props.snap;
      },
      get multiple() {
        return !!props.multiple;
      },
    },
    {
      timeline: $static(() => props.timeline),
      selection: { get: picked, set: pick },
      // Footage and sound play their source's time, so trimming their head cuts into it.
      sourced: (segment) => SOURCED_LANES.has(segment.track.type ?? ''),
    }
  );
  const clips = aria(CLIPS_ROLE, props as AnyType);
  clips.refine(pointerFocusOnly);
  const className = () => $families(AUI_CLASS.TIMELINE_EDITOR, { className: props.className }, auiConfig.timelineEditor);
  const tracks = () => [...props.timeline.tracks];

  // Letting go of the picked clip: Escape on a clip, which hands the keys back to its track, or a
  // press anywhere off the clips and the ruler, which seeks without dropping the pick.
  const releaseOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !picked().length) return;
    event.preventDefault();
    pick([]);
    (event.target as Element).closest<HTMLElement>('[data-track]')?.focus();
  };
  const releaseOnPress = (event: MouseEvent<HTMLDivElement>) => {
    if (picked().length && !(event.target as Element).closest(`[data-segment], .${CLASS.RULER}`)) pick([]);
  };

  // Each track is a Tab stop, where the keys move the playhead and Up and Down pick its clips; the
  // picked clip is one too, right after its track. The lanes' list, the ruler and the editor itself
  // take focus only by pointer.
  return () => (
    <div
      ref={root.ref}
      className={className()}
      style={stylex({ '--aui-timeline-zoom': `${zoom()}px` })}
      tabIndex={-1}
      onKeyDown={releaseOnEscape}
      onClick={releaseOnPress}
    >
      <Snippet>
        {() => (
          <div className={CLASS.BODY}>
            <div className={CLASS.CORNER}>{slots.corner?.()}</div>
            <TimelineRuler
              timeline={props.timeline}
              label={props.playheadLabel}
              zoom={zoom()}
              land={(time) => root.snapTime(time)}
            />
            <div className={CLASS.HEADERS}>
              <For each={tracks}>
                {(track) => {
                  const Icon = laneKind(track.type).icon;
                  return (
                    <div className={CLASS.HEADER}>
                      <Icon aria-hidden="true" />
                      <span>{track.name}</span>
                    </div>
                  );
                }}
              </For>
            </div>
            <div
              ref={clips.ref}
              {...clips.restProps([...OMIT_KEYS, 'timeline', 'zoom', 'playheadLabel', 'snap'] as never)}
              className={CLASS.LANES}
            >
              <For each={tracks}>
                {(track) => (
                  <div
                    className={`${CLASS.LANE} ${AUI_CLASS.SCALE}-${laneKind(track.type).color}`}
                    data-type={track.type}
                    data-track={track.id}
                    role="group"
                    aria-label={track.name}
                    tabIndex={0}
                  >
                    <For each={() => [...track.segments]}>
                      {(segment) => (
                        <TimelineClip segment={segment} track={track}>
                          {slots.clip?.(segment, track)}
                        </TimelineClip>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
            {/* One playhead over the ruler and the lanes, its handle and line moving as one. */}
            <div className={CLASS.PLAYHEAD} aria-hidden="true">
              <span className={CLASS.PLAYHEAD_HANDLE} />
            </div>
          </div>
        )}
      </Snippet>
    </div>
  );
}, 'TimelineEditor');

/**
 * The ruler: the playhead's slider, with a time every second — or every few, when seconds are too
 * close to name — and ticks between them every few frames, as few as keep the ticks apart at this
 * zoom, down to every frame.
 */
type TimelineRulerProps = {
  timeline: Timeline;
  label?: string;
  zoom: number;
  /** Where a drag to a time puts the playhead, e.g. a point it snaps to. */
  land?: (time: number) => number;
};

const TimelineRuler = setup<TimelineRulerProps>((props) => {
  // The ruler's ticks run as wide as the lanes, but only its scrub is the playhead's slider, and
  // the scrub is exactly as long as the composition: a point on it is a time at any zoom, under
  // the same point on the lanes, however much wider than the clips the lanes are drawn.
  const scrub = aria(
    SLIDER_ROLE,
    playheadSlider(
      () => props.timeline,
      (time) => props.land?.(time) ?? time
    )
  );
  // The editor takes the playhead's keys itself, so the scrub is for the pointer alone.
  scrub.refine(pointerFocusOnly);
  const every = () => TIME_STEPS.find((seconds) => seconds * props.zoom >= TIME_GAP) ?? TIME_STEPS.at(-1)!;
  // Frames go in steps that divide a second, so every second lands on a tick.
  const minor = () => {
    const rate = props.timeline.frameRate;
    const frames = divisors(rate).find((step) => (step / rate) * props.zoom >= TICK_GAP) ?? rate;
    return frames / rate;
  };
  const marks = () =>
    Array.from({ length: Math.floor(props.timeline.state.totalTime / every()) + 1 }, (_, index) => index * every());

  return () => (
    <div
      className={CLASS.RULER}
      style={stylex({ '--aui-timeline-every': String(every()), '--aui-timeline-minor': String(minor()) })}
    >
      <div
        ref={scrub.ref}
        {...scrub.restProps([...OMIT_KEYS] as never)}
        aria-label={props.label ?? 'Playhead'}
        className={CLASS.SCRUB}
      >
        <For each={marks}>
          {(seconds) => (
            <span className={CLASS.TICK} style={stylex({ '--aui-timeline-at': String(seconds) })}>
              {formatTime(seconds)}
            </span>
          )}
        </For>
      </div>
    </div>
  );
}, 'TimelineRuler');

/**
 * One clip: a segment at its start and length on its lane, pickable like any listbox option.
 * Without content of its own it shows the segment's picture — `meta.thumbnail` — and its name.
 */
const TimelineClip = setup<{ segment: TimelineSegment; track: TimelineTrack; children?: ReactNode }>((props) => {
  // A clip stands for one segment for its whole life; its id is what the selection holds.
  const id = $static(() => props.segment.id);
  const clip = aria(CLIP_ROLE, { value: id } as AnyType);
  const wave = waveform(id);

  return () => {
    const { segment } = props;
    const thumbnail = segment.meta?.thumbnail as string | undefined;

    return (
      <div
        ref={clip.ref}
        {...clip.restProps([...OMIT_KEYS] as never)}
        aria-label={`${segment.name ?? 'Clip'}, ${formatTime(segment.startTime)} to ${formatTime(segment.startTime + segment.totalTime)}`}
        className={CLASS.CLIP}
        data-type={props.track.type}
        data-segment={id}
        style={stylex({
          '--aui-timeline-start': String(segment.startTime),
          '--aui-timeline-span': String(segment.totalTime),
          '--aui-timeline-thumbnail': thumbnail ? `url("${thumbnail}")` : undefined,
          '--aui-timeline-wave': props.track.type === 'audio' ? wave : undefined,
        })}
      >
        {props.children ?? <span className={CLASS.CLIP_NAME}>{segment.name}</span>}
        {/* Its edges, to resize it from either end. */}
        <span className={CLASS.CLIP_EDGE} data-edge="start" aria-hidden="true" />
        <span className={CLASS.CLIP_EDGE} data-edge="end" aria-hidden="true" />
      </div>
    );
  };
}, 'TimelineClip');

/**
 * The frame steps that divide a second evenly, smallest first.
 *
 * @param rate - Frames in a second.
 * @returns Every step that divides it, e.g. 1, 2, 3, 5, 6, 10, 15, 30 at 30fps.
 */
function divisors(rate: number): number[] {
  return Array.from({ length: rate }, (_, index) => index + 1).filter((step) => rate % step === 0);
}

/**
 * A waveform-like strip for an audio clip, as a CSS image to mask with: bars of varying height,
 * the same for the same clip every time, so a clip keeps its look as the editor redraws.
 *
 * @param seed - What makes the strip this clip's own, e.g. the segment's id.
 * @returns The strip as a `url()` of an SVG, 160 units wide, to repeat along the clip.
 */
function waveform(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;

  const bars: string[] = [];
  for (let x = 0; x < 160; x += 4) {
    hash = (hash * 1103515245 + 12345) | 0;
    const height = 6 + (Math.abs(hash) % 30);
    bars.push(`M${x} ${20 - height / 2}h2v${height}h-2z`);
  }

  return `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40" preserveAspectRatio="none"><path d="${bars.join('')}"/></svg>`
  )}")`;
}
