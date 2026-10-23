import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type Bindable, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, FIELD_STYLES, type FieldStyles, OMIT_KEYS } from '../config.js';
import { createStyleScope } from '../utils/common.js';

export type FieldValue = string | number;

export interface FieldProps extends Omit<ComponentProps<'div'>, 'className' | 'color'>, FieldStyles {
  id?: string;
  type?: string;
  value?: Bindable<FieldValue>;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: Bindable<boolean>;
  invalidMessages?: Bindable<string | string[]>;
  touched?: Bindable<boolean>;
  children?: ReactNode;
  oninput?: (event: CustomEvent<FieldValue>) => void;
}

export type FieldLabelProps = Omit<ComponentProps<'label'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'size' | 'variant' | 'color'> & { children?: ReactNode };

export type FieldControlProps = Omit<ComponentProps<'input'>, 'className' | 'color' | 'size'> & FieldStyles;

export type FieldDescriptionProps = Omit<ComponentProps<'span'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'size' | 'variant' | 'color'> & { children?: ReactNode };

export type FieldErrorProps = Omit<ComponentProps<'span'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'size' | 'variant' | 'color'> & { children?: ReactNode };

const FIELD_ROLE = 'field';
const FIELD_LABEL_ROLE = 'field-label';
const FIELD_CONTROL_ROLE = 'field-control';
const FIELD_DESCRIPTION_ROLE = 'field-description';
const FIELD_ERROR_ROLE = 'field-error';

const fieldStyles: ComponentStyles = {};

register('field', fieldStyles);
register('fieldLabel', fieldStyles);
register('fieldControl', { ...FIELD_STYLES });
register('fieldDescription', fieldStyles);
register('fieldError', fieldStyles);

const fieldScope = createStyleScope<FieldProps>();

/**
 * Ties label, control, helper text, and failure into one namespace.
 * Holds the failure back until touched; label/control/description/error wire by id.
 */
export const Field = setup<FieldProps>((props) => {
  const field = aria(FIELD_ROLE, props);
  const className = () => $families(AUI_CLASS.FIELD, { className: props.className }, auiConfig.field);

  fieldScope.provide(props);

  return () => (
    <div ref={field.ref} {...field.restProps([...OMIT_KEYS, 'id', 'type', 'value', 'placeholder', 'required', 'disabled', 'invalid', 'invalidMessages', 'touched', 'oninput'])} className={className()}>
      {props.children}
    </div>
  );
}, 'Field');

/**
 * Field label wired to the control by the shared namespace.
 */
export const FieldLabel = setup<FieldLabelProps>((props) => {
  const label = aria(FIELD_LABEL_ROLE, props);
  const className = () => $families(AUI_CLASS.FIELD_LABEL, props, auiConfig.fieldLabel);

  return () => (
    <label ref={label.ref} {...label.restProps([...OMIT_KEYS])} className={className()}>
      {props.children}
    </label>
  );
}, 'FieldLabel');

/**
 * Field control address derived from the enclosing namespace.
 */
export const FieldControl = setup<FieldControlProps>((props) => {
  const styles = fieldScope.inherit(props);
  const control = aria(FIELD_CONTROL_ROLE, props);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, AUI_CLASS.FIELD_CONTROL], styles, auiConfig.fieldControl);

  return () => <input ref={control.ref} {...control.restProps([...OMIT_KEYS])} className={className()} />;
}, 'FieldControl');

/**
 * Helper text on its own channel, separate from the failure.
 */
export const FieldDescription = setup<FieldDescriptionProps>((props) => {
  const description = aria(FIELD_DESCRIPTION_ROLE, props);
  const className = () => $families(AUI_CLASS.FIELD_DESCRIPTION, props, auiConfig.fieldDescription);

  return () => (
    <span ref={description.ref} {...description.restProps([...OMIT_KEYS])} className={className()}>
      {props.children}
    </span>
  );
}, 'FieldDescription');

/**
 * Failure message shown once the field is touched and invalid.
 */
export const FieldError = setup<FieldErrorProps>((props) => {
  const error = aria(FIELD_ERROR_ROLE, props);
  const className = () => $families(AUI_CLASS.FIELD_ERROR, props, auiConfig.fieldError);

  return () => (
    <span ref={error.ref} {...error.restProps([...OMIT_KEYS])} className={className()}>
      {props.children}
    </span>
  );
}, 'FieldError');
