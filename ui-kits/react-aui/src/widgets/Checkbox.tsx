import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type Bindable, renderDynamic, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type AuiPrimitive, type AuiProps, type ComponentStyles, OMIT_KEYS } from '../config.js';

import { checkboxGroupProps } from './context.js';

export type CheckboxValue = AuiPrimitive;

export interface CheckboxProps extends Omit<AuiProps<'input'>, 'variant' | 'type' | 'value'> {
  checked?: Bindable<boolean>;
  indeterminate?: Bindable<boolean>;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean | 'grammar' | 'spelling';
  name?: string;
  value?: CheckboxValue;
  children?: ReactNode | ((checked?: boolean) => ReactNode);
  oninput?: (event: CustomEvent<boolean>) => void;
  onchange?: (event: CustomEvent<boolean | CheckboxValue[]>) => void;
}

const CHECKBOX_ROLE = 'checkbox';

const checkboxStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
};

register('checkbox', checkboxStyles);

/**
 * Yes-no box that can also sit undecided. A native input wrapped in
 * a label, so the name text marks the box and the control joins
 * forms; the controller drives checked, indeterminate, disabled,
 * and required on the input itself. The glyph keys off the state
 * the browser reports — checked, indeterminate, or neither.
 */
export const Checkbox = setup<CheckboxProps>((props) => {
  const group = checkboxGroupProps.get();
  const checkbox = aria(CHECKBOX_ROLE, props);
  const className = () =>
    $families(
      AUI_CLASS.CHECKBOX_BOX,
      {
        size: props.size ?? group?.size,
        color: props.color ?? group?.color,
        className: props.className,
      },
      auiConfig.checkbox
    );

  return () => (
    <label className={AUI_CLASS.CHECKBOX}>
      <input
        ref={checkbox.ref}
        {...checkbox.restProps([...OMIT_KEYS])}
        type="checkbox"
        name={props.name}
        value={props.value}
        className={className()}
      />
      <span className={AUI_CLASS.CHECKBOX_LABEL}>{renderDynamic(props.children, checkbox.checked)}</span>
    </label>
  );
}, 'Checkbox');
