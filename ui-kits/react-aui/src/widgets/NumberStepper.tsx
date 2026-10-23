import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type Bindable, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, FIELD_STYLES, type FieldStyles, OMIT_KEYS } from '../config.js';

export interface NumberStepperProps extends Omit<ComponentProps<'input'>, 'className' | 'color' | 'value' | 'size'>,
  FieldStyles {
  value?: Bindable<number>;
  min?: number;
  max?: number;
  step?: number;
  valuetext?: string;
  readonly?: boolean;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  children?: ReactNode;
}

const NUMBER_STEPPER_ROLE = 'number-stepper';

register('numberStepper', { ...FIELD_STYLES });

/**
 * Discrete number clamped to its bounds on every write.
 * Native host keeps the browser spinner; custom host takes the spinbutton role.
 */
export const NumberStepper = setup<NumberStepperProps>((props) => {
  const stepper = aria(NUMBER_STEPPER_ROLE, props, { native: true } as never);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, AUI_CLASS.NUMBER_STEPPER], props, auiConfig.numberStepper);

  return () => (
    <input
      ref={stepper.ref}
      {...stepper.restProps([...OMIT_KEYS, 'label', 'value', 'valuetext'])}
      className={className()}
    />
  );
}, 'NumberStepper');
