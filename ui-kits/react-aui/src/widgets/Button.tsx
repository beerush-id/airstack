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

  return () => {
    // Aria keeps `disabled` live on the element. Handed to React too, React holds on to its first
    // value and, if that was true, drops every press however enabled the button is since.
    const { disabled: _, ...attributes } = button.restProps([...BUTTON_OMIT_KEYS]);
    return (
      <button ref={button.ref} {...attributes} className={className()}>
        {props.children}
      </button>
    );
  };
}, 'Button');
