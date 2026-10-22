import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type Bindable, setup } from '@airlib/react';
import { $families, type AuiPrimitive, type AuiProps, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type SwitchProps = AuiProps<'button'> & {
  checked?: Bindable<boolean>;
  disabled?: boolean;
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
      <span className={AUI_CLASS.SWITCH_TRACK} aria-hidden="true">
        <span className={AUI_CLASS.SWITCH_THUMB} />
      </span>
    </button>
  );
}, 'Switch');
