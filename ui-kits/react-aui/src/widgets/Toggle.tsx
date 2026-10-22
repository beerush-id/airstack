import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type Bindable, renderDynamic, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiPrimitive, type AuiProps, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { toggleGroupProps } from './ToggleGroup.js';

export type ToggleValue = AuiPrimitive;

export type ToggleProps = Omit<AuiProps<'button'>, 'variant'> & {
  value?: ToggleValue;
  pressed?: Bindable<boolean>;
  disabled?: boolean;
  children?: ReactNode | ((pressed?: boolean) => ReactNode);
  onchange?: (event: CustomEvent<boolean | ToggleValue | ToggleValue[]>) => void;
};

const TOGGLE_ROLE = 'toggle';

const toggleStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
};

register('toggle', toggleStyles);

/**
 * Two-state button that inverts once per activation and announces
 * `aria-pressed`. Safe in forms: never submits unless `type="submit"`.
 */
export const Toggle = setup<ToggleProps>((props) => {
  const group = toggleGroupProps.get();
  const toggle = aria<HTMLButtonElement, AuiPrimitive>(TOGGLE_ROLE, props);
  const className = () =>
    $families(
      [AUI_CLASS.CONTROL, AUI_CLASS.TOGGLE],
      {
        size: props.size ?? group?.size,
        color: props.color ?? group?.color,
        className: props.className,
      },
      auiConfig.toggle
    );

  return () => (
    <button ref={toggle.ref} {...toggle.restProps([...OMIT_KEYS])} className={className()}>
      {renderDynamic(props.children, toggle.pressed)}
    </button>
  );
}, 'Toggle');
