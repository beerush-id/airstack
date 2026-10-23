import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type AuiPrimitive, type AuiProps, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { toggleGroupScope } from './context.js';

export type ToggleGroupValue = AuiPrimitive | AuiPrimitive[];

export interface ToggleGroupProps extends Omit<AuiProps<'div'>, 'variant'> {
  value?: Bindable<ToggleGroupValue>;
  multiple?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  onchange?: (event: CustomEvent<ToggleGroupValue>) => void;
}

const TOGGLE_GROUP_ROLE = 'toggle-group';
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
  const className = () => $families(AUI_CLASS.TOGGLE_GROUP, props, auiConfig.toggleGroup);

  toggleGroupScope.provide(props);

  return () => (
    <div ref={group.ref} {...group.restProps([...OMIT_KEYS])} className={className()}>
      {props.children}
    </div>
  );
}, 'ToggleGroup');
