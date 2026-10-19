import type { Color, ComponentStyles, Size, Variant } from '@airlib/aui/utils';
import type { AnyType, ClassInput, StyleInput } from '@airlib/react/core';
import type { ComponentProps, JSX, JSXElementConstructor } from 'react';

export * from '@airlib/aui/utils';

export type AuiProps<T extends keyof JSX.IntrinsicElements | JSXElementConstructor<AnyType>> = Omit<
  ComponentProps<T>,
  | 'id'
  | 'name'
  | 'disabled'
  | 'className'
  | 'color'
  | 'size'
  | 'variant'
  | 'value'
  | 'checked'
  | 'selected'
  | 'children'
> &
  ComponentStyles & {
    size?: Size;
    color?: Color;
    style?: StyleInput;
    variant?: Variant;
    className?: ClassInput;
  };

export type AuiPrimitive = string | number | undefined;

export const OMIT_KEYS = ['label', 'options', 'children', 'className', 'size', 'variant', 'color'];
