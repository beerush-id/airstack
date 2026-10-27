import type { ComponentStyles } from '@airlib/aui/utils';
import { createContext } from '@airlib/react';
import { createStyleScope } from '../utils/common.js';

export const sliderScope = createStyleScope();
export const toggleGroupScope = createStyleScope();
export const radioGroupScope = createStyleScope<ComponentStyles & { name?: string }>();
export const checkboxGroupScope = createStyleScope();
export const listScope = createStyleScope();
/**
 * The element a fullscreen button fills the screen with, provided by the part around it — a stage,
 * an image viewer — as a getter, since it only exists once that part is mounted.
 */
export const fullscreenHostCtx = createContext<() => HTMLElement | null>();
