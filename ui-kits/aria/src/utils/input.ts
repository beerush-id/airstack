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
export function readFloat(value: string | number | null | undefined): number | undefined | null {
  if (typeof value !== 'string') return value;
  const [float] = value.match(VALID_NUMBER) ?? [];
  return float ? Number(float) : undefined;
}

/**
 * Select all text within the given element.
 *
 * Constructs a Range enclosing the element's node contents and assigns it to the
 * active Selection.
 *
 * @param target - The element whose contents become the selection.
 */
export function focusSelect(target: Element): void {
  /* istanbul ignore next: server renders never hold a selection */
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const selection = window.getSelection()!;

  const range = document.createRange();
  range.selectNodeContents(target);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Execute a mutation callback while maintaining text cursor and selection position.
 *
 * In contenteditable elements, programmatically mutating text or replacing DOM children
 * resets or discards the active selection. This utility captures the user's cursor offset
 * before the mutation and restores it inside a finally block.
 *
 * @param fn - Callback that mutates the active element's text content or value.
 * @returns The value returned by the callback.
 */
export function maintainCursor<T = void>(fn: () => T): T {
  /* istanbul ignore next: server renders never hold a selection */
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return fn();
  }

  const active = document.activeElement;

  const selection = window.getSelection()!;
  if (
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
 * Locate the text node and character offset for a caret position inside a container
 * whose text the controller owns as a single write.
 *
 * @param container - Root DOM element containing the written text.
 * @param offset - Character offset from the start of the container.
 * @returns Pair of target DOM node and clamped character offset within that node.
 */
function resolvePosition(container: Node, offset: number): [Node, number] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const node = walker.nextNode();

  /* istanbul ignore next: a host without text nodes cannot hold a selection */
  if (!node) return [container, 0];

  const length = (node as Text).data.length;
  return [node, Math.min(length, Math.max(0, offset))];
}
