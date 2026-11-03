import { isBrowser } from '../shared/env.js';

let SHADOW_ROOT: Element | undefined;
let SHADOW_ATTACHED = false;

/**
 * Creates a shadow root element and returns it.
 * @returns The shadow root element.
 */
export function shadowRoot() {
  if (isBrowser() && !SHADOW_ROOT) {
    SHADOW_ROOT = document.createElement('anchor-shadow');
    SHADOW_ROOT.setAttribute('hidden', '');
  }

  return SHADOW_ROOT;
}

/**
 * Gets an element by its ID from the shadow root or the document.
 * @param id - The ID of the element to get.
 * @returns The element with the given ID.
 */
export function getElementById(id: string) {
  return SHADOW_ROOT?.querySelector(`[id="${id}"]`) ?? document.getElementById(id);
}

/**
 * Queries the shadow root or the document for the first element that matches the given selector.
 * @param selector - The selector to match.
 * @param from - The element to start the search from.
 * @returns The first element that matches the selector.
 */
export function querySelector(selector: string, from: Element | Document = document) {
  return SHADOW_ROOT?.querySelector(selector) ?? from?.querySelector(selector);
}

/**
 * Queries the shadow root or the document for all elements that match the given selector.
 * @param selector - The selector to match.
 * @param from - The element to start the search from.
 * @returns A static NodeList of all elements that match the selector.
 */
export function querySelectorAll(selector: string, from: Element | Document = document) {
  return SHADOW_ROOT?.querySelectorAll(selector) ?? from?.querySelectorAll(selector);
}

/**
 * Attaches the shadow root to the document if it is not already attached.
 */
function attach() {
  if (!isBrowser() || !SHADOW_ROOT || SHADOW_ATTACHED) return;
  document.prepend(SHADOW_ROOT);
  SHADOW_ATTACHED = true;
}

export const shadow = { attach, getElementById, querySelector, querySelectorAll };
