import { aria, type VideoClipFrame, type VideoStageAria } from '@airlib/aria';
import { AUI_CLASS, branded, register } from '@airlib/aui/utils';
import { $static, type AnyType, renderDynamic, setup, Snippet } from '@airlib/react';
import type { Timeline, TimelineSegment } from '@airlib/react/timeline';
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { PauseIcon, PlayArrowIcon } from '../icons/index.js';
import { formatTime, playheadSlider } from '../utils/time.js';
import { Button } from '../widgets/Button.js';
import { FullscreenButton } from '../widgets/FullscreenButton.js';
import { fullscreenHostCtx } from '../widgets/index.js';

/** Names of the transport's controls, for screen readers. */
export type StageLabels = {
  play?: string;
  pause?: string;
  seek?: string;
  fullscreen?: string;
};

export type StageProps = ComponentStyles & {
  id?: string;
  /** Names the stage for screen readers, e.g. "Short drama, episode 3". */
  label?: string;
  /** The composition's timeline: playback, seeking, and the frames the clips follow. */
  timeline: Timeline;
  /** The composition's width in its own units; clips are placed in these. Defaults to 1920. */
  width?: number;
  /** The composition's height in its own units. Defaults to 1080. */
  height?: number;
  /**
   * Draw the clips into a canvas every frame, so each frame can be read back, e.g. to render the
   * video. Needs HTML-in-Canvas (`canCaptureVideo()`); without it the clips are shown as they are.
   */
  capture?: boolean;
  /** Whether the transport shows under the picture. Defaults to true. */
  controls?: boolean;
  /** How far J and L jump, in seconds. */
  jump?: number;
  labels?: StageLabels;
  /** Receives the stage's behavior once, e.g. to render a capturing stage with `renderVideo`. */
  controller?: (stage: VideoStageAria) => void;
  /** The composition's clips, as `StageClip`s, track by track; they draw in the order written. */
  children?: ReactNode | ((timeline: Timeline) => ReactNode);
};

/** The elements a clip can be: a box of HTML, an SVG drawing, a canvas to paint, or media. */
export type StageClipKind = 'div' | 'svg' | 'canvas' | 'img' | 'video' | 'audio';

export type StageClipProps<P extends Record<string, AnyType> = Record<string, AnyType>> = Omit<
  HTMLAttributes<HTMLElement>,
  'children'
> & {
  /** The segment this clip draws: when it shows, and its motion. */
  segment: TimelineSegment<P>;
  /** The element the clip is. Defaults to `div`. */
  as?: StageClipKind;
  /** Seconds into its media a media clip starts at. */
  offset?: number;
  /** Updates the clip's own content each frame, beyond its motion; may return a promise to wait for. */
  draw?: (frame: VideoClipFrame<P>) => unknown;
  /** Media and image source. */
  src?: string;
  /** Lets media and images from another origin be read back while capturing. */
  crossOrigin?: '' | 'anonymous' | 'use-credentials';
  /** Mutes a media clip. */
  muted?: boolean;
  /** An SVG clip's own coordinate box. */
  viewBox?: string;
  /** An image clip's description. */
  alt?: string;
  children?: ReactNode;
};

const SLIDER_ROLE = 'slider';
const STAGE_ROLE = 'video-stage';
const CLIP_ROLE = 'video-clip';
const CLIP_OMIT_KEYS = [...OMIT_KEYS, 'segment', 'as', 'offset', 'draw'] as never[];

const CLASS = {
  CANVAS: branded('stage-canvas'),
  CLIP: branded('stage-clip'),
  TRANSPORT: branded('stage-transport'),
  TIME: branded('stage-time'),
  SCRUBBER: branded('stage-scrubber'),
};

const LABELS: Required<StageLabels> = {
  play: 'Play',
  pause: 'Pause',
  seek: 'Seek',
  fullscreen: 'Full screen',
};

register('stage', {});

/**
 * A composition on screen: its clips in a fixed frame — 1920 by 1080 unless told otherwise —
 * that scales to any box without moving anything inside it, played by a core `Timeline`. Each
 * clip follows its segment frame by frame without re-rendering: it shows while the segment is on
 * and moves by its keyframes. The transport under it plays, pauses, seeks, and fills the screen;
 * the stage itself takes Space, K, J, L, the arrows, Home and End. With `capture`, the clips are
 * drawn into a canvas each frame, so the composition can be rendered to a video.
 */
export const Stage = setup<StageProps>((props) => {
  const className = () => $families(AUI_CLASS.STAGE, { className: props.className }, auiConfig.stage);
  const labels = () => ({ ...LABELS, ...props.labels });
  const capture = $static(() => !!props.capture);
  const stage = aria(STAGE_ROLE, props as AnyType, { timeline: $static(() => props.timeline), capture });
  let root: HTMLDivElement | null = null;

  // The stage is what its fullscreen button fills the screen with.
  fullscreenHostCtx.set(() => root);
  $static(() => props.controller)?.(stage as never);

  const playing = () => props.timeline.state.status === 'playing';
  // Playback starts once every clip has loaded, so nothing shows up blank mid-play.
  const toggle = () => (playing() ? props.timeline.pause() : stage.ready().then(() => props.timeline.play()));
  const seek = (time: number) => props.timeline.seek(Math.max(0, time));

  // The player's keys, while the stage itself has focus: its controls keep their own.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.target !== event.currentTarget) return;
    const { time, totalTime } = props.timeline.state;
    const jump = props.jump ?? 5;
    const actions: Record<string, () => void> = {
      ' ': toggle,
      k: toggle,
      j: () => seek(time - jump),
      l: () => seek(time + jump),
      ArrowLeft: () => seek(time - 1),
      ArrowRight: () => seek(time + 1),
      Home: () => seek(0),
      End: () => seek(totalTime),
    };

    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return () => {
    const clips = renderDynamic(props.children, props.timeline);
    const surface = stage.attributes;

    return (
      <div
        ref={(element) => {
          root = element;
        }}
        id={props.id}
        role="group"
        tabIndex={0}
        aria-roledescription="player"
        aria-label={props.label}
        data-playing={playing() ? 'true' : undefined}
        className={className()}
        onKeyDown={handleKeyDown}
      >
        {capture ? (
          <canvas ref={stage.ref as never} {...(surface as AnyType)} className={CLASS.CANVAS}>
            {clips}
          </canvas>
        ) : (
          <div ref={stage.ref as never} {...(surface as AnyType)} className={CLASS.CANVAS}>
            {clips}
          </div>
        )}
        {props.controls !== false && (
          <div className={`${CLASS.TRANSPORT} ${AUI_CLASS.GLASS_FRAME}`}>
            <Snippet>
              {() => (
                <Button variant="text" size="sm" aria-label={playing() ? labels().pause : labels().play} onClick={toggle}>
                  {playing() ? <PauseIcon aria-hidden="true" /> : <PlayArrowIcon aria-hidden="true" />}
                </Button>
              )}
            </Snippet>
            <Snippet>
              {() => (
                <span className={CLASS.TIME}>
                  {formatTime(props.timeline.state.time)} / {formatTime(props.timeline.state.totalTime)}
                </span>
              )}
            </Snippet>
            <StageScrubber timeline={props.timeline} label={labels().seek} />
            <FullscreenButton label={labels().fullscreen} />
          </div>
        )}
      </div>
    );
  };
}, 'Stage');

/**
 * One clip of a stage, bound to one timeline segment: a box of HTML by default, or an SVG
 * drawing, a canvas, an image, or media. It is rendered once; from then on its segment moves it
 * frame by frame — shown while the segment is on, placed and moved by its keyframes — and media
 * follows the timeline. What's inside it is yours: render it as children, and update it each frame
 * through `draw` when it changes over time.
 */
export const StageClip = setup<StageClipProps>((props) => {
  const clip = aria(CLIP_ROLE, props as AnyType, {
    segment: $static(() => props.segment),
    draw: (frame: VideoClipFrame) => props.draw?.(frame),
  });

  return () => {
    const Tag = (props.as ?? 'div') as 'div';
    const className = props.className ? `${CLASS.CLIP} ${props.className}` : CLASS.CLIP;
    return (
      <Tag ref={clip.ref as never} {...(clip.restProps(CLIP_OMIT_KEYS) as AnyType)} className={className}>
        {props.children}
      </Tag>
    );
  };
}, 'StageClip');

/**
 * The transport's progress bar: the playhead's slider, its fill following it; pressing or dragging
 * seeks the timeline there.
 */
const StageScrubber = setup<{ timeline: Timeline; label: string }>((props) => {
  const scrubber = aria(SLIDER_ROLE, playheadSlider(() => props.timeline));

  return () => (
    <div
      ref={scrubber.ref}
      {...scrubber.restProps([...OMIT_KEYS] as never)}
      aria-label={props.label}
      className={CLASS.SCRUBBER}
    />
  );
}, 'StageScrubber');
