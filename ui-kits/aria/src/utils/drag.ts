/**
 * Which features of a snap target attract a dragged box: its edges, its
 * center lines, or both.
 */
export type DragSnapMode = 'edge' | 'center' | 'all';

/**
 * The area a dragged box may not leave: a selector (the closest matching
 * ancestor, else the first match in the document), an element, the
 * `'viewport'`, or `'none'` for no limit.
 */
export type DragBounds = string | HTMLElement | 'viewport' | 'none';

/**
 * A box edge a resize moves. Corners move two edges at once.
 */
export type DragEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * Shared constraint vocabulary for anything a user drags or resizes.
 */
export interface DragConstraints {
  /**
   * Step the box snaps to, in pixels: one number for both axes or per axis.
   */
  grid?: number | { x?: number; y?: number };

  /**
   * The area the box is clamped into.
   */
  bounds?: DragBounds;

  /**
   * Selectors whose elements attract the box when an edge or center comes near.
   */
  snap?: string | string[];

  /**
   * What on a snap target attracts the box. Defaults to `'edge'`.
   */
  snapMode?: DragSnapMode;

  /**
   * How close, in pixels, a line must be before the box snaps to it. Defaults to 8.
   */
  snapThreshold?: number;

  /**
   * Space, in pixels, left between the box and a target it snaps against
   * face to face (its bottom to a dock's top). Edges that line up with each
   * other and centers stay flush. Defaults to 1.
   */
  snapGap?: number;

  /**
   * Locks movement to one axis.
   */
  axis?: 'x' | 'y';
}

/**
 * A box in client (viewport) coordinates.
 */
export interface DragBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Size limits a resize keeps to.
 */
export interface DragSizeLimits {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * One side of something along an axis: its start edge (left/top), its end
 * edge (right/bottom), or its center line.
 */
export type DragSide = 'start' | 'end' | 'center';

/**
 * A line a dragged box snaps to, in client coordinates, and which side of
 * its element it is — so a box meeting it face to face can keep a gap.
 */
export interface DragSnapLine {
  at: number;
  side: DragSide;
}

/**
 * Vertical (`xs`) and horizontal (`ys`) lines a dragged box snaps to.
 */
export interface DragSnapLines {
  xs: DragSnapLine[];
  ys: DragSnapLine[];
}

/**
 * Everything a drag session measures once at pick-up so every pointer move
 * stays a pure computation: the area to stay in and the lines to snap to.
 */
export interface DragFrame {
  bounds?: DOMRect;
  lines: DragSnapLines;
  grid: { x: number; y: number };
  threshold: number;
  gap: number;
  mode: DragSnapMode;
  axis?: 'x' | 'y';
}

const DEFAULT_THRESHOLD = 8;
const DEFAULT_GAP = 1;

/**
 * Elements that attract every dragged box without being listed in `snap`:
 * mark persistent furniture — a dock, a toolbar, a sidebar — with
 * `data-snap-target`.
 */
export const SNAP_TARGET_SELECTOR = '[data-snap-target]';

/**
 * Measures the bounds and snap lines for a box about to move, relative to the
 * element being dragged. Taken once per session: targets are assumed still
 * while the user drags.
 *
 * @param target - The element being dragged or resized; excluded from its own snap targets.
 * @param constraints - Grid, bounds, and snap configuration.
 * @param fallbackBounds - Area used when `bounds` is not given (e.g. the enclosing desktop).
 * @returns The frame every move of this session is computed against.
 */
export function measureDragFrame(
  target: HTMLElement,
  constraints: DragConstraints = {},
  fallbackBounds?: HTMLElement
): DragFrame {
  const grid = constraints.grid;
  const mode = constraints.snapMode ?? 'edge';
  const bounds = resolveBounds(target, constraints.bounds, fallbackBounds);
  const lines: DragSnapLines = { xs: [], ys: [] };

  if (bounds) {
    pushLines(lines, bounds, mode);
  }

  const own = typeof constraints.snap === 'string' ? [constraints.snap] : (constraints.snap ?? []);
  const selectors = [...own, SNAP_TARGET_SELECTOR];
  for (const selector of selectors) {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (element === target || target.contains(element) || element.contains(target)) continue;
      if (element.hidden || element.closest('[hidden]')) continue;
      pushLines(lines, element.getBoundingClientRect(), mode);
    }
  }

  return {
    bounds,
    lines,
    grid: {
      x: typeof grid === 'number' ? grid : (grid?.x ?? 0),
      y: typeof grid === 'number' ? grid : (grid?.y ?? 0),
    },
    threshold: constraints.snapThreshold ?? DEFAULT_THRESHOLD,
    gap: constraints.snapGap ?? DEFAULT_GAP,
    mode,
    axis: constraints.axis,
  };
}

/**
 * Moves a box by a pointer delta, then applies the grid, snap lines, and bounds.
 *
 * @param start - The box at pick-up, in client coordinates.
 * @param dx - Horizontal pointer travel since pick-up.
 * @param dy - Vertical pointer travel since pick-up.
 * @param frame - The session frame from `measureDragFrame`.
 * @returns The box at its new position, same size.
 */
export function moveBox(start: DragBox, dx: number, dy: number, frame: DragFrame): DragBox {
  const next = { ...start };

  if (frame.axis !== 'y') next.x = start.x + dx;
  if (frame.axis !== 'x') next.y = start.y + dy;

  next.x = snapToGrid(next.x, frame.grid.x, frame.bounds?.left);
  next.y = snapToGrid(next.y, frame.grid.y, frame.bounds?.top);

  if (frame.axis !== 'y') {
    next.x += nearestOffset(spanPoints(next.x, next.width, frame.mode), frame.lines.xs, frame);
  }
  if (frame.axis !== 'x') {
    next.y += nearestOffset(spanPoints(next.y, next.height, frame.mode), frame.lines.ys, frame);
  }

  if (frame.bounds) {
    next.x = clamp(next.x, frame.bounds.left, frame.bounds.right - next.width);
    next.y = clamp(next.y, frame.bounds.top, frame.bounds.bottom - next.height);
  }

  return next;
}

/**
 * Moves the given edges of a box by a pointer delta, then applies the grid,
 * snap lines, size limits, and bounds. Only the moving edges snap; the
 * opposite edges stay put.
 *
 * @param start - The box at pick-up, in client coordinates.
 * @param edge - Which edge or corner is being dragged.
 * @param dx - Horizontal pointer travel since pick-up.
 * @param dy - Vertical pointer travel since pick-up.
 * @param frame - The session frame from `measureDragFrame`.
 * @param limits - Minimum and maximum size.
 * @returns The resized box.
 */
export function resizeBox(
  start: DragBox,
  edge: DragEdge,
  dx: number,
  dy: number,
  frame: DragFrame,
  limits: DragSizeLimits = {}
): DragBox {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  const minW = limits.minWidth ?? 0;
  const minH = limits.minHeight ?? 0;
  const maxW = limits.maxWidth ?? Number.POSITIVE_INFINITY;
  const maxH = limits.maxHeight ?? Number.POSITIVE_INFINITY;
  const b = frame.bounds;

  if (edge.includes('e')) {
    right = settle(right + dx, 'end', frame.grid.x, b?.left, frame.lines.xs, frame);
    right = clamp(right, left + minW, Math.min(left + maxW, b ? b.right : Number.POSITIVE_INFINITY));
  }
  if (edge.includes('w')) {
    left = settle(left + dx, 'start', frame.grid.x, b?.left, frame.lines.xs, frame);
    left = clamp(left, Math.max(right - maxW, b ? b.left : Number.NEGATIVE_INFINITY), right - minW);
  }
  if (edge.includes('s')) {
    bottom = settle(bottom + dy, 'end', frame.grid.y, b?.top, frame.lines.ys, frame);
    bottom = clamp(bottom, top + minH, Math.min(top + maxH, b ? b.bottom : Number.POSITIVE_INFINITY));
  }
  if (edge.includes('n')) {
    top = settle(top + dy, 'start', frame.grid.y, b?.top, frame.lines.ys, frame);
    top = clamp(top, Math.max(bottom - maxH, b ? b.top : Number.NEGATIVE_INFINITY), bottom - minH);
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Rounds a coordinate to the nearest grid step, measured from an origin.
 *
 * @param value - The coordinate to round.
 * @param step - Grid step in pixels; 0 or less leaves the value as is.
 * @param origin - Where the grid starts (e.g. the bounds' left edge). Defaults to 0.
 * @returns The rounded coordinate.
 */
export function snapToGrid(value: number, step: number, origin = 0): number {
  if (!step || step <= 0) return value;
  return origin + Math.round((value - origin) / step) * step;
}

function settle(
  value: number,
  side: DragSide,
  step: number,
  origin: number | undefined,
  lines: DragSnapLine[],
  frame: DragFrame
): number {
  const gridded = snapToGrid(value, step, origin);
  return gridded + nearestOffset([{ at: gridded, side }], lines, frame);
}

function resolveBounds(target: HTMLElement, bounds?: DragBounds, fallback?: HTMLElement): DOMRect | undefined {
  if (bounds === 'none') return undefined;
  if (bounds === 'viewport' || (bounds === undefined && !fallback)) {
    return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  }
  if (bounds === undefined) return fallback!.getBoundingClientRect();
  if (typeof bounds !== 'string') return bounds.getBoundingClientRect();

  const element = target.parentElement?.closest<HTMLElement>(bounds) ?? document.querySelector<HTMLElement>(bounds);
  return element?.getBoundingClientRect();
}

function pushLines(lines: DragSnapLines, rect: DOMRect | DOMRectReadOnly, mode: DragSnapMode): void {
  if (mode !== 'center') {
    lines.xs.push({ at: rect.left, side: 'start' }, { at: rect.right, side: 'end' });
    lines.ys.push({ at: rect.top, side: 'start' }, { at: rect.bottom, side: 'end' });
  }
  if (mode !== 'edge') {
    lines.xs.push({ at: rect.left + rect.width / 2, side: 'center' });
    lines.ys.push({ at: rect.top + rect.height / 2, side: 'center' });
  }
}

function spanPoints(start: number, size: number, mode: DragSnapMode): DragSnapLine[] {
  const startEdge: DragSnapLine = { at: start, side: 'start' };
  const endEdge: DragSnapLine = { at: start + size, side: 'end' };
  const center: DragSnapLine = { at: start + size / 2, side: 'center' };
  if (mode === 'edge') return [startEdge, endEdge];
  if (mode === 'center') return [center];
  return [startEdge, center, endEdge];
}

/**
 * Where a point should land against a line: on it when the two line up
 * (same side, or centers), or `gap` away when they meet face to face (the
 * box's end against a target's start, or its start against a target's end).
 */
function landing(point: DragSnapLine, line: DragSnapLine, gap: number): number {
  if (point.side === 'end' && line.side === 'start') return line.at - gap;
  if (point.side === 'start' && line.side === 'end') return line.at + gap;
  return line.at;
}

function nearestOffset(points: DragSnapLine[], lines: DragSnapLine[], frame: DragFrame): number {
  let best = 0;
  let bestDistance = frame.threshold;

  for (const point of points) {
    for (const line of lines) {
      const offset = landing(point, line, frame.gap) - point.at;
      const distance = Math.abs(offset);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = offset;
      }
    }
  }

  return best;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
