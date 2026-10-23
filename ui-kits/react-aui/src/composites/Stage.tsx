import { aria, formatTime, type StageAria } from '@airlib/aria';
import { AUI_CLASS, branded, register } from '@airlib/aui/utils';
import { type AnyType, renderDynamic, Snippet, setup } from '@airlib/react';
import type { Timeline } from '@airlib/react/timeline';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { PauseIcon, PlayArrowIcon } from '../icons/index.js';
import { Button } from '../widgets/Button.js';
import { FullscreenButton } from '../widgets/FullscreenButton.js';

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
  children?: ReactNode | ((stage: StageAria) => ReactNode);
};

const STAGE_ROLE = 'stage';
const RULER_ROLE = 'timeline-ruler';

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
  const stage = aria(STAGE_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.STAGE, { className: props.className }, auiConfig.stage);
  const labels = () => ({ ...LABELS, ...props.labels });

  return () => (
    <div ref={stage.ref} {...stage.restProps([...OMIT_KEYS, 'width', 'height', 'controls', 'labels'] as never)} className={className()}>
      <svg
        className={CLASS.CANVAS}
        viewBox={`0 0 ${props.width ?? 1920} ${props.height ?? 1080}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {renderDynamic(props.children, stage)}
      </svg>
      {props.controls !== false && (
        <div className={`${CLASS.TRANSPORT} ${AUI_CLASS.GLASS_FRAME}`}>
          <Snippet>
            {() => (
              <Button
                variant="text"
                size="sm"
                aria-label={stage.playing ? labels().pause : labels().play}
                onClick={() => stage.toggle()}
              >
                {stage.playing ? <PauseIcon aria-hidden="true" /> : <PlayArrowIcon aria-hidden="true" />}
              </Button>
            )}
          </Snippet>
          <Snippet>
            {() => (
              <span className={CLASS.TIME}>
                {formatTime(stage.time)} / {formatTime(stage.duration)}
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
 * The transport's progress bar: a slider over the composition that seeks the timeline where it's
 * pressed or dragged, its fill following the playhead.
 */
const StageScrubber = setup<{ timeline: Timeline; label: string }>((props) => {
  const ruler = aria(RULER_ROLE, props as AnyType);

  return () => <div ref={ruler.ref} {...ruler.restProps([...OMIT_KEYS] as never)} className={CLASS.SCRUBBER} />;
}, 'StageScrubber');
