import { aria, formatTime } from '@airlib/aria';
import { AUI_CLASS, branded, register } from '@airlib/aui/utils';
import { $static, type AnyType, type Bindable, For, Snippet, setup, stylex } from '@airlib/react';
import type { Timeline, TimelineSegment, TimelineTrack } from '@airlib/react/timeline';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { AudioFileIcon, FormatAlignLeftIcon, ImageIcon, MovieIcon } from '../icons/index.js';

export type TimelineEditorSlots = {
  /** Content of each clip, replacing its picture and name. */
  clip: (segment: TimelineSegment, track: TimelineTrack) => ReactNode;
};

export type TimelineEditorProps = ComponentStyles & {
  id?: string;
  /** Names the clips for screen readers, e.g. "Clips in Short drama". */
  label?: string;
  /** The composition's timeline: its tracks become lanes, its segments clips. */
  timeline: Timeline;
  /** How wide one second is, in pixels. Defaults to 48. */
  zoom?: number;
  /** The picked clip: its segment's `id`. */
  value?: Bindable<string>;
  /** Names the playhead for screen readers. */
  playheadLabel?: string;
  onchange?: (event: CustomEvent<string>) => void;
};

const CLIPS_ROLE = 'listbox';
const CLIP_ROLE = 'option';
const RULER_ROLE = 'timeline-ruler';

const CLASS = {
  BODY: branded('timeline-body'),
  CORNER: branded('timeline-corner'),
  RULER: branded('timeline-ruler'),
  TICK: branded('timeline-tick'),
  HEADERS: branded('timeline-headers'),
  HEADER: branded('timeline-header'),
  LANES: branded('timeline-lanes'),
  LANE: branded('timeline-lane'),
  CLIP: branded('timeline-clip'),
  CLIP_NAME: branded('timeline-clip-name'),
  PLAYHEAD: branded('timeline-playhead'),
};

/** Lanes by what they carry: their glyph and their role color. */
const LANE_KINDS: Record<string, { icon: (props: { 'aria-hidden': 'true' }) => ReactNode; color: string }> = {
  video: { icon: MovieIcon, color: 'primary' },
  image: { icon: ImageIcon, color: 'primary' },
  audio: { icon: AudioFileIcon, color: 'info' },
  text: { icon: FormatAlignLeftIcon, color: 'tertiary' },
};

register('timelineEditor', {});

/**
 * A composition laid out in time: a ruler with the playhead across the top, one lane per track
 * of a core `Timeline`, and each segment as a clip at its place and length — pictures on video
 * and image lanes, a waveform on audio lanes, words on text lanes. Press or drag the ruler to
 * seek; pick a clip by pointer or with the arrows. It holds no time of its own: the timeline does,
 * so a stage playing the same timeline moves the playhead here, and this playhead moves the stage.
 */
export const TimelineEditor = setup<TimelineEditorProps, TimelineEditorSlots>((props, slots) => {
  const clips = aria(CLIPS_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TIMELINE_EDITOR, { className: props.className }, auiConfig.timelineEditor);
  const zoom = () => props.zoom ?? 48;
  const tracks = () => [...props.timeline.tracks];

  return () => (
    <div className={className()} style={stylex({ '--aui-timeline-zoom': `${zoom()}px` })}>
      <Snippet>
        {() => (
          <div className={CLASS.BODY} style={stylex({ '--aui-timeline-length': String(props.timeline.state.totalTime) })}>
            <div className={CLASS.CORNER} />
            <TimelineRuler timeline={props.timeline} label={props.playheadLabel} zoom={zoom()} />
            <div className={CLASS.HEADERS}>
              <For each={tracks}>
                {(track) => {
                  const kind = LANE_KINDS[track.type ?? ''];
                  const Icon = kind?.icon;
                  return (
                    <div className={CLASS.HEADER}>
                      {Icon && <Icon aria-hidden="true" />}
                      <span>{track.name}</span>
                    </div>
                  );
                }}
              </For>
            </div>
            <div
              ref={clips.ref}
              {...clips.restProps([...OMIT_KEYS, 'timeline', 'zoom', 'playheadLabel'] as never)}
              className={CLASS.LANES}
            >
              <For each={tracks}>
                {(track) => (
                  <div className={`${CLASS.LANE} ${AUI_CLASS.SCALE}-${LANE_KINDS[track.type ?? '']?.color ?? 'secondary'}`} data-type={track.type}>
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
              <Snippet>
                {() => (
                  <div className={CLASS.PLAYHEAD} style={stylex({ '--aui-timeline-time': String(props.timeline.state.time) })} />
                )}
              </Snippet>
            </div>
          </div>
        )}
      </Snippet>
    </div>
  );
}, 'TimelineEditor');

/**
 * The ruler: the playhead's slider, with a tick each second and a time every few seconds, as
 * many as keep the times apart at this zoom.
 */
const TimelineRuler = setup<{ timeline: Timeline; label?: string; zoom: number }>((props) => {
  const ruler = aria(RULER_ROLE, props as AnyType);
  const every = () => [1, 2, 5, 10, 15, 30, 60].find((seconds) => seconds * props.zoom >= 64) ?? 60;
  const marks = () =>
    Array.from({ length: Math.floor(props.timeline.state.totalTime / every()) + 1 }, (_, index) => index * every());

  return () => (
    <div
      ref={ruler.ref}
      {...ruler.restProps([...OMIT_KEYS, 'zoom'] as never)}
      className={CLASS.RULER}
      style={stylex({ '--aui-timeline-every': String(every()) })}
    >
      <For each={marks}>
        {(seconds) => (
          <span className={CLASS.TICK} style={stylex({ '--aui-timeline-at': String(seconds) })}>
            {formatTime(seconds)}
          </span>
        )}
      </For>
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
        style={stylex({
          '--aui-timeline-start': String(segment.startTime),
          '--aui-timeline-span': String(segment.totalTime),
          '--aui-timeline-thumbnail': thumbnail ? `url("${thumbnail}")` : undefined,
          '--aui-timeline-wave': props.track.type === 'audio' ? wave : undefined,
        })}
      >
        {props.children ?? <span className={CLASS.CLIP_NAME}>{segment.name}</span>}
      </div>
    );
  };
}, 'TimelineClip');

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
