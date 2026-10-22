import { aria, type SwitchAria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type Bindable, renderDynamic, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiPrimitive, type AuiProps, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CheckIcon, RemoveIcon } from '../icons/index.js';

export type SwitchProps = AuiProps<'button'> & {
  checked?: Bindable<boolean>;
  disabled?: boolean;
  children?: ReactNode | ((ctrl: SwitchAria) => ReactNode);
  onchange?: (event: CustomEvent<boolean>) => void;
};

const SWITCH_ROLE = 'switch';

const switchStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
};

register('switch', switchStyles);

/**
 * Binary on/off control announced as `switch`. The button is the track and
 * thumb; it carries no text, so name it with `aria-label` or
 * `aria-labelledby` pointing at the visible label beside it.
 */
export const Switch = setup<SwitchProps>((props) => {
  const control = aria<HTMLButtonElement, AuiPrimitive>(SWITCH_ROLE, props);
  const className = () => $families([AUI_CLASS.CONTROL, AUI_CLASS.SWITCH], props, auiConfig.switch);

  return () => (
    <button ref={control.ref} {...control.restProps(OMIT_KEYS)} className={className()}>
      <span className={AUI_CLASS.SWITCH_THUMB}>
        {props.children && renderDynamic(props.children, control)}
        {!props.children && (
          <>
            {!control.checked && <RemoveIcon />}
            {control.checked && <CheckIcon />}
          </>
        )}
      </span>
    </button>
  );
}, 'Switch');
