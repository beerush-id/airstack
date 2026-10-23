import type { ComponentStyles } from '@airlib/aui/utils';
import { createStyleScope } from '../utils/common.js';

export const sliderScope = createStyleScope();
export const toggleGroupScope = createStyleScope();
export const radioGroupScope = createStyleScope<ComponentStyles & { name?: string }>();
export const checkboxGroupScope = createStyleScope();
