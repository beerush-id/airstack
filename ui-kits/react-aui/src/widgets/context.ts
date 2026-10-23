import type { ComponentStyles } from '@airlib/aui/utils';
import { type ComponentProps, createContext } from '@airlib/react';

export const sliderProps = createContext<ComponentProps<ComponentStyles>>();
export const toggleGroupProps = createContext<ComponentProps<ComponentStyles>>();
export const radioGroupProps = createContext<ComponentProps<ComponentStyles & { name?: string }>>();
export const checkboxGroupProps = createContext<ComponentProps<ComponentStyles>>();
