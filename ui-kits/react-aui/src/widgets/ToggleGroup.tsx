import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type AuiPrimitive, type AuiProps, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { toggleGroupScope } from './context.js';

export type ToggleGroupValue = AuiPrimitive | AuiPrimitive[];

/** The track the members sit on: `filled` (default) is the toned track; `glass` is the frosted sheet windows use. */
export type ToggleGroupVariant = 'filled' | 'glass';

export interface ToggleGroupProps extends Omit<AuiProps<'div'>, 'variant'> {
  value?: Bindable<ToggleGroupValue>;
  multiple?: boolean;
  /** Keeps one member pressed: pressing the pressed one again leaves it on. */
  required?: boolean;
  disabled?: boolean;
  /** Lays the members out in a row (default) or a column. Layout only; the arrow keys travel both ways. */
  orientation?: 'horizontal' | 'vertical';
  /** The track the members sit on. */
  variant?: ToggleGroupVariant;
  /** Shows only the pressed members at rest; pointing at the track or moving the keyboard into it opens the rest. */
  collapsible?: boolean;
  children?: ReactNode;
  onchange?: (event: CustomEvent<ToggleGroupValue>) => void;
}

const TOGGLE_GROUP_ROLE = 'toggle-group';
/** One member pressed at a time: one indicator glides between them. */
const SINGLE_CLASS = branded('toggle-group-single');
const VERTICAL_CLASS = branded('toggle-group-vertical');
const GLASS_CLASS = branded('toggle-group-glass');
const COLLAPSIBLE_CLASS = branded('toggle-group-collapsible');
const toggleGroupStyles: ComponentStyles = {
  size: SIZES.SM,
  color: COLORS.PRIMARY,
};

register('toggleGroup', toggleGroupStyles);

/**
 * Coordinator that holds one shared value behind several pressed
 * buttons. Members join by declaring a `value` on `Toggle`; the group
 * moves focus with the arrows without committing, keeps a single tab
 * stop, and cascades `disabled` to every member.
 */
export const ToggleGroup = setup<ToggleGroupProps>((props) => {
  const group = aria(TOGGLE_GROUP_ROLE, props as AnyType);
  // The group carries the role color through the shared scale, for the indicator a single group glides.
  // Its layout and track are not part of the shared vocabulary, so it names their classes itself.
  const className = () =>
    [
      $families([AUI_CLASS.SCALE, AUI_CLASS.TOGGLE_GROUP], props, auiConfig.toggleGroup),
      !props.multiple && SINGLE_CLASS,
      props.orientation === 'vertical' && VERTICAL_CLASS,
      props.variant === 'glass' && GLASS_CLASS,
      props.variant === 'glass' && AUI_CLASS.GLASS_FRAME,
      props.collapsible && COLLAPSIBLE_CLASS,
    ]
      .filter(Boolean)
      .join(' ');

  toggleGroupScope.provide(props);

  return () => (
    <div ref={group.ref} {...group.restProps([...OMIT_KEYS, 'orientation', 'collapsible'])} className={className()}>
      {props.children}
    </div>
  );
}, 'ToggleGroup');
