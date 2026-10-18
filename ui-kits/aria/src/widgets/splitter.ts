import type {
  AriaAttributes,
  AriaEvent,
  AriaEventHandler,
  AriaOptions,
  BaseElement,
  DetachFn,
  Orientation,
} from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';
import { openDragSession } from '../utils/pointer.js';
import { axisRatio, clampRange } from '../utils/range.js';
import { DividerAria, type DividerProps } from './divider.js';

/**
 * Controller-dispatched splitter event carrying the committed partition in `detail`.
 */
export type SplitterEvent = AriaEvent<number>;

/**
 * Reactive input properties for SplitterAria.
 */
export interface SplitterProps extends DividerProps {
  /**
   * Called with the committed size after each drag move or key step.
   */
  oninput?: AriaEventHandler<SplitterEvent>;

  /**
   * Called with the committed size when the interaction ends.
   */
  onchange?: AriaEventHandler<SplitterEvent>;
  /**
   * Current partition position in percentage points.
   */
  value?: number;

  /**
   * Minimum partition position (defaults to 0).
   */
  min?: number;

  /**
   * Maximum partition position (defaults to 100).
   */
  max?: number;

  /**
   * Increment applied per arrow keystroke (defaults to 1).
   */
  step?: number;

  /**
   * Accessible handle name identifying the resized pane.
   */
  label?: string;

  /**
   * Resize-blocking flag.
   */
  disabled?: boolean;
}

/**
 * Behavioral configuration options for SplitterAria.
 */
export interface SplitterOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a splitter element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface SplitterAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'separator';
  tabindex?: number;
  'aria-orientation'?: Orientation;
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-label'?: string;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless interactive movable splitter compiling the separator role with range
 * semantics. A splitter always owns a tab stop and arrow-key position adjustment
 * over the partition it divides, plus primary-pointer drag along its parent area.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class SplitterAria<
  E extends BaseElement = HTMLElement,
  T extends SplitterProps = SplitterProps,
  A extends SplitterAttributes<E> = SplitterAttributes<E>,
  O extends SplitterOptions = SplitterOptions,
> extends DividerAria<E, T, A, O> {
  private closeDrag: (() => void) | null = null;

  private dragStart = 0;

  private dirty = false;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);

    this.omittedAttrs.push(
      'oninput',
      'onchange',
      'value',
      'min',
      'max',
      'step',
      'label',
      'disabled',
      'aria-valuenow',
      'aria-valuemin',
      'aria-valuemax',
      'aria-label'
    );
    this.update();
  }

  /**
   * Current partition position, clamped to the inclusive range.
   */
  public get value(): number {
    return clampRange(this.properties.value ?? this.min, this.min, this.max);
  }

  public set value(next: number) {
    this.properties.value = clampRange(next, this.min, this.max);
  }

  /**
   * Minimum partition position.
   */
  public get min(): number {
    return this.properties.min ?? 0;
  }

  /**
   * Maximum partition position.
   */
  public get max(): number {
    return this.properties.max ?? 100;
  }

  /**
   * Increment applied per arrow keystroke.
   */
  public get step(): number {
    return this.properties.step ?? 1;
  }

  /**
   * Whether resizing is blocked while keeping the current allocation.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Partition position as a percentage along the declared range, matching the
   * numeric content of the published offset variable.
   */
  public get offset(): number {
    const span = this.max - this.min;
    if (span <= 0) return 0;
    return Number((((this.value - this.min) / span) * 100).toFixed(4));
  }

  /**
   * Resize axis measured from the parent area.
   */
  private get dragAxis(): Orientation {
    return this.orientation === 'vertical' ? 'horizontal' : 'vertical';
  }

  /**
   * Commits a raw partition reading through bounds.
   *
   * @param raw - Uncommitted partition reading
   * @returns Whether the commit changed the value
   */
  public commit(raw: number): boolean {
    const next = clampRange(raw, this.min, this.max);
    if (next === this.value) return false;
    this.properties.value = next;
    return true;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the splitter.
   *
   * @returns Splitter attributes dictionary
   */
  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    const span = this.max - this.min;
    const ratio = span <= 0 ? 0 : (this.value - this.min) / span;
    return Object.assign(super.createAttributes(), {
      role: 'separator',
      tabindex: isDisabled ? -1 : 0,
      'aria-valuenow': this.value,
      'aria-valuemin': this.min,
      'aria-valuemax': this.max,
      'aria-label': this.properties.label,
      'aria-disabled': ariaBoolean(isDisabled),
      style: { '--aria-splitter-offset': `${Number((ratio * 100).toFixed(4))}%` },
      onkeydown: this.handleKey,
      onpointerdown: this.handlePointerDown,
    }) as A;
  }

  protected override attach(): DetachFn | void {
    return () => this.closeDrag?.();
  }

  private ratioFromPoint(clientX: number, clientY: number): number | null {
    const area = this.element?.parentElement;
    if (!area) return null;
    return axisRatio(area.getBoundingClientRect(), this.dragAxis, clientX, clientY);
  }

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (this.disabled || event.defaultPrevented) return;

    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !backward) return;

    event.preventDefault();
    if (this.commit(this.value + (forward ? this.step : -this.step))) {
      this.notifyInput();
      this.notifyChange();
    }
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.disabled || event.defaultPrevented || event.button !== 0) return;
    const ratio = this.ratioFromPoint(event.clientX, event.clientY);
    if (ratio === null) return;

    this.dragStart = this.value;
    this.dirty = false;
    if (this.commit(this.min + ratio * (this.max - this.min))) {
      this.dirty = true;
      this.notifyInput();
    }
    this.closeDrag = openDragSession({
      onMove: this.handlePointerMove,
      onUp: this.handlePointerUp,
      onCancel: this.handlePointerCancel,
    });
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.defaultPrevented || event.buttons === 0) return;
    if (this.disabled) {
      this.closeDrag?.();
      return;
    }
    const ratio = this.ratioFromPoint(event.clientX, event.clientY);
    if (ratio === null) return;
    if (this.commit(this.min + ratio * (this.max - this.min))) {
      this.dirty = true;
      this.notifyInput();
    }
  };

  private readonly handlePointerUp = (): void => {
    if (!this.dirty) return;
    this.dirty = false;
    if (this.value !== this.dragStart) this.notifyChange();
  };

  private readonly handlePointerCancel = (): void => {
    this.dirty = false;
  };

  private notifyInput(): void {
    const event: SplitterEvent = new CustomEvent('input', { bubbles: true, detail: this.value, cancelable: true });
    this.element!.dispatchEvent(event);
    this.properties.oninput?.(event);
  }

  private notifyChange(): void {
    const event: SplitterEvent = new CustomEvent('change', { bubbles: true, detail: this.value, cancelable: true });
    this.element!.dispatchEvent(event);
    this.properties.onchange?.(event);
  }
}
