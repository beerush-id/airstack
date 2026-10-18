import { $static, $symbol, createContext, type Primitive, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaProps, BaseElement, Orientation } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import type { ReorderItemAria, ReorderItemProps } from './item.js';

const ROLE_REORDER = 'reorder';

/**
 * Custom event dispatched when the preview or committed order changes.
 */
export type ReorderEvent<T = Primitive[]> = AriaEvent<T>;
/**
 * Custom event dispatched when an active reorder operation is canceled.
 */
export type ReorderCancelEvent<T = Primitive> = AriaEvent<T>;

/**
 * Reactive input properties for ReorderAria.
 */
export interface ReorderProps<T extends Primitive = Primitive> extends AriaProps {
  id?: string;
  value?: T[];
  preview?: T[];
  active?: T | null;
  orientation?: Orientation;
  disabled?: boolean;
  label?: string;
  labelledby?: string;
  oninput?: AriaEventHandler<ReorderEvent<T[]>>;
  onchange?: AriaEventHandler<ReorderEvent<T[]>>;
  oncancel?: AriaEventHandler<ReorderCancelEvent<T>>;
}

/**
 * Compiled HTML and ARIA attributes for a reorder container.
 */
export interface ReorderAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Ambient context for the enclosing Reorder controller.
 */
export const reorderCtx = createContext<ReorderAria<BaseElement, ReorderProps<Primitive>>>();

/**
 * Headless WAI-ARIA Reorder coordinator managing preview order, active item state, and commit/cancel lifecycles.
 */
export class ReorderAria<
  E extends BaseElement = HTMLElement,
  T extends ReorderProps<Primitive> = ReorderProps<Primitive>,
  A extends ReorderAttributes<E> = ReorderAttributes<E>,
> extends Aria<E, T, A> {
  public readonly items = new Set<ReorderItemAria<BaseElement, ReorderItemProps<Primitive>>>();

  protected get state(): ReorderProps<Primitive> {
    return this.properties;
  }

  public get id(): string | undefined {
    return this.properties.id;
  }

  public get value(): T['value'] {
    return this.properties.value;
  }

  public set value(val: T['value']) {
    this.properties.value = val;
  }

  public get preview(): T['preview'] {
    return this.properties.preview;
  }

  public get active(): T['active'] {
    return this.properties.active;
  }

  public get orientation(): Orientation {
    return this.properties.orientation ?? 'vertical';
  }

  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  public constructor(props: Partial<T> = {}) {
    super(props);

    $static(() => {
      this.state.id = this.state.id ?? `${ROLE_REORDER}-${uIndex($symbol(ROLE_REORDER), true)}`;
      if (!this.state.orientation) {
        this.state.orientation = 'vertical';
      }
      if (!Array.isArray(this.state.value)) {
        this.state.value = [];
      }
    });

    reorderCtx.set(this as never);

    this.omittedAttrs.push(
      'id',
      'value',
      'preview',
      'active',
      'orientation',
      'disabled',
      'label',
      'labelledby',
      'oninput',
      'onchange',
      'oncancel',
      'aria-label',
      'aria-labelledby',
      'aria-disabled'
    );

    this.update();
  }

  /**
   * Picks up the specified item value and initializes the preview order from the committed order.
   */
  public pickup(itemValue: Primitive): void {
    if (this.disabled) return;
    const current = this.state.value!;
    if (!current.includes(itemValue)) return;

    this.state.preview = [...current];
    this.state.active = itemValue;
  }

  /**
   * Moves the currently active item within the preview sequence, clamped at boundaries.
   */
  public move(delta: number | 'home' | 'end'): void {
    const active = this.state.active;
    const preview = this.state.preview;
    if (this.disabled || active === null || active === undefined || !preview) return;

    const from = preview.indexOf(active);
    if (from === -1) return;

    const last = preview.length - 1;
    const to = delta === 'home' ? 0 : delta === 'end' ? last : Math.max(0, Math.min(last, from + delta));
    if (to === from) return;

    const next = [...preview];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    this.state.preview = next;

    const event: ReorderEvent<Primitive[]> = new CustomEvent('input', {
      detail: next,
      bubbles: true,
    });
    this.element?.dispatchEvent(event);
    this.state.oninput?.(event);
  }

  /**
   * Moves the currently active item when pointer coordinates cross sibling slot midpoints.
   */
  public moveByPointer(clientX: number, clientY: number): boolean {
    const active = this.state.active;
    const preview = this.state.preview;
    if (this.disabled || active === null || active === undefined || !preview) return false;

    const from = preview.indexOf(active);
    if (from === -1) return false;

    const isHorizontal = this.orientation === 'horizontal';
    const rects: DOMRect[] = [];
    for (const item of this.items) {
      if (item.current) {
        rects.push((item.current as HTMLElement).getBoundingClientRect());
      }
    }

    rects.sort((a, b) => (isHorizontal ? a.left - b.left : a.top - b.top));
    if (rects.length <= 1) return false;

    const pos = isHorizontal ? clientX : clientY;
    let to = from;

    for (let i = from + 1; i < rects.length; i++) {
      const mid = isHorizontal ? rects[i].left + rects[i].width / 2 : rects[i].top + rects[i].height / 2;
      if (pos >= mid) {
        to = i;
      }
    }

    if (to === from) {
      for (let i = from - 1; i >= 0; i--) {
        const mid = isHorizontal ? rects[i].left + rects[i].width / 2 : rects[i].top + rects[i].height / 2;
        if (pos <= mid) {
          to = i;
        }
      }
    }

    if (to === from) return false;
    this.move(to - from);
    return true;
  }

  /**
   * Drops the currently active item, committing the preview sequence if it changed.
   */
  public drop(): void {
    const active = this.state.active;
    if (active === null || active === undefined) return;

    const committed = this.state.value!;
    const preview = this.state.preview!;
    const changed = preview.some((v, i) => v !== committed[i]);

    if (changed) {
      this.state.value = [...preview];
    }

    this.state.preview = [...this.state.value!];
    this.state.active = null;

    if (changed) {
      const event: ReorderEvent<Primitive[]> = new CustomEvent('change', {
        detail: this.state.value!,
        bubbles: true,
      });
      this.element?.dispatchEvent(event);
      this.state.onchange?.(event);
    }
  }

  /**
   * Cancels the active reorder gesture and restores the preview order from the committed order.
   */
  public cancel(): void {
    const active = this.state.active;
    if (active === null || active === undefined) return;

    this.state.preview = [...this.state.value!];
    this.state.active = null;

    const event: ReorderCancelEvent<Primitive> = new CustomEvent('cancel', {
      detail: active,
      bubbles: true,
      cancelable: false,
    });
    this.element?.dispatchEvent(event);
    this.state.oncancel?.(event);
  }

  protected override createAttributes(): A {
    const attrs: ReorderAttributes<E> = {
      id: this.id,
      'aria-label': this.properties.label,
      'aria-labelledby': this.properties.labelledby,
      'aria-disabled': ariaBoolean(this.disabled),
    };
    return attrs as A;
  }
}
