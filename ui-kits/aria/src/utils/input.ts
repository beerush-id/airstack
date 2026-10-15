/**
 * Regular expression matching signed or unsigned integer and decimal numbers.
 */
export const VALID_NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * Parse an input string into a number when it strictly conforms to a decimal format.
 *
 * Non-string values (`null` or `undefined`) pass through untouched. Strings that do
 * not match a valid number format return `undefined` instead of `NaN`.
 *
 * @param value - Raw input value to validate and parse.
 * @returns The parsed numeric value, the original `null`/`undefined`, or `undefined` if malformed.
 */
export function readFloat(value: string | null | undefined): number | undefined | null {
  if (typeof value !== 'string') return value;
  const [float] = value.match(VALID_NUMBER) ?? [];
  return float ? Number(float) : undefined;
}

/**
 * Select all text within the focused element or an explicitly provided target.
 *
 * For native inputs (`<input>` and `<textarea>`), invokes native `.select()`.
 * For custom hosts and `contenteditable` elements, constructs a Range enclosing
 * the element's node contents and assigns it to the active Selection.
 *
 * @param element - Optional target element. Defaults to `document.activeElement`.
 */
export function focusSelect(element?: Element | null): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const target = element ?? document.activeElement;
  if (!target) return;

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.select();
    return;
  }

  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(target);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Execute a mutation callback while maintaining text cursor and selection position.
 *
 * In both native inputs and contenteditable elements, programmatically mutating text or
 * replacing DOM children resets or discards the active selection. This utility captures
 * the user's cursor offset before the mutation and restores it inside a finally block.
 *
 * @param fn - Callback that mutates the active element's text content or value.
 * @returns The value returned by the callback.
 */
export function maintainCursor<T = void>(fn: () => T): T {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return fn();
  }

  const active = document.activeElement;

  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    const start = active.selectionStart;
    const end = active.selectionEnd;
    const direction = active.selectionDirection;

    try {
      return fn();
    } finally {
      if (start !== null && end !== null) {
        active.setSelectionRange(start, end, direction ?? undefined);
      }
    }
  }

  const selection = window.getSelection();
  if (
    !selection ||
    selection.rangeCount === 0 ||
    !active ||
    !active.contains(selection.anchorNode) ||
    !active.contains(selection.focusNode)
  ) {
    return fn();
  }

  const range = selection.getRangeAt(0);
  const preRange = document.createRange();
  preRange.selectNodeContents(active);
  preRange.setEnd(range.startContainer, range.startOffset);
  const start = preRange.toString().length;

  preRange.setEnd(range.endContainer, range.endOffset);
  const end = preRange.toString().length;

  try {
    return fn();
  } finally {
    const [startNode, startOffset] = resolvePosition(active, start);
    const [endNode, endOffset] = resolvePosition(active, end);

    const newRange = document.createRange();
    newRange.setStart(startNode, startOffset);
    newRange.setEnd(endNode, endOffset);

    selection.removeAllRanges();
    selection.addRange(newRange);
  }
}

/**
 * Locate a text node and character offset corresponding to an absolute character position in a container.
 *
 * @param container - Root DOM element containing text nodes.
 * @param offset - Total character offset from the start of the container.
 * @returns Pair of target DOM node and character offset within that node.
 */
function resolvePosition(container: Node, offset: number): [Node, number] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let currentOffset = 0;
  let lastTextNode: Node | null = null;

  while (node) {
    lastTextNode = node;
    const len = node.textContent?.length ?? 0;
    if (currentOffset + len >= offset) {
      return [node, Math.max(0, offset - currentOffset)];
    }
    currentOffset += len;
    node = walker.nextNode();
  }

  if (lastTextNode) {
    return [lastTextNode, lastTextNode.textContent?.length ?? 0];
  }

  return [container, 0];
}
