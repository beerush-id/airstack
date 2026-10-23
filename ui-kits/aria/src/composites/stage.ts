import type { Timeline } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../types.js';
import type { FullscreenHost } from '../widgets/fullscreen.js';

/**
 * Reactive input properties for StageAria.
 */
export interface StageProps extends AriaProps {
  /** Names the stage for screen readers, e.g. "Short drama, episode 3". */
  label?: string;
  /** The composition's timeline: the clock everything on the stage follows. */
  timeline?: Timeline;
  /** How far J and L jump, in seconds. Defaults to 5. */
  jump?: number;
}

/**
 * Compiled HTML and ARIA attributes for a stage.
 */
export interface StageAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'group';
  tabindex?: number;
  'aria-roledescription'?: string;
  'aria-label'?: string;
  'data-playing'?: 'true';
}

/**
 * Headless player for a composition on a core `Timeline`. It holds no time of its own: playing,
 * pausing, and seeking go to the timeline, and whatever draws the stage reads the timeline's
 * state — so a timeline editor, a transport, and an agent all move the same playback. Space and K
 * play and pause, J and L jump, the arrows nudge a second, Home and End go to the ends. It can
 * fill the screen through a full-screen toggle inside it.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class StageAria<E extends BaseElement = HTMLElement>
  extends Aria<E, StageProps, StageAttributes<E>>
  implements FullscreenHost
{
  public readonly fullscreenHost = true as const;

  public constructor(props: Partial<StageProps> = {}) {
    super(props);
    this.omittedAttrs.push('label', 'timeline', 'jump');
    this.update();
  }

  /** Where playback is, in seconds. */
  public get time(): number {
    return this.properties.timeline?.state.time ?? 0;
  }

  /** How long the composition runs, in seconds. */
  public get duration(): number {
    return this.properties.timeline?.state.totalTime ?? 0;
  }

  /** Whether it's playing. */
  public get playing(): boolean {
    return this.properties.timeline?.state.status === 'playing';
  }

  /** Plays from where it is, from the start when it's at the end. */
  public play(): void {
    this.properties.timeline?.play();
  }

  /** Pauses where it is. */
  public pause(): void {
    this.properties.timeline?.pause();
  }

  /** Plays when paused, pauses when playing. */
  public toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  /**
   * Moves playback to `time`.
   *
   * @param time - Where to go, in seconds; the timeline keeps it within the composition.
   */
  public seek(time: number): void {
    this.properties.timeline?.seek(Math.max(0, time));
  }

  protected override createAttributes(): StageAttributes<E> {
    return {
      role: 'group',
      tabindex: 0,
      'aria-roledescription': 'player',
      'aria-label': this.properties.label,
      'data-playing': this.playing ? 'true' : undefined,
      onkeydown: this.handleKey,
    } as StageAttributes<E>;
  }

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.target !== this.element) return;

    const jump = this.properties.jump ?? 5;
    const actions: Record<string, () => void> = {
      ' ': () => this.toggle(),
      k: () => this.toggle(),
      j: () => this.seek(this.time - jump),
      l: () => this.seek(this.time + jump),
      ArrowLeft: () => this.seek(this.time - 1),
      ArrowRight: () => this.seek(this.time + 1),
      Home: () => this.seek(0),
      End: () => this.seek(this.duration),
    };

    const action = actions[event.key];
    if (!action) return;

    event.preventDefault();
    action();
  };
}
