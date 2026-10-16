import { type ClassInput, classx, type StyleInput, stylex } from '@airlib/core';
import type { TranslateFn } from '../types.js';

/**
 * Mapping from native HTML attribute names to React JSX prop names.
 */
const REACT_PROP_MAP: Record<string, string> = {
  for: 'htmlFor',
  class: 'className',
  value: 'defaultValue',
  checked: 'defaultChecked',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  crossorigin: 'crossOrigin',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  maxlength: 'maxLength',
  minlength: 'minLength',
  novalidate: 'noValidate',
};

/**
 * Mapping from lowercase native DOM event attribute names to React camelCase synthetic event props.
 */
const REACT_EVENT_MAP: Record<string, string> = {
  onclick: 'onClick',
  ondblclick: 'onDoubleClick',
  onkeydown: 'onKeyDown',
  onkeyup: 'onKeyUp',
  onkeypress: 'onKeyPress',
  onfocus: 'onFocus',
  onblur: 'onBlur',
  onchange: 'onChange',
  oninput: 'onInput',
  onsubmit: 'onSubmit',
  onreset: 'onReset',
  onpointerdown: 'onPointerDown',
  onpointerup: 'onPointerUp',
  onpointermove: 'onPointerMove',
  onpointerenter: 'onPointerEnter',
  onpointerleave: 'onPointerLeave',
  onpointercancel: 'onPointerCancel',
  onmousedown: 'onMouseDown',
  onmouseup: 'onMouseUp',
  onmousemove: 'onMouseMove',
  onmouseenter: 'onMouseEnter',
  onmouseleave: 'onMouseLeave',
  oncontextmenu: 'onContextMenu',
  ontouchstart: 'onTouchStart',
  ontouchend: 'onTouchEnd',
  ontouchmove: 'onTouchMove',
  ontouchcancel: 'onTouchCancel',
  onscroll: 'onScroll',
  onwheel: 'onWheel',
  oncopy: 'onCopy',
  oncut: 'onCut',
  onpaste: 'onPaste',
  oncompositionstart: 'onCompositionStart',
  oncompositionend: 'onCompositionEnd',
  oncompositionupdate: 'onCompositionUpdate',
};

/**
 * Translates standard DOM / ARIA attributes and event handlers into React-compatible JSX props.
 * Converts `class` to `className` (using `classx`), normalizes `style` to style objects (using `stylex`),
 * maps lowercase `on*` events to React synthetic events, and maps camelCase JSX attributes.
 *
 * @param attrs - The standard DOM attribute dictionary
 * @returns A new dictionary adapted for React JSX props
 */
export const JSXTranslator: TranslateFn = (attrs: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class' || key === 'className') {
      result.className = classx(value as ClassInput);
    } else if (key === 'style') {
      /* istanbul ignore else */
      if (value && typeof value === 'object') {
        result.style = stylex(value as StyleInput);
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      const lowerKey = key.toLowerCase();
      /* istanbul ignore next */
      const mappedEvent = REACT_EVENT_MAP[lowerKey] ?? key;
      result[mappedEvent] = value;
    } else {
      const mappedKey = REACT_PROP_MAP[key] ?? key;
      result[mappedKey] = value;
    }
  }

  return result;
};
