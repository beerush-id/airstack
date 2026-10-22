import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, type ComponentProps, createContext, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiPrimitive, type AuiProps, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type RadioGroupValue = AuiPrimitive;

export interface RadioGroupProps extends Omit<AuiProps<'div'>, 'variant'> {
  value?: Bindable<RadioGroupValue>;
  name?: string;
  orientation?: 'vertical' | 'horizontal';
  required?: boolean;
  invalid?: boolean | 'grammar' | 'spelling';
  disabled?: boolean;
  id?: string;
  children?: ReactNode;
  onchange?: (event: CustomEvent<RadioGroupValue>) => void;
}

const RADIO_GROUP_ROLE = 'radio-group';

const radioGroupStyles: ComponentStyles = {};

export const radioGroupProps = createContext<ComponentProps<ComponentStyles & { name?: string }>>();

register('radioGroup', radioGroupStyles);

/**
 * Coordinator that holds one shared answer across many options.
 * Members join by declaring a `value` on `Radio`; selecting one
 * takes the slot from the holder, arrows move and commit in one
 * step, and `disabled` cascades to every member.
 */
export const RadioGroup = setup<RadioGroupProps>((props) => {
  const group = aria(RADIO_GROUP_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.RADIO_GROUP, props, auiConfig.radioGroup);

  radioGroupProps.set(props as AnyType);

  return () => (
    <div ref={group.ref} {...group.restProps([...OMIT_KEYS])} className={className()}>
      {props.children}
    </div>
  );
}, 'RadioGroup');
