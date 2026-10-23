import type { Timeline } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaProps, BaseElement, DetachFn } from '../types.js';
import { openDragSession } from '../utils/pointer.js';

/**
 * Reactive input properties for TimelineRulerAria.
 */
export interface TimelineRulerProps extends AriaProps {
  /** Names the playhead for screen readers. Defaults to "Playhead". */
  label?: string;
  /** The composition's timeline, whose playhead the ruler moves. */
  timeline?: Timeline;
  /** How far an arrow key moves the playhead, in seconds. Defaults to one frame. */
  step?: number;
}

/**
 * Compiled HTML and ARIA attributes for a timeline ruler.
 */
export interface TimelineRulerAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'slider';
  tabindex?: number;
  'aria-label'?: string;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuenow'?: number;
  'aria-valuetext'?: string;
}

/**
 * Headless timeline ruler: the playhead of a core `Timeline` as a slider over the composition's
 * length. Pressing or dragging along the ruler seeks the timeline there; the arrows nudge it by
 * `step`, Page Up and Page Down by a second, Home and End go to the ends. The ruler spans the
 * whole composition, so a point on it maps straight to a time, however far the editor is zoomed
 * or scrolled.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class TimelineRulerAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  TimelineRulerProps,
  TimelineRulerAttributes<E>
> {
  private closeDrag?: () => void;

  public constructor(props: Partial<TimelineRulerProps> = {}) {
    super(props);
    this.omittedAttrs.push('label', 'timeline', 'step');
    this.update();
  }

  /** Where the playhead is, in seconds. */
  public get time(): number {
    return this.properties.timeline?.state.time ?? 0;
  }

  /** How long the composition runs, in seconds. */
  public get duration(): number {
    return this.properties.timeline?.state.totalTime ?? 0;
  }

  /**
   * Moves the playhead to `time`.
   *
   * @param time - Where to put it, in seconds; the timeline keeps it within the composition.
   */
  public seek(time: number): void {
    this.properties.timeline?.seek(Math.max(0, time));
  }

  protected override createAttributes(): TimelineRulerAttributes<E> {
    const duration = this.duration;

    return {
      role: 'slider',
      // How far along the playhead is, 0 to 1, for a fill or a handle to follow.
      style: { '--aria-timeline-progress': String(duration > 0 ? this.time / duration : 0) },
      tabindex: 0,
      'aria-label': this.properties.label ?? 'Playhead',
      'aria-valuemin': 0,
      'aria-valuemax': Number(this.duration.toFixed(2)),
      'aria-valuenow': Number(this.time.toFixed(2)),
      'aria-valuetext': formatTime(this.time),
      onkeydown: this.handleKey,
      onpointerdown: this.handlePointerDown,
    } as TimelineRulerAttributes<E>;
  }

  protected override attach(): DetachFn | void {
    return () => this.closeDrag?.();
  }

  private get frameStep(): number {
    return this.properties.step ?? 1 / (this.properties.timeline?.frameRate ?? 30);
  }

  private timeAt(clientX: number): number {
    const box = (this.element as unknown as HTMLElement | null)?.getBoundingClientRect();
    if (!box || box.width === 0) return this.time;
    return ((clientX - box.left) / box.width) * this.duration;
  }

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;

    const step = this.frameStep;
    const actions: Record<string, () => void> = {
      ArrowRight: () => this.seek(this.time + step),
      ArrowUp: () => this.seek(this.time + step),
      ArrowLeft: () => this.seek(this.time - step),
      ArrowDown: () => this.seek(this.time - step),
      PageUp: () => this.seek(this.time + 1),
      PageDown: () => this.seek(this.time - 1),
      Home: () => this.seek(0),
      End: () => this.seek(this.duration),
    };

    const action = actions[event.key];
    if (!action) return;

    event.preventDefault();
    action();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || event.defaultPrevented) return;

    this.seek(this.timeAt(event.clientX));
    this.closeDrag = openDragSession({
      onMove: (move) => this.seek(this.timeAt(move.clientX)),
      onUp: () => undefined,
      onCancel: () => undefined,
    });
  };
}

/**
 * A time as people read it on a player: minutes and seconds, with hours once there are any.
 *
 * @param seconds - The time, in seconds.
 * @returns The time as `m:ss` or `h:mm:ss`.
 */
export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
