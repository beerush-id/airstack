import { aria } from '@airlib/aria';
import { AUI_CLASS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiFieldProps, type AuiProps, auiConfig, FIELD_STYLES, OMIT_KEYS } from '../config.js';
import { createStyleScope } from '../utils/common.js';

export type StepperProps = AuiFieldProps<'div'> & {
  value?: Bindable<number>;
  min?: number;
  max?: number;
  step?: number;
  page?: number;
  label?: string;
  /** Names the − button of the simple form, in your users' language. */
  decrementLabel?: string;
  /** Names the + button of the simple form, in your users' language. */
  incrementLabel?: string;
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

register('stepper', { ...FIELD_STYLES });
register('stepperInput', {});
register('stepperButton', { size: SIZES.MD, variant: VARIANTS.TEXT });

const stepperScope = createStyleScope();

/**
 * A number you nudge. The group holds the value and the bounds; the field and
 * the two buttons find it in scope, so no ids or prop drilling are needed.
 * The group is the field: it wears the field variants, and its size reaches
 * the buttons. Without children it renders − field + itself, named by `label`.
 */
export const Stepper = setup<StepperProps>((props) => {
  const stepper = aria(STEPPER_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, AUI_CLASS.STEPPER], props, auiConfig.stepper);

  stepperScope.provide(props);

  return () => (
    <div
      ref={stepper.ref}
      {...stepper.restProps([...OMIT_KEYS, 'decrementLabel', 'incrementLabel'])}
      className={className()}
    >
      {props.children ?? (
        <>
          <StepperDecrement aria-label={props.decrementLabel}>−</StepperDecrement>
          <StepperInput aria-label={props.label} />
          <StepperIncrement aria-label={props.incrementLabel}>+</StepperIncrement>
        </>
      )}
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

/** Class list of a step button: it follows the group's size, never its surface. */
function stepButtonClass(props: StepperButtonProps, groupSize: StepperButtonProps['size']): string {
  return $families(
    [AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.STEPPER_BUTTON],
    { size: props.size ?? groupSize, color: props.color, variant: props.variant, className: props.className },
    auiConfig.stepperButton
  );
}

/**
 * One step up. It goes inert at `max`, while the group is locked, or while the
 * field is read-only.
 */
export const StepperIncrement = setup<StepperButtonProps>((props) => {
  const group = stepperScope.get();
  const button = aria(INCREMENT_ROLE, props as AnyType);

  return () => (
    <button ref={button.ref} {...button.restProps(OMIT_KEYS)} type="button" className={stepButtonClass(props, group?.size)}>
      {props.children}
    </button>
  );
}, 'StepperIncrement');

/**
 * One step down. It goes inert at `min`, while the group is locked, or while
 * the field is read-only.
 */
export const StepperDecrement = setup<StepperButtonProps>((props) => {
  const group = stepperScope.get();
  const button = aria(DECREMENT_ROLE, props as AnyType);

  return () => (
    <button ref={button.ref} {...button.restProps(OMIT_KEYS)} type="button" className={stepButtonClass(props, group?.size)}>
      {props.children}
    </button>
  );
}, 'StepperDecrement');
