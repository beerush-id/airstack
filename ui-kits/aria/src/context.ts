import { $symbol, type AnyType, createContext, getRootContextStore } from '@airlib/core';
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

export const ARIA_CURRENT_SYMBOL = $symbol('aria-current');

/**
 * Ambient context to store and retrieve the current ARIA state or property.
 */
export const currentAria = {
  key: ARIA_CURRENT_SYMBOL,
  get<T extends Aria<AnyType, AnyType, AnyType, AnyType>>(fallback?: T): T | undefined {
    return getRootContextStore()?.get(ARIA_CURRENT_SYMBOL) ?? fallback;
  },
  set<T extends Aria<AnyType, AnyType, AnyType, AnyType>>(value?: T) {
    getRootContextStore()?.set(ARIA_CURRENT_SYMBOL, value);
  },
  within<T extends Aria<AnyType, AnyType, AnyType, AnyType>>(value?: T) {
    let current = currentAria.get<T>();
    if (current === value) return true;

    while (current?.scope) {
      current = current.scope as unknown as T;
      if (current === value) return true;
    }

    return false;
  },
};
