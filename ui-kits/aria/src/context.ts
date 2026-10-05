import { createContext } from '@airlib/core';
import type { Aria } from './core.js';
import type { BaseElement } from './types.js';

/**
 * Ambient context for the active roving-focus controller.
 * Enables nested composite widgets (e.g. RadioGroup, ButtonGroup inside Toolbar)
 * to detect an enclosing rover and coordinate or defer keyboard navigation.
 */
export const roverCtx = createContext<Aria<BaseElement>>();

/**
 * Ambient reactive location for current-page link activation.
 * The root provides a reactive box; links track its url.
 */
export const linkCtx = createContext<{ url: string }>();
