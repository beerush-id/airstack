import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, register } from '@airlib/aui/utils';
import { $bind, $static, type AnyType, type Bindable, For, mutable, Snippet, setup, stylex } from '@airlib/react';
import type { Timeline, TimelineSegment, TimelineTrack } from '@airlib/react/timeline';
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import {
  AudioFileIcon,
  AutoAwesomeIcon,
  DraftIcon,
  ImageIcon,
  LockIcon,
  LockOpenIcon,
  MovieIcon,
  TitleIcon,
  VisibilityIcon,
  VisibilityOffIcon,
  VolumeOffIcon,
  VolumeUpIcon,
} from '../icons/index.js';
import { formatTime, holdWhileDragging, playheadSlider } from '../utils/time.js';
import { Toggle } from '../widgets/Toggle.js';
import { ContextMenu } from './ContextMenu.js';
import { Reorder, ReorderHandle, ReorderItem } from './Reorder.js';

export type TimelineEditorSlots = {
  /** Content of each clip, replacing its picture and name. */
  clip: (segment: TimelineSegment, track: TimelineTrack) => ReactNode;
  /** What sits beside the ruler, above the track names: e.g. the playhead's timecode. */
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
  /** Takes focus as it appears, on its first track, so its keys — Space to play — work at once. */
  autofocus?: boolean;
  /**
   * Work under way on a clip, from 0 to 1 — its media buffering, say, or the clip being generated:
   * a bar along the clip fills as it goes, and the clip reads as busy. Nothing while there's none.
   */
  progress?: (segment: TimelineSegment) => number | undefined;
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
  KEYFRAME: branded('timeline-keyframe'),
  HEADERS: branded('timeline-headers'),
  HEADER: branded('timeline-header'),
  HEADER_NAME: branded('timeline-header-name'),
  HEADER_ACTIONS: branded('timeline-header-actions'),
  LANES: branded('timeline-lanes'),
  LANE: branded('timeline-lane'),
  CLIP: branded('timeline-clip'),
  CLIP_NAME: branded('timeline-clip-name'),
  CLIP_EDGE: branded('timeline-clip-edge'),
  CLIP_PROGRESS: branded('timeline-clip-progress'),
  PLAYHEAD: branded('timeline-playhead'),
  PLAYHEAD_HANDLE: branded('timeline-playhead-handle'),
};

type LaneKind = { icon: (props: { 'aria-hidden': 'true' }) => ReactNode; color: string };

/** Lanes by what they carry: their glyph and their role color. */
const LANE_KINDS: Record<string, LaneKind> = {
  video: { icon: MovieIcon, color: 'primary' },
  image: { icon: ImageIcon, color: 'primary' },
  audio: { icon: AudioFileIcon, color: 'info' },
  text: { icon: TitleIcon, color: 'tertiary' },
  effect: { icon: AutoAwesomeIcon, color: 'secondary' },
};

/** Lanes whose clips play their source's time: footage and sound. */
const SOURCED_LANES = new Set(['video', 'audio']);

/** Lanes heard rather than seen: they sit apart, below the pictures, and stack with nothing. */
const SOUND_LANES = new Set(['audio']);

/** Picture lanes whose clips carry their own sound — footage — so they can be muted apart from hidden. */
const VOICED_LANES = new Set(['video']);

/** The two groups of lanes: what's seen, stacked, and what's heard. */
type TrackGroup = 'picture' | 'sound';

/** What's done to a track itself, from its name row's context menu. */
const TRACK_COMMANDS = [
  { name: 'add', label: 'Add track above' },
  { name: 'remove', label: 'Remove track' },
];

/** The groups top to bottom, each named for screen readers. */
const TRACK_GROUPS: { group: TrackGroup; label: string }[] = [
  { group: 'picture', label: 'Picture tracks' },
  { group: 'sound', label: 'Sound tracks' },
];

/** A lane carrying anything else: still marked, so every header reads alike. */
const OTHER_LANE: LaneKind = { icon: DraftIcon, color: 'secondary' };

/**
 * What a lane carries, by its track's type.
 *
 * @param type - The track's type.
 * @returns Its glyph and role color; a plain mark for a type without its own.
 */
const laneKind = (type?: string): LaneKind => LANE_KINDS[type ?? ''] ?? OTHER_LANE;

/**
 * The group a track's lane sits in.
 *
 * @param track - The track.
 * @returns `sound` for lanes heard, `picture` for the rest.
 */
const groupOf = (track: TimelineTrack): TrackGroup => (SOUND_LANES.has(track.type ?? '') ? 'sound' : 'picture');

register('timelineEditor', {});

/**
 * A composition laid out in time: a ruler with the playhead across the top, one lane per track
 * of a core `Timeline`, and each segment as a clip at its place and length — pictures on video
 * and image lanes, a waveform on audio lanes, words on text lanes. The picture lanes stack as the
 * stage does — the timeline's last track, drawn over the rest, is the top row — and the sound lanes
 * sit apart below them; dragging a track by its glyph moves it within its group. Press or drag the ruler to seek; pick a clip by pointer or
 * with the arrows. It holds no time of its own: the timeline does,
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
      locked: (segment) => !!segment.track.meta?.locked,
    }
  );
  // A track's hiding, locking and place aren't observed, so what shows them follows this count of
  // changes. While a track is dragged to a new place, its group's rows follow the order it would
  // drop into.
  const lanes = mutable({ changes: 0, preview: [] as string[], moving: null as string | null });
  // One group's rows as they stand, or as a track being dragged among them would leave them.
  const rows = (group: TrackGroup): TimelineTrack[] => {
    void lanes.changes;
    const all = tracksOf(group);
    if (!lanes.moving || !all.some((track) => track.id === lanes.moving)) return all;
    return lanes.preview.map((id) => all.find((track) => track.id === id)).filter((track) => !!track);
  };
  const ordered = () => [...rows('picture'), ...rows('sound')];
  // The first sound lane, set apart from the pictures above it; nothing when either group is empty.
  const splitAt = () => (tracksOf('picture').length ? tracksOf('sound')[0]?.id : undefined);
  // A group's order, by id, as a value its reorder list binds to: a drop rebuilds the timeline's
  // tracks — the sound first, as it stacks with nothing, then the pictures bottom row first, the
  // order the stage stacks them in — and draws the paused stage again in its new stacking.
  const orderOf = (group: TrackGroup) => ({
    get value() {
      void lanes.changes;
      return tracksOf(group).map((track) => track.id);
    },
    set value(ids: string[]) {
      const moved = ids.map((id) => tracksOf(group).find((track) => track.id === id)).filter((track) => !!track);
      const sound = group === 'sound' ? moved : tracksOf('sound');
      const pictures = group === 'picture' ? moved : tracksOf('picture');
      props.timeline.tracks.clear();
      for (const track of [...sound, ...pictures.reverse()]) props.timeline.tracks.add(track);
      lanes.changes++;
      if (props.timeline.status !== 'playing') void props.timeline.scrub(props.timeline.frame);
    },
  });
  // A track hidden — its `disabled`, so the stage leaves its clips off — or locked — `meta.locked`,
  // so its clips can't be picked or edited — as values a toggle binds to.
  const laneState = (track: TimelineTrack) => ({
    get hidden() {
      void lanes.changes;
      return !!track.disabled;
    },
    set hidden(hidden: boolean) {
      track.disabled = hidden;
      lanes.changes++;
      // The stage draws a frame only as the timeline reaches it; paused, it draws this one again.
      if (props.timeline.status !== 'playing') void props.timeline.scrub(props.timeline.frame);
    },
    get locked() {
      void lanes.changes;
      return !!track.meta?.locked;
    },
    set locked(locked: boolean) {
      (track.meta ??= {}).locked = locked;
      if (locked) pick(picked().filter((id) => ![...track.segments].some((segment) => segment.id === id)));
      lanes.changes++;
    },
    // Muted — `meta.muted` — a track keeps its pictures on the stage but isn't heard.
    get muted() {
      void lanes.changes;
      return !!track.meta?.muted;
    },
    set muted(muted: boolean) {
      (track.meta ??= {}).muted = muted;
      lanes.changes++;
    },
  });
  // Takes a track off the timeline with its clips, letting go of any of them that were picked, and
  // draws the paused stage again without them.
  const removeTrack = (track: TimelineTrack) => {
    const gone = new Set([...track.segments].map((segment) => segment.id));
    if (picked().some((id) => gone.has(id))) pick(picked().filter((id) => !gone.has(id)));
    props.timeline.removeTrack(track);
    lanes.changes++;
    if (props.timeline.status !== 'playing') void props.timeline.scrub(props.timeline.frame);
  };
  // Puts an empty track of the same type in the row above, named by how many of its type there are.
  const addTrackAbove = (track: TimelineTrack) => {
    const type = track.type ?? 'track';
    const count = tracks().filter((other) => other.type === track.type).length;
    const added = props.timeline.addTrack({ type: track.type, name: `${type[0].toUpperCase()}${type.slice(1)} ${count + 1}` });
    const group = groupOf(track);
    const ids = tracksOf(group)
      .map((other) => other.id)
      .filter((id) => id !== added.id);
    ids.splice(ids.indexOf(track.id), 0, added.id);
    orderOf(group).value = ids;
  };
  const clips = aria(CLIPS_ROLE, props as AnyType);
  clips.refine(pointerFocusOnly);
  const className = () => $families(AUI_CLASS.TIMELINE_EDITOR, { className: props.className }, auiConfig.timelineEditor);
  const tracks = () => [...props.timeline.tracks];
  // A group's tracks, top to bottom: pictures first, a later track drawing over an earlier one, so
  // the last is the top row; then sound, which stacks with nothing, in the timeline's order.
  const tracksOf = (group: TrackGroup) =>
    (group === 'sound' ? tracks() : tracks().reverse()).filter((track) => groupOf(track) === group);
  // Focus goes to the first lane once, as the editor appears: rows that re-render, or a track moved
  // to the top, never pull it back from where it is.
  let autofocused = false;
  const focusLane = (lane: HTMLElement | null) => {
    if (!lane || autofocused) return;
    autofocused = true;
    lane.focus({ preventScroll: true });
  };
  // A track's row of names: its glyph — the grip — its name, its lock, its muting when its pictures
  // carry sound, and its hiding.
  const trackHeader = (track: TimelineTrack) => {
    const Icon = laneKind(track.type).icon;
    const state = laneState(track);
    const sound = groupOf(track) === 'sound';
    const voiced = VOICED_LANES.has(track.type ?? '');
    return (
      <ReorderItem value={track.id} label={track.name}>
        <div className={CLASS.HEADER}>
          {/* A secondary click on the track's name row offers what's done to the track itself. */}
          <ContextMenu
            label={`${track.name} track`}
            size="xs"
            items={TRACK_COMMANDS}
            oncommand={(event) => (event.detail === 'add' ? addTrackAbove(track) : removeTrack(track))}
          />
          {/* Drag the glyph, or press it and use the arrows, to move the track within its group. */}
          <ReorderHandle label={`Move ${track.name}`} size="xs" className={AUI_CLASS.CONTROL_ICON}>
            <Icon aria-hidden="true" />
          </ReorderHandle>
          <span className={CLASS.HEADER_NAME}>{track.name}</span>
          <span className={CLASS.HEADER_ACTIONS}>
            <Toggle
              aria-label={`Lock ${track.name}`}
              variant="text"
              size="xs"
              className={AUI_CLASS.CONTROL_ICON}
              pressed={$bind(state, 'locked')}
            >
              {(locked) => (locked ? <LockIcon /> : <LockOpenIcon />)}
            </Toggle>
            {voiced && (
              <Toggle
                aria-label={`Mute ${track.name}`}
                variant="text"
                size="xs"
                className={AUI_CLASS.CONTROL_ICON}
                pressed={$bind(state, 'muted')}
              >
                {(muted) => (muted ? <VolumeOffIcon /> : <VolumeUpIcon />)}
              </Toggle>
            )}
            {/* Leaving a track off the stage hides what's seen and mutes what's heard. */}
            <Toggle
              aria-label={`${sound ? 'Mute' : 'Hide'} ${track.name}`}
              variant="text"
              size="xs"
              className={AUI_CLASS.CONTROL_ICON}
              pressed={$bind(state, 'hidden')}
            >
              {(hidden) =>
                sound ? (
                  hidden ? <VolumeOffIcon /> : <VolumeUpIcon />
                ) : hidden ? (
                  <VisibilityOffIcon />
                ) : (
                  <VisibilityIcon />
                )
              }
            </Toggle>
          </span>
        </div>
      </ReorderItem>
    );
  };

  // Letting go of the picked clip: Escape on a clip, which hands the keys back to its track, or a
  // press on the lanes off the clips; the ruler, the track names and the corner's settings keep it.
  // The press must start there too: a drag let go over the lanes ends in a click there.
  const offPick = (target: EventTarget) => {
    const element = target as Element;
    return !!element.closest(`.${CLASS.LANES}`) && !element.closest('[data-segment]');
  };
  let pressedOff = false;
  const notePress = (event: PointerEvent<HTMLDivElement>) => {
    pressedOff = offPick(event.target);
  };
  // The picked clips' keyframes, as times on the timeline, for the ruler to mark.
  const keyframes = (): number[] => {
    const ids = picked();
    const rate = props.timeline.frameRate;
    return tracks()
      .flatMap((track) => [...track.segments])
      .filter((segment) => ids.includes(segment.id))
      .flatMap((segment) =>
        // Keyframes sit in the clip's content, from its offset and at its speed; a split clip's
        // halves share them, each marking only those within it.
        segment.scenes
          .map((scene) => segment.startFrame + (scene.atFrame - segment.offsetFrame) / segment.speed)
          .filter((frame) => frame >= segment.startFrame && frame <= segment.endFrame)
          .map((frame) => frame / rate)
      );
  };
  const releaseOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !picked().length) return;
    event.preventDefault();
    pick([]);
    (event.target as Element).closest<HTMLElement>('[data-track]')?.focus();
  };
  const releaseOnPress = (event: MouseEvent<HTMLDivElement>) => {
    if (pressedOff && picked().length && offPick(event.target)) pick([]);
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
      onPointerDownCapture={notePress}
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
              keyframes={keyframes}
            />
            {/* The track names in two lists, pictures over sound: a track moves within its own group. */}
            <div className={CLASS.HEADERS}>
              {TRACK_GROUPS.map(
                ({ group, label }) =>
                  tracksOf(group).length > 0 && (
                    <Reorder
                      key={group}
                      label={label}
                      value={$bind(orderOf(group), 'value')}
                      preview={$bind(lanes, 'preview')}
                      active={$bind(lanes, 'moving')}
                    >
                      <For each={() => rows(group)}>{(track) => trackHeader(track)}</For>
                    </Reorder>
                  )
              )}
            </div>
            <div
              ref={clips.ref}
              {...clips.restProps([...OMIT_KEYS, 'timeline', 'zoom', 'playheadLabel', 'snap', 'autofocus', 'progress'] as never)}
              className={CLASS.LANES}
            >
              <For each={ordered}>
                {(track) => (
                  <div
                    ref={props.autofocus && track.id === ordered()[0]?.id ? focusLane : undefined}
                    className={`${CLASS.LANE} ${AUI_CLASS.SCALE}-${laneKind(track.type).color}`}
                    data-type={track.type}
                    data-track={track.id}
                    data-split={track.id === splitAt() || undefined}
                    data-hidden={laneState(track).hidden || undefined}
                    data-locked={laneState(track).locked || undefined}
                    role="group"
                    aria-label={track.name}
                    tabIndex={0}
                  >
                    <For each={() => [...track.segments]}>
                      {(segment) => (
                        <TimelineClip segment={segment} track={track} progress={props.progress}>
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
 * zoom, down to every frame. The picked clips' keyframes are marked along it.
 */
type TimelineRulerProps = {
  timeline: Timeline;
  label?: string;
  zoom: number;
  /** Where a drag to a time puts the playhead, e.g. a point it snaps to. */
  land?: (time: number) => number;
  /** The times to mark as keyframes. */
  keyframes?: () => number[];
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
  const hold = holdWhileDragging(() => props.timeline);
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
        onPointerDownCapture={hold}
      >
        <For each={marks}>
          {(seconds) => (
            <span className={CLASS.TICK} style={stylex({ '--aui-timeline-at': String(seconds) })}>
              {formatTime(seconds)}
            </span>
          )}
        </For>
        <For each={() => props.keyframes?.() ?? []}>
          {(seconds) => <span className={CLASS.KEYFRAME} style={stylex({ '--aui-timeline-at': String(seconds) })} />}
        </For>
      </div>
    </div>
  );
}, 'TimelineRuler');

/**
 * One clip: a segment at its start and length on its lane, pickable like any listbox option.
 * Without content of its own it shows the segment's picture — `meta.thumbnail` — and its name.
 */
type TimelineClipProps = {
  segment: TimelineSegment;
  track: TimelineTrack;
  progress?: (segment: TimelineSegment) => number | undefined;
  children?: ReactNode;
};

const TimelineClip = setup<TimelineClipProps>((props) => {
  // A clip stands for one segment for its whole life; its id is what the selection holds.
  const id = $static(() => props.segment.id);
  const clip = aria(CLIP_ROLE, { value: id } as AnyType);
  const wave = waveform(id);

  return () => {
    const { segment } = props;
    const thumbnail = segment.meta?.thumbnail as string | undefined;
    const progress = props.progress?.(segment);

    return (
      <div
        ref={clip.ref}
        {...clip.restProps([...OMIT_KEYS] as never)}
        aria-label={`${segment.name ?? 'Clip'}, ${formatTime(segment.startTime)} to ${formatTime(segment.startTime + segment.totalTime)}`}
        aria-busy={progress === undefined ? undefined : 'true'}
        className={CLASS.CLIP}
        data-type={props.track.type}
        data-segment={id}
        style={stylex({
          '--aui-timeline-start': String(segment.startTime),
          '--aui-timeline-span': String(segment.totalTime),
          '--aui-timeline-thumbnail': thumbnail ? `url("${thumbnail}")` : undefined,
          '--aui-timeline-wave': props.track.type === 'audio' ? wave : undefined,
          '--aui-timeline-progress': progress === undefined ? undefined : String(progress),
        })}
      >
        {props.children ?? <span className={CLASS.CLIP_NAME}>{segment.name}</span>}
        {progress !== undefined && <span className={CLASS.CLIP_PROGRESS} aria-hidden="true" />}
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
