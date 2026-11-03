import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';

const ROLE_LABEL = 'label';

/**
 * Ambient context for the enclosing label. A custom-host control inside it finds the label that
 * labels it and links to it by id, the way a native `<label>` labels the input it wraps.
 */
export const labelCtx = createContext<LabelAria>();

/**
 * Reactive input properties for LabelAria.
 */
export interface LabelProps extends AriaProps {
  /**
   * Explicit DOM identifier; generated when omitted, so a control inside always has one to link to.
   */
  id?: string;

  /**
   * Text naming the control the label wraps.
   */
  label?: string;
}

/**
 * Behavioral configuration options for LabelAria.
 */
export interface LabelOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a label element.
 *
 * @template E - Target Element type (defaults to HTMLLabelElement)
 */
export interface LabelAttributes<E extends BaseElement = HTMLLabelElement> extends AriaAttributes<E> {
  id?: string;
}

/**
 * Headless label controller giving custom-host controls a native `<label>` name. It always carries
 * an id and publishes itself as ambient context; a control inside discovers it and names itself
 * with `aria-labelledby`. Activation stays the control's own concern, through the enclosing `<label>`.
 *
 * @template E - Target Element type (defaults to HTMLLabelElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class LabelAria<
  E extends BaseElement = HTMLLabelElement,
  T extends LabelProps = LabelProps,
  A extends LabelAttributes<E> = LabelAttributes<E>,
  O extends LabelOptions = LabelOptions,
> extends Aria<E, T, A, O> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);

    $static(() => {
      this.properties.id = this.properties.id ?? `${ROLE_LABEL}-${uIndex($symbol(ROLE_LABEL), true)}`;
    });

    labelCtx.set(this as unknown as LabelAria);
    this.omittedAttrs.push('label');
    this.update();
  }

  /**
   * The label's DOM identifier, the target of the labelled control's `aria-labelledby`.
   */
  public get id(): string {
    return this.properties.id as string;
  }

  /**
   * Computes the HTML attributes for the label.
   *
   * @returns Label attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      id: this.id,
    }) as A;
  }
}
