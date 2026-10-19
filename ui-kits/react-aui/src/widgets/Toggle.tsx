import { aria } from '@airlib/aria';
import { COLORS, MAUI_CLASS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type Bindable, renderDynamic, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $class, auiConfig, type AuiPrimitive, type AuiProps, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type ToggleValue = AuiPrimitive;

export type ToggleProps = AuiProps<'button'> & {
  value?: ToggleValue;
  pressed?: Bindable<boolean>;
  disabled?: boolean;
  children?: ReactNode | ((pressed?: boolean) => ReactNode);
  onchange?: (event: CustomEvent<boolean | ToggleValue | ToggleValue[]>) => void;
};

const TOGGLE_ROLE = 'toggle';

const toggleStyles: ComponentStyles = {
  size: SIZES.LG,
  color: COLORS.PRIMARY,
  variant: VARIANTS.OUTLINED,
  className: [MAUI_CLASS.ACTION, MAUI_CLASS.TOGGLE],
};

register('toggle', toggleStyles);

/**
 * Two-state button that inverts once per activation and announces
 * `aria-pressed`. Safe in forms: never submits unless `type="submit"`.
 */
export const Toggle = setup<ToggleProps>((props) => {
  const toggle = aria<HTMLButtonElement, AuiPrimitive>(TOGGLE_ROLE, props);

  return () => (
    <button
      ref={toggle.ref}
      {...toggle.restProps([...OMIT_KEYS])}
      className={$class(TOGGLE_ROLE, props, auiConfig.toggle)}
    >
      {renderDynamic(props.children, toggle.pressed)}
    </button>
  );
}, 'Toggle');
