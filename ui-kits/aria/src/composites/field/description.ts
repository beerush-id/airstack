import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { fieldCtx } from './field.js';

/**
 * Compiled HTML and ARIA attributes for FieldDescription elements.
 *
 * @template E - Target Element type
 */
export interface FieldDescriptionAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
}
/**
 * Helper text container referenced via the control's `aria-describedby`.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template A - Compiled attributes dictionary type
 */
export class FieldDescriptionAria<
  E extends BaseElement = HTMLElement,
  A extends FieldDescriptionAttributes<E> = FieldDescriptionAttributes<E>,
> extends Aria<E, AriaProps, A> {
  /**
   * Enclosing Field coordinator discovered from ambient context.
   */
  protected field = fieldCtx.get();

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('id');
    this.update();
  }

  /**
   * Computes HTML attributes for the description element.
   */
  protected override createAttributes(): A {
    if (!this.field) return {} as A;

    return {
      id: `${this.field.id}-desc`,
    } as A;
  }
}
