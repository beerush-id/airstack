import { effect } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, DetachFn } from '../types.js';

/**
 * Reactive input properties for FilePickerAria.
 */
export interface FilePickerProps extends AriaProps {
  /**
   * Accepted file types filter forwarded to the hidden file input.
   */
  accept?: string;

  /**
   * Multi-file selection flag forwarded to the hidden file input.
   */
  multiple?: boolean;

  /**
   * Media capture source for mobile devices.
   */
  capture?: 'user' | 'environment';

  /**
   * Whether the trigger is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Behavioral configuration options for FilePickerAria.
 */
export interface FilePickerOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a file-picker element.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface FilePickerAttributes<E extends BaseElement = HTMLButtonElement> extends AriaAttributes<E> {
  role?: 'button';
  type?: 'button';
  disabled?: boolean;
  tabindex?: number;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless file-picker trigger controller bridging activation to an internal,
 * hidden native file input and forwarding selection and cancellation events.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class FilePickerAria<
  E extends BaseElement = HTMLButtonElement,
  T extends FilePickerProps = FilePickerProps,
  A extends FilePickerAttributes<E> = FilePickerAttributes<E>,
  O extends FilePickerOptions = FilePickerOptions,
> extends Aria<E, T, A, O> {
  private picker: HTMLInputElement | null = null;

  private spaceArmed = false;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
    });

    this.omittedAttrs.push('accept', 'multiple', 'capture');
    this.update();
  }

  /**
   * Whether the trigger is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the file-picker.
   *
   * @returns File-trigger attributes dictionary
   */
  protected override createAttributes(): A {
    const isDisabled = this.disabled;

    if (this.isNative) {
      return Object.assign(super.createAttributes(), {
        type: 'button',
        disabled: isDisabled,
        onclick: this.handleClick,
        onkeydown: this.handleKeyDown,
      }) as A;
    }

    return Object.assign(super.createAttributes(), {
      role: 'button',
      tabindex: isDisabled ? -1 : 0,
      'aria-disabled': isDisabled ? 'true' : 'false',
      onclick: this.handleClick,
      onkeydown: this.handleKeyDown,
      onkeyup: this.handleKeyUp,
    }) as A;
  }

  /**
   * Creates the hidden file input, forwards its events, and appends it to the document.
   *
   * @returns Detachment callback removing the hidden file input
   */
  protected override attach(): DetachFn | void {
    const host = this.element;
    /* istanbul ignore next */
    if (!host) return;
    const picker = host.ownerDocument.createElement('input');
    picker.type = 'file';
    picker.style.display = 'none';
    const stopSync = effect(() => {
      this.syncPicker(picker);
    });

    const onChange = (event: Event): void => {
      event.stopPropagation();
      const files = Array.from(picker.files!);
      host.dispatchEvent(new CustomEvent<File[]>('change', { bubbles: true, detail: files }));
    };
    const onCancel = (event: Event): void => {
      event.stopPropagation();
      host.dispatchEvent(new CustomEvent<void>('cancel', { bubbles: false }));
    };
    picker.addEventListener('change', onChange);
    picker.addEventListener('cancel', onCancel);
    host.ownerDocument.body.appendChild(picker);
    this.picker = picker;

    return () => {
      stopSync();
      picker.removeEventListener('change', onChange);
      picker.removeEventListener('cancel', onCancel);
      picker.remove();
      this.picker = null;
    };
  }

  private syncPicker(target: HTMLInputElement): void {
    const { accept, multiple, capture } = this.properties;
    if (accept === undefined) target.removeAttribute('accept');
    else target.accept = accept;
    target.multiple = !!multiple;
    if (capture === undefined) target.removeAttribute('capture');
    else target.setAttribute('capture', capture);
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (this.disabled || event.defaultPrevented) return;
    this.picker!.click();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled || event.defaultPrevented) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      (event.currentTarget as HTMLElement)?.click?.();
    } else if (event.key === ' ' && !this.isNative) {
      event.preventDefault();
      this.spaceArmed = true;
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const armed = this.spaceArmed;
    this.spaceArmed = false;
    if (this.isNative || this.disabled || event.defaultPrevented || event.key !== ' ') return;

    if (armed) {
      (event.currentTarget as HTMLElement)?.click?.();
    }
  };
}
