import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiProps, auiConfig, OMIT_KEYS } from '../config.js';

export type StepperProps = AuiProps<'div'> & {
  value?: Bindable<number>;
  min?: number;
  max?: number;
  step?: number;
  page?: number;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  valuetext?: string;
  children?: ReactNode;
  oninput?: (event: CustomEvent<number>) => void;
  onchange?: (event: CustomEvent<number>) => void;
};

export type StepperInputProps = AuiProps<'input'> & {
  oninput?: (event: CustomEvent<number>) => void;
  onchange?: (event: CustomEvent<number>) => void;
};

export type StepperButtonProps = AuiProps<'button'> & {
  children?: ReactNode;
};

const STEPPER_ROLE = 'stepper';
const INPUT_ROLE = 'stepper-input';
const INCREMENT_ROLE = 'stepper-inc';
const DECREMENT_ROLE = 'stepper-dec';

const INPUT_OMIT = [...OMIT_KEYS, 'oninput', 'onchange'];

register('stepper', {});
register('stepperInput', {});
register('stepperButton', {});

/**
 * A number you nudge. The group holds the value and the bounds; the field and
 * the two buttons find it in scope, so no ids or prop drilling are needed.
 */
export const Stepper = setup<StepperProps>((props) => {
  const stepper = aria(STEPPER_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.STEPPER, props, auiConfig.stepper);

  return () => (
    <div ref={stepper.ref} {...stepper.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'Stepper');

/**
 * The field. It shows the number, takes a typed one through the same bounds,
 * and lets the stepping keys pass through to the group.
 */
export const StepperInput = setup<StepperInputProps>((props) => {
  const input = aria(INPUT_ROLE, props as AnyType, { native: true });
  const className = () => $families(AUI_CLASS.STEPPER_INPUT, props, auiConfig.stepperInput);

  return () => <input ref={input.ref} {...input.restProps(INPUT_OMIT)} className={className()} />;
}, 'StepperInput');

/**
 * One step up. It goes inert at `max`, while the group is locked, or while the
 * field is read-only.
 */
export const StepperIncrement = setup<StepperButtonProps>((props) => {
  const button = aria(INCREMENT_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.STEPPER_BUTTON], props, auiConfig.stepperButton);

  return () => (
    <button ref={button.ref} {...button.restProps(OMIT_KEYS)} type="button" className={className()}>
      {props.children}
    </button>
  );
}, 'StepperIncrement');

/**
 * One step down. It goes inert at `min`, while the group is locked, or while
 * the field is read-only.
 */
export const StepperDecrement = setup<StepperButtonProps>((props) => {
  const button = aria(DECREMENT_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.STEPPER_BUTTON], props, auiConfig.stepperButton);

  return () => (
    <button ref={button.ref} {...button.restProps(OMIT_KEYS)} type="button" className={className()}>
      {props.children}
    </button>
  );
}, 'StepperDecrement');
