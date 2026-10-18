import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { fieldCtx } from './field.js';

/**
 * Compiled HTML and ARIA attributes for FieldError elements.
 *
 * @template E - Target Element type
 */
export interface FieldErrorAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
  hidden?: boolean;
  'aria-live': 'polite';
}
/**
 * Error message container with polite live region, referenced while invalid.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template A - Compiled attributes dictionary type
 */
export class FieldErrorAria<
  E extends BaseElement = HTMLElement,
  A extends FieldErrorAttributes<E> = FieldErrorAttributes<E>,
> extends Aria<E, AriaProps, A> {
  /**
   * Enclosing Field coordinator discovered from ambient context.
   */
  protected field = fieldCtx.get();

  public get visible() {
    if (!this.field) return false;
    return this.field.touched && this.field?.invalid;
  }

  public get message() {
    return this.field?.invalidMessages;
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('id', 'hidden', 'aria-live');
    this.update();
  }

  /**
   * Computes HTML and ARIA attributes for the error element.
   */
  protected override createAttributes(): A {
    if (!this.field) return {} as A;

    return {
      id: `${this.field.id}-error`,
      hidden: !this.visible,
      'aria-live': 'polite',
    } as A;
  }
}
