import { type AnyType, type ClassInput, classx, type StyleInput, stylex } from '@airlib/core';
import type { BaseElement, NormalizedAttrs } from '../types.js';

/**
 * Normalizes raw HTML and ARIA attributes by resolving classx inputs into strings
 * and stylex definitions into style objects.
 *
 * @template E - Target Element type
 * @param source - Raw attributes dictionary to normalize
 * @param target - Destination normalized dictionary to merge into
 * @param omit - Attribute keys to ignore from assignment
 * @returns The normalized attributes dictionary
 */
export function normalizeAttrs<E extends BaseElement = HTMLElement>(
  source: Record<string, unknown>,
  target: NormalizedAttrs<E> = {} as NormalizedAttrs<E>,
  omit: string[] = []
): NormalizedAttrs<E> {
  for (const [key, value] of Object.entries(source)) {
    if (omit.includes(key)) continue;

    if (key === 'class' || key === 'className') {
      target.class = classx(value as ClassInput);
    } else if (key === 'style') {
      target.style = value && typeof value === 'object' ? stylex(value as StyleInput) : (value as never);
    } else if (key.startsWith('on') && typeof value === 'function') {
      const existing = (target as Record<string, unknown>)[key];
      if (typeof existing === 'function') {
        (target as Record<string, unknown>)[key] = (e: Event) => {
          (existing as (e: Event) => void)(e);
          (value as (e: Event) => void)(e);
        };
      } else {
        (target as Record<string, unknown>)[key] = value;
      }
    } else {
      (target as Record<string, unknown>)[key] = value;
    }
  }

  return target;
}

/**
 * Attribute name mapping from framework-specific props to standard HTML attributes.
 */
const ATTR_MAP: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  tabIndex: 'tabindex',
  readOnly: 'readonly',
  autoComplete: 'autocomplete',
};

/**
 * Applies and diffs an attributes dictionary directly onto a target DOM element.
 * Skips function event handlers (on*) and assumes pre-normalized classes and styles.
 *
 * @template E - Target Element type
 * @param element - The DOM element to mutate
 * @param nextProps - The new normalized attributes to apply
 * @param prevProps - The previous normalized attributes for diffing (optional)
 */
export function applyAttributes<E extends BaseElement>(
  element: E,
  nextProps: NormalizedAttrs<E>,
  prevProps: NormalizedAttrs<E> = {} as NormalizedAttrs<E>
): void {
  if (!element || !(element instanceof Element)) return;

  const next = nextProps as Record<string, AnyType>;
  const prev = prevProps as Record<string, AnyType>;

  // 1. Remove attributes that no longer exist in nextProps
  for (const key of Object.keys(prev)) {
    if (key.startsWith('on')) {
      if (!(key in next) || prev[key] !== next[key]) {
        const eventName = key.slice(2).toLowerCase();
        if (typeof prev[key] === 'function') {
          element.removeEventListener(eventName, prev[key]);
        }
      }
      continue;
    }

    if (!(key in next)) {
      if (key === 'style') {
        element.removeAttribute('style');
      } else {
        if (key === 'indeterminate' && element instanceof HTMLInputElement) {
          element.indeterminate = false;
        }
        const attrName = ATTR_MAP[key] ?? key.toLowerCase();
        element.removeAttribute(attrName);
      }
    }
  }

  // 2. Set or update new/changed attributes
  for (const [key, value] of Object.entries(next)) {
    if (key.startsWith('on')) {
      if (typeof value === 'function' && prev[key] !== value) {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value as EventListener);
      }
      continue;
    }

    if (key in prev && prev[key] === value) continue;

    if (key === 'class' || key === 'className') {
      if (value) {
        element.setAttribute('class', value);
      } else {
        element.removeAttribute('class');
      }
    } else if (key === 'style') {
      applyStyles(element, value);
    } else {
      if ((key === 'checked' || key === 'indeterminate') && element instanceof HTMLInputElement) {
        element[key] = Boolean(value);
      }

      const attrName = ATTR_MAP[key] ?? key.toLowerCase();

      if (value === false || value === null || value === undefined) {
        element.removeAttribute(attrName);
      } else if (value === true) {
        element.setAttribute(attrName, '');
      } else {
        element.setAttribute(attrName, String(value));
      }
    }
  }
}

/**
 * Normalizes and applies style definitions onto an Element using stylex.
 *
 * @param element - The DOM element whose styles to update
 * @param styleValue - StyleInput object
 */
export function applyStyles(
  element: BaseElement,
  styleValue?: Record<string, string | number> | CSSStyleDeclaration
): void {
  if (!styleValue || typeof styleValue !== 'object') {
    element.removeAttribute('style');
    return;
  }

  if (!('style' in element)) return;

  const htmlStyle = (element as HTMLElement).style;
  htmlStyle.cssText = '';

  for (const [prop, val] of Object.entries(styleValue)) {
    if (prop.startsWith('--')) {
      htmlStyle.setProperty(prop, String(val));
    } else {
      htmlStyle[prop as never] = val as string;
    }
  }
}
