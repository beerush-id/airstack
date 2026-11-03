import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { fieldCtx } from './field.js';

/**
 * Compiled HTML and ARIA attributes for FieldLabel elements.
 *
 * @template E - Target Element type
 */
export interface FieldLabelAttributes<E extends BaseElement = HTMLLabelElement> extends AriaAttributes<E> {
  id: string;
  for?: string;
}
/**
 * Label association member binding to the field control via `for` or ID reference.
 *
 * @template E - Target Element type (defaults to HTMLLabelElement)
 * @template A - Compiled attributes dictionary type
 */
export class FieldLabelAria<
  E extends BaseElement = HTMLLabelElement,
  A extends FieldLabelAttributes<E> = FieldLabelAttributes<E>,
> extends Aria<E, AriaProps, A> {
  /**
   * Enclosing Field coordinator discovered from ambient context.
   */
  protected field = fieldCtx.get();

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('for');
    this.update();
  }

  /**
   * Labels bind `<label>` far more often than custom elements,
   * so native is the default unless explicitly declined.
   */
  public override get isNative(): boolean {
    return this.options.native ?? true;
  }

  /**
   * Computes HTML attributes for the label element.
   */
  protected override createAttributes(): A {
    if (!this.field) return {} as A;
    const fieldId = this.field?.id;

    return {
      id: `${fieldId}-label`,
      for: this.isNative ? `${fieldId}-control` : undefined,
    } as A;
  }
}
