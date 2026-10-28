import { anchor } from '../engine/anchor.js';
import { mutable } from '../reactive/ref.js';
import { isBrowser } from '../shared/env.js';
import { microtask } from '../utils/task.js';
import { onInteractive } from './interactive.js';

const SELECTION_INIT = {
  rect: null as DOMRect | null,
  rects: [] as DOMRect[],
  paths: (padding = 0, radius = 0): string => {
    /* istanbul ignore start */
    const rect = SELECTION_STATE.rect as DOMRect | null;
    const rawRects = SELECTION_STATE.rects as DOMRect[];
    if (!rect || !rawRects.length) return '';

    const offset = padding / 2;
    const padded = rawRects.map((r) => ({
      left: r.x - rect.x + offset,
      top: r.y - rect.y + offset,
      right: r.x - rect.x + r.width + padding * 2 + offset,
      bottom: r.y - rect.y + r.height + padding * 2 + offset,
      unpaddedTop: r.y - rect.y + padding + offset,
      unpaddedBottom: r.y - rect.y + r.height + padding + offset,
    }));

    padded.sort((a, b) => {
      if (Math.abs(a.unpaddedTop - b.unpaddedTop) > 5) return a.unpaddedTop - b.unpaddedTop;
      return a.left - b.left;
    });

    const lines: typeof padded = [];
    for (const p of padded) {
      if (!lines.length) {
        lines.push({ ...p });
        continue;
      }
      const last = lines[lines.length - 1];
      if (Math.abs(p.unpaddedTop - last.unpaddedTop) < 5) {
        if (p.left <= last.right + Math.max(1, padding)) {
          last.right = Math.max(last.right, p.right);
          last.top = Math.min(last.top, p.top);
          last.bottom = Math.max(last.bottom, p.bottom);
          last.unpaddedTop = Math.min(last.unpaddedTop, p.unpaddedTop);
          last.unpaddedBottom = Math.max(last.unpaddedBottom, p.unpaddedBottom);
          continue;
        }
      }
      lines.push({ ...p });
    }

    const blocks: (typeof lines)[] = [];
    for (const line of lines) {
      let matchedBlock = null;
      for (let i = blocks.length - 1; i >= 0; i--) {
        const B = blocks[i];
        const last = B[B.length - 1];

        const vGap = line.unpaddedTop - last.unpaddedBottom;
        if (vGap <= Math.max(12, padding * 1.5) && line.unpaddedTop >= last.unpaddedTop - 5) {
          const hOverlap =
            Math.max(line.left, last.left) <= Math.min(line.right, last.right) + Math.max(24, padding * 2);
          if (hOverlap) {
            matchedBlock = B;
            break;
          }
        }
      }

      if (matchedBlock) {
        matchedBlock.push(line);
      } else {
        blocks.push([line]);
      }
    }

    const allPaths: string[] = [];
    for (const B of blocks) {
      type Vertex = { x: number; y: number; outer: boolean };
      const v: Vertex[] = [];

      v.push({ x: B[0].left, y: B[0].top, outer: true });
      v.push({ x: B[0].right, y: B[0].top, outer: true });

      for (let i = 0; i < B.length - 1; i++) {
        if (B[i + 1].right > B[i].right) {
          v.push({ x: B[i].right, y: B[i + 1].top, outer: false });
          v.push({ x: B[i + 1].right, y: B[i + 1].top, outer: true });
        } else if (B[i + 1].right < B[i].right) {
          v.push({ x: B[i].right, y: B[i].bottom, outer: true });
          v.push({ x: B[i + 1].right, y: B[i].bottom, outer: false });
        }
      }

      v.push({ x: B[B.length - 1].right, y: B[B.length - 1].bottom, outer: true });
      v.push({ x: B[B.length - 1].left, y: B[B.length - 1].bottom, outer: true });

      for (let i = B.length - 1; i > 0; i--) {
        if (B[i - 1].left < B[i].left) {
          v.push({ x: B[i].left, y: B[i - 1].bottom, outer: false });
          v.push({ x: B[i - 1].left, y: B[i - 1].bottom, outer: true });
        } else if (B[i - 1].left > B[i].left) {
          v.push({ x: B[i].left, y: B[i].top, outer: true });
          v.push({ x: B[i - 1].left, y: B[i].top, outer: false });
        }
      }

      let path = '';
      for (let i = 0; i < v.length; i++) {
        const p = v[(i - 1 + v.length) % v.length];
        const c = v[i];
        const n = v[(i + 1) % v.length];

        const l1 = Math.hypot(c.x - p.x, c.y - p.y);
        const l2 = Math.hypot(n.x - c.x, n.y - c.y);

        if (radius > 0 && l1 > 0 && l2 > 0) {
          const r = Math.min(radius, l1 / 2, l2 / 2);
          const a1 = Math.atan2(c.y - p.y, c.x - p.x);
          const a2 = Math.atan2(n.y - c.y, n.x - c.x);
          const x1 = c.x - r * Math.cos(a1);
          const y1 = c.y - r * Math.sin(a1);
          const x2 = c.x + r * Math.cos(a2);
          const y2 = c.y + r * Math.sin(a2);
          const sweep = (a2 - a1 + Math.PI * 2) % (Math.PI * 2) > Math.PI ? 0 : 1;

          if (i === 0) path += `M ${x1},${y1} `;
          else path += `L ${x1},${y1} `;

          path += `A ${r},${r} 0 0,${sweep} ${x2},${y2} `;
        } else {
          if (i === 0) path += `M ${c.x},${c.y} `;
          else path += `L ${c.x},${c.y} `;
        }
      }
      path += 'Z';
      allPaths.push(path);
    }

    /* istanbul ignore end */
    return allPaths.join(' ');
  },
  size: 0,
  text: '',
  target: undefined,
};

/**
 * Interface representing the reactive text selection state.
 */
export type LiveSelection<E extends Element = Element> = Omit<typeof SELECTION_INIT, 'target'> & {
  target?: E;
};

const SELECTION_STATE = mutable(SELECTION_INIT, { recursive: false }) as LiveSelection;
/**
 * Reactive text selection state.
 * Used to capture user-selected text, its size, and spatial boundaries for rich text or tooltip interactions.
 */
export const LIVE_SELECTION = {} as LiveSelection;

let SELECTION_WATCHED = false;

for (const key of Object.keys(SELECTION_INIT)) {
  Object.defineProperty(LIVE_SELECTION, key, {
    get() {
      watchSelection();
      return SELECTION_STATE[key as keyof LiveSelection];
    },
  });
}

function watchSelection() {
  if (SELECTION_WATCHED || !isBrowser()) return;
  SELECTION_WATCHED = true;

  onInteractive(() => {
    const [schedule, cancel] = microtask(0);

    const assignSelection = (selection: Selection) => {
      const text = selection.toString();
      let rect: DOMRect | null = null;
      let rects: DOMRect[] = [];
      let target: Element | undefined;

      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        rect = range.getBoundingClientRect();
        rects = Array.from(range.getClientRects());

        const container = range.commonAncestorContainer;
        target = (container.nodeType === Node.TEXT_NODE ? container.parentElement : container) as Element;
      }

      anchor.assign(SELECTION_STATE, {
        rect,
        rects,
        size: text.length,
        text,
        target,
      });
    };
    const clearSelection = () => {
      anchor.assign(SELECTION_STATE, {
        rect: null,
        rects: [],
        size: 0,
        text: '',
      });
    };

    // Words selected in a text field aren't the document's selection: they're the field's own.
    const assignFieldSelection = (field: TextField) => {
      const start = field.selectionStart ?? 0;
      const end = field.selectionEnd ?? 0;
      const text = field.value.slice(start, end);
      const rect = fieldSelectionRect(field, start, end);
      anchor.assign(SELECTION_STATE, { rect, rects: [rect], size: text.length, text, target: field });
    };

    const selectionHandler = () => {
      const field = focusedTextField();
      if (field) {
        if (field.selectionStart === field.selectionEnd) return clearSelection();
        return schedule(() => assignFieldSelection(field));
      }

      const selection = window.getSelection();

      if (!selection?.rangeCount || selection.isCollapsed) {
        return clearSelection();
      }

      schedule(() => assignSelection(selection));
    };

    const selection = window.getSelection();
    if (selection?.rangeCount) {
      assignSelection(selection);
    }

    document.addEventListener('selectionchange', selectionHandler);

    return () => {
      document.removeEventListener('selectionchange', selectionHandler);
      cancel();
    };
  });
}

/** A field people type text into, whose selection is its own. */
type TextField = HTMLTextAreaElement | HTMLInputElement;

/** The kinds of input that hold text a selection can be made in. */
const TEXT_INPUTS = new Set(['text', 'search', 'url', 'tel', 'email', 'password']);

/**
 * The text field that has focus, if one does.
 *
 * @returns The focused textarea or text input, or nothing.
 */
function focusedTextField(): TextField | undefined {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement) return active;
  if (active instanceof HTMLInputElement && TEXT_INPUTS.has(active.type)) return active;
}

/** What a mirror of a field takes from it, so its text wraps and sits exactly as the field's does. */
const MIRRORED = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'tabSize',
  'wordSpacing',
] as const;

/**
 * Where the words selected in a text field sit on screen. A field doesn't expose that, so a hidden
 * copy of it, laid out the same, holds its text with the selected words marked, and the mark is
 * measured, then moved by the field's place and how far it has scrolled.
 *
 * @param field - The field.
 * @param start - Where the selection starts in its value.
 * @param end - Where it ends.
 * @returns The selection's box, in the viewport.
 */
function fieldSelectionRect(field: TextField, start: number, end: number): DOMRect {
  const style = getComputedStyle(field);
  const mirror = document.createElement('div');
  for (const key of MIRRORED) mirror.style[key] = style[key];
  Object.assign(mirror.style, {
    position: 'absolute',
    top: '0',
    left: '-9999px',
    visibility: 'hidden',
    overflow: 'hidden',
    whiteSpace: field instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre',
    overflowWrap: field instanceof HTMLTextAreaElement ? 'break-word' : 'normal',
  });

  const mark = document.createElement('span');
  mark.textContent = field.value.slice(start, end) || '​';
  mirror.append(field.value.slice(0, start), mark, field.value.slice(end));
  document.body.append(mirror);

  const box = field.getBoundingClientRect();
  const from = mirror.getBoundingClientRect();
  const at = mark.getBoundingClientRect();
  mirror.remove();

  return new DOMRect(
    box.left + (at.left - from.left) - field.scrollLeft,
    box.top + (at.top - from.top) - field.scrollTop,
    at.width,
    at.height
  );
}
