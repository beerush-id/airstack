import type { Color, ComponentStyles, FieldVariant, Size, Variant } from '@airlib/aui/utils';
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

/** Built-in fallbacks every field-like part registers; copy it per key so `configure()` never leaks across parts. */
export const FIELD_STYLES: Readonly<ComponentStyles> = { size: 'md', color: 'primary', variant: 'filled' };

/** Style props of a field-like part: the button-only variants are not offered. */
export type FieldStyles = Omit<ComponentStyles, 'variant'> & {
  variant?: FieldVariant;
};

/** `AuiProps` for a field-like part, narrowed to the field variants. */
export type AuiFieldProps<T extends keyof JSX.IntrinsicElements | JSXElementConstructor<AnyType>> = Omit<
  AuiProps<T>,
  'variant'
> & {
  variant?: FieldVariant;
};

export type AuiPrimitive = string | number | undefined;

export const OMIT_KEYS = ['label', 'options', 'children', 'className', 'size', 'variant', 'color', 'placeholder'];
