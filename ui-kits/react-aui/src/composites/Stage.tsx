import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, register } from '@airlib/aui/utils';
import { renderDynamic, setup, Snippet } from '@airlib/react';
import type { Timeline } from '@airlib/react/timeline';
import type { KeyboardEvent, ReactNode } from 'react';
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
  /** The composition's timeline: playback, seeking, and the time the layers follow. */
  timeline: Timeline;
  /** The composition's width in its own units; layers are placed in these. Defaults to 1920. */
  width?: number;
  /** The composition's height in its own units. Defaults to 1080. */
  height?: number;
  /** Whether the transport shows under the picture. Defaults to true. */
  controls?: boolean;
  /** How far J and L jump, in seconds. */
  jump?: number;
  labels?: StageLabels;
  /** The composition's layers, as SVG, placed in `width` by `height` units. */
  children?: ReactNode | ((timeline: Timeline) => ReactNode);
};

const SLIDER_ROLE = 'slider';

const CLASS = {
  CANVAS: branded('stage-canvas'),
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
 * A composition on screen: SVG layers in a fixed frame — 1920 by 1080 unless told otherwise —
 * that scales to any box without moving anything inside it, played by a core `Timeline`. The
 * transport under it plays, pauses, seeks, and fills the screen; the stage itself takes Space,
 * K, J, L, the arrows, Home and End. Nothing here advances time: the timeline does, and the
 * layers — drawn by you, or by GSAP seeked to the timeline — follow it.
 */
export const Stage = setup<StageProps>((props) => {
  const className = () => $families(AUI_CLASS.STAGE, { className: props.className }, auiConfig.stage);
  const labels = () => ({ ...LABELS, ...props.labels });
  let root: HTMLDivElement | null = null;

  // The stage is what its fullscreen button fills the screen with.
  fullscreenHostCtx.set(() => root);

  const playing = () => props.timeline.state.status === 'playing';
  const toggle = () => (playing() ? props.timeline.pause() : props.timeline.play());
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

  return () => (
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
      <svg
        className={CLASS.CANVAS}
        viewBox={`0 0 ${props.width ?? 1920} ${props.height ?? 1080}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {renderDynamic(props.children, props.timeline)}
      </svg>
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
}, 'Stage');

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
