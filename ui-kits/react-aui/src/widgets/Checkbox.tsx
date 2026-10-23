import { aria, type CheckboxAria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type Bindable, renderDynamic, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type AuiPrimitive, type AuiProps, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CheckIcon, CheckIndeterminateIcon } from '../icons/index.js';

import { checkboxGroupScope } from './context.js';

export type CheckboxValue = AuiPrimitive;

export interface CheckboxProps extends Omit<AuiProps<'span'>, 'variant'> {
  checked?: Bindable<boolean>;
  indeterminate?: Bindable<boolean>;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean | 'grammar' | 'spelling';
  name?: string;
  value?: CheckboxValue;
  /** A custom glyph in place of the check and indeterminate icons. */
  children?: ReactNode | ((ctrl: CheckboxAria) => ReactNode);
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
 * Yes-no box that can also sit undecided. The box is the control: a click, or
 * `Space` with it focused, toggles it, and it shows the library's check or
 * indeterminate icon for the state it reports. It carries no text: wrap it in a
 * `Label`, which names it and activates it on click, or give it `aria-label`.
 * Its value lives in your bound state, not in a native form field.
 */
export const Checkbox = setup<CheckboxProps>((props) => {
  const styles = checkboxGroupScope.inherit(props);
  // A custom host, since a native input can't hold the library's icons.
  const checkbox = aria<HTMLSpanElement>(CHECKBOX_ROLE, props as never, { native: false });
  const className = () => $families(AUI_CLASS.CHECKBOX, styles, auiConfig.checkbox);

  return () => (
    <span ref={checkbox.ref} {...checkbox.restProps([...OMIT_KEYS, 'name', 'value'])} className={className()}>
      {props.children && renderDynamic(props.children, checkbox)}
      {!props.children && (
        <>
          <CheckIcon />
          <CheckIndeterminateIcon />
        </>
      )}
    </span>
  );
}, 'Checkbox');
