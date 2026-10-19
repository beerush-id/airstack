import { aria } from '@airlib/aria';
import { COLORS, MAUI_CLASS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ComponentProps } from 'react';
import { $class, auiConfig, type ComponentStyles } from '../config.js';

export type ButtonProps = Omit<ComponentProps<'button'>, 'type' | 'disabled' | 'size' | 'className'> &
  ComponentStyles & {
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
  };

const BUTTON_ROLE = 'button';
const BUTTON_OMIT_KEYS = ['children', 'size', 'variant', 'color'] as const;

const buttonStyles: ComponentStyles = {
  size: SIZES.LG,
  color: COLORS.PRIMARY,
  variant: VARIANTS.FILLED,
  className: [MAUI_CLASS.ACTION, MAUI_CLASS.BUTTON],
};

register('button', buttonStyles);

export const Button = setup<ButtonProps>((props) => {
  const btn = aria(BUTTON_ROLE, props);

  return () => (
    <button
      ref={btn.ref}
      {...btn.restProps([...BUTTON_OMIT_KEYS])}
      className={$class(BUTTON_ROLE, props, auiConfig.button)}
    >
      {props.children}
    </button>
  );
}, 'Button');
