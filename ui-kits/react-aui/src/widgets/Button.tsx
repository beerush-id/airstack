import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ComponentProps } from 'react';
import { $families, auiConfig, type ComponentStyles } from '../config.js';

export type ButtonProps = Omit<ComponentProps<'button'>, 'type' | 'disabled' | 'size' | 'className'> &
  ComponentStyles & {
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
  };

const BUTTON_ROLE = 'button';
const BUTTON_OMIT_KEYS = ['children', 'size', 'variant', 'color'] as const;

const buttonStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
  variant: VARIANTS.FILLED,
};

register('button', buttonStyles);

export const Button = setup<ButtonProps>((props) => {
  const button = aria(BUTTON_ROLE, props);
  const className = () => $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON], props, auiConfig.button);

  return () => (
    <button ref={button.ref} {...button.restProps([...BUTTON_OMIT_KEYS])} className={className()}>
      {props.children}
    </button>
  );
}, 'Button');
