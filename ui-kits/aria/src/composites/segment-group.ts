import { $static, type AnyType } from '@airlib/core';
import type { AriaEvent, AriaEventHandler, AriaProps, BaseElement } from '../types.js';
import { ToggleGroupAria, type ToggleGroupAttributes } from './toggle-group.js';

/**
 * Reactive input properties for SegmentGroupAria.
 */
export interface SegmentGroupProps extends AriaProps {
  /**
   * Optional DOM element identifier and group namespace.
   */
  id?: string;

  /**
   * The object whose keys the members own: a member with `name` and `value` is pressed while
   * that key holds that value, and pressing it assigns or clears the key.
   */
  value?: Record<string, AnyType>;

  /**
   * Called with the member change event that reaches the container.
   */
  onchange?: AriaEventHandler<AriaEvent<boolean>>;

  /**
   * Whether user interaction is disabled across all members.
   */
  disabled?: boolean;
}

/**
 * Headless coordinator for members that each own one key of a shared object: several independent
 * values in one control, with a toggle group's keyboard travel and single tab stop. Members sharing
 * a `name` are one choice, as one key holds one value.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class SegmentGroupAria<E extends BaseElement = HTMLElement> extends ToggleGroupAria<
  E,
  AnyType,
  ToggleGroupAttributes<E>
> {
  public constructor(props: Partial<SegmentGroupProps> = {}) {
    super(props);

    $static(() => {
      (this.properties as AnyType).segment = true;
    });

    this.omittedAttrs.push('segment');
    this.update();
  }
}
