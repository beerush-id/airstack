import { Aria } from '../../core.js';
import type { AriaAttributes, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { openDragSession } from '../../utils/pointer.js';
import type { ButtonOptions, ButtonProps } from '../../widgets/index.js';
import { reorderCtx } from './host.js';
import { reorderItemCtx } from './item.js';

/**
 * Reactive input properties for ReorderHandleAria.
 */
export interface ReorderHandleProps extends ButtonProps {
  id?: string;
  label?: string;
  disabled?: boolean;
}

/**
 * Controller configuration options for ReorderHandleAria.
 */
export type ReorderHandleOptions = ButtonOptions;

/**
 * Compiled HTML and ARIA attributes for a reorder handle.
 */
export interface ReorderHandleAttributes<E extends BaseElement = HTMLButtonElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'button';
  type?: 'button' | 'submit' | 'reset';
  tabindex?: number;
  'aria-label'?: string;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless WAI-ARIA ReorderHandle controller driving keyboard and pointer pickup, movement, drop, and cancellation.
 */
export class ReorderHandleAria<
  E extends BaseElement = HTMLButtonElement,
  T extends ReorderHandleProps = ReorderHandleProps,
  A extends ReorderHandleAttributes<E> = ReorderHandleAttributes<E>,
  O extends ReorderHandleOptions = ReorderHandleOptions,
> extends Aria<E, T, A, O> {
  protected reorder = reorderCtx.get();
  protected item = reorderItemCtx.get();
  private closeDrag?: () => void;
  private suppressNextClick = false;

  public get active(): boolean {
    return !!this.item?.active;
  }

  public get disabled(): boolean {
    return !!(this.properties.disabled || this.item?.disabled || this.reorder?.disabled);
  }

  public constructor(props: Partial<T> = {}, options?: O) {
    super(props, { native: true, ...options } as O);

    this.cleanups.add(() => this.closeDrag?.());
    this.omittedAttrs.push(
      'id',
      'type',
      'label',
      'disabled',
      'role',
      'tabindex',
      'aria-label',
      'data-active',
      'aria-disabled'
    );
    this.update();
  }

  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    const attrs: ReorderHandleAttributes<E> = {
      id: this.properties.id,
      role: this.isNative ? undefined : 'button',
      type: this.isNative ? (this.properties.type ?? 'button') : undefined,
      tabindex: this.isNative ? undefined : isDisabled ? -1 : 0,
      onclick: this.handleClick,
      onkeydown: this.handleKeyDown,
      onpointerdown: this.handlePointerDown,

      'aria-label': this.properties.label,
      'data-active': this.active ? 'true' : undefined,
      'aria-disabled': ariaBoolean(isDisabled),
    };
    return attrs as A;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const reorder = this.reorder;
    const item = this.item;
    if (this.disabled || event.defaultPrevented || event.button !== 0 || !reorder || !item) return;

    this.closeDrag?.();
    const wasActive = this.active;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragged = false;

    if (!wasActive) {
      reorder.pickup(item.value);
    }

    this.closeDrag = openDragSession({
      startX,
      startY,
      host: (this.reorder as never as this)?.element as never as HTMLElement,
      orientation: this.reorder?.orientation,

      onMove: (moveEvent) => {
        if (Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3) {
          dragged = true;
        }
        if (reorder.moveByPointer(moveEvent.clientX, moveEvent.clientY)) {
          dragged = true;
        }
      },
      onUp: () => {
        this.closeDrag = undefined;
        this.suppressNextClick = true;
        if (dragged || wasActive) {
          reorder.drop();
        }
      },
      onCancel: () => {
        this.closeDrag = undefined;
        this.suppressNextClick = false;
        reorder.cancel();
      },
    });
  };

  private readonly handleClick = (event: MouseEvent): void => {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }

    if (this.disabled || event.defaultPrevented || !this.reorder || !this.item) return;

    if (this.active) {
      this.reorder.drop();
    } else {
      this.reorder.pickup(this.item.value);
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled || event.defaultPrevented || !this.reorder || !this.item) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (this.active) {
        this.reorder.drop();
      } else {
        this.reorder.pickup(this.item.value);
      }
      return;
    }

    if (!this.active) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.reorder.cancel();
      return;
    }

    if (event.key === 'Tab') {
      this.reorder.cancel();
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.reorder.move('home');
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.reorder.move('end');
      return;
    }

    const isHorizontal = this.reorder.orientation === 'horizontal';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

    if (event.key === nextKey) {
      event.preventDefault();
      this.reorder.move(1);
    } else if (event.key === prevKey) {
      event.preventDefault();
      this.reorder.move(-1);
    }
  };
}
