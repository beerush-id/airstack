import type { BaseElement, DetachFn } from '../types.js';

/**
 * Polyfills native label activation for non-native interactive elements nested inside a `<label>`.
 *
 * Traverses to the nearest enclosing `<label>` and registers a click handler that dispatches
 * a click to the target element when the label is clicked outside the element itself.
 *
 * @param element - The custom element residing under a `<label>`
 * @returns Detachment callback to unbind the event listener, or void if no enclosing label was found
 */
export function bindLabel(element: BaseElement): DetachFn | void {
  const label = element.closest('label');
  if (!label) return;

  const handleClick = (e: MouseEvent) => {
    if (element.contains(e.target as Node)) return;
    if ((element as HTMLButtonElement).disabled || element.getAttribute('aria-disabled') === 'true') {
      return;
    }

    (element as HTMLElement).click?.();
  };

  label.addEventListener('click', handleClick);
  return () => label.removeEventListener('click', handleClick);
}
