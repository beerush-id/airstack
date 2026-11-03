import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type AuiProps, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { checkboxGroupScope } from './context.js';

export interface CheckboxGroupProps extends Omit<AuiProps<'div'>, 'variant'> {
  value?: Bindable<string[]>;
  disabled?: boolean;
  label?: string;
  id?: string;
  children?: ReactNode;
  onchange?: (event: CustomEvent<string[]>) => void;
}

const CHECKBOX_GROUP_ROLE = 'checkbox-group';

const checkboxGroupStyles: ComponentStyles = {};

register('checkboxGroup', checkboxGroupStyles);

/**
 * Coordinator that holds one committed set of checked values across
 * many boxes. Members join by declaring a `value` on `Checkbox`;
 * each box toggles on its own while the group names the set and
 * cascades `disabled` to every member.
 */
export const CheckboxGroup = setup<CheckboxGroupProps>((props) => {
  const group = aria(CHECKBOX_GROUP_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CHECKBOX_GROUP, props, auiConfig.checkboxGroup);

  checkboxGroupScope.provide(props);

  return () => (
    <div ref={group.ref} {...group.restProps([...OMIT_KEYS])} className={className()}>
      {props.children}
    </div>
  );
}, 'CheckboxGroup');
