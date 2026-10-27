import { $static, $symbol, mutable, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { openDragSession } from '../../utils/pointer.js';
import { WINDOW_INTERACTIVE } from './window.js';

const DESKTOP_WIDGET_SYMBOL = $symbol('desktop-widget');

const WIDGETS_SELECTOR = '[data-desktop-widgets]';
const WIDGET_SELECTOR = '[data-desktop-widget]';
/** How far the pointer moves before a press on a widget becomes a drag. */
const DRAG_SLOP = 4;

/** How many grid cells a widget takes, across by down, up to three each way. */
export type DesktopWidgetSpan = `${1 | 2 | 3}x${1 | 2 | 3}`;

/**
 * Reactive input properties for a desktop's widgets.
 */
export interface DesktopWidgetsProps extends AriaProps {
  /**
   * Accessible name for the widgets, e.g. "Widgets". With it they are a landmark; none is built in.
   */
  label?: string;
}

/**
 * Compiled attributes for a desktop's widgets.
 */
export interface DesktopWidgetsAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'region';
  'aria-label'?: string;
  'data-desktop-widgets'?: 'true';
}

/**
 * The layer of widgets on a desktop, beneath its windows: a grid of cells
 * across its width. Named, it is a landmark people can jump to.
 */
export class DesktopWidgetsAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  DesktopWidgetsProps,
  DesktopWidgetsAttributes<E>
> {
  public constructor(props: Partial<DesktopWidgetsProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('label', 'role', 'aria-label', 'data-desktop-widgets');
    this.update();
  }

  protected createAttributes(): DesktopWidgetsAttributes<E> {
    const label = this.properties.label;
    return { role: label ? 'region' : undefined, 'aria-label': label, 'data-desktop-widgets': 'true' };
  }
}

/**
 * Reactive input properties for a desktop widget.
 */
export interface DesktopWidgetProps extends AriaProps {
  /**
   * Deterministic identifier; the widget's title takes `${id}-title`.
   */
  id?: string;
  /**
   * Accessible name for a widget that shows no title. Without it, the widget
   * is named by its title, the element with id `${id}-title`.
   */
  label?: string;
  /**
   * The grid cells it takes, across by down. Defaults to `1x1`.
   */
  span?: DesktopWidgetSpan;
  /**
   * The grid column its left edge sits in, from 1. Without it, the widget
   * sits in the middle column. Written when the widget is moved.
   */
  column?: number;
  /**
   * The grid row its top sits in, from 1. Without it, the widget takes the
   * next free row. Written when the widget is moved.
   */
  row?: number;
  /**
   * Whether people may move it: by dragging its glass or title, or with the
   * arrow keys while it is focused. Defaults to true.
   */
  movable?: boolean;
}

/**
 * Compiled attributes for a desktop widget.
 */
export interface DesktopWidgetAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'group';
  tabindex?: number;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'data-desktop-widget'?: 'true';
  'data-span'?: DesktopWidgetSpan;
  'data-dragging'?: 'true';
  style?: Record<string, string>;
}

/**
 * One widget on a desktop: a group named by its title, the way a window is,
 * placed on its layer's grid. Dragging its glass or title moves it: it
 * follows the pointer (`--drag-move-x` and `--drag-move-y` while
 * `data-dragging`), and on release lands in the cell beneath its corner,
 * unless another widget is there, when it goes back. `Escape` calls a drag
 * off. With the widget itself focused, the arrow keys move it a cell.
 * Give it `trackPointer` and it writes the pointer's place for a glint.
 */
export class DesktopWidgetAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  DesktopWidgetProps,
  DesktopWidgetAttributes<E>
> {
  public readonly id: string;

  private readonly session = mutable({ dragging: false });
  private closeSession?: () => void;

  public constructor(props: Partial<DesktopWidgetProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.id = $static(() => this.properties.id ?? `desktop-widget-${uIndex(DESKTOP_WIDGET_SYMBOL, true)}`);
    this.cleanups.add(() => this.endDrag());
    this.omittedAttrs.push(
      'id',
      'label',
      'span',
      'column',
      'row',
      'movable',
      'role',
      'tabindex',
      'aria-label',
      'aria-labelledby',
      'data-desktop-widget',
      'data-span',
      'data-dragging',
      'style'
    );
    this.update();
  }

  /**
   * The id its title element takes, so the title names the widget.
   */
  public get titleId(): string {
    return `${this.id}-title`;
  }

  public get movable(): boolean {
    return this.properties.movable ?? true;
  }

  /**
   * Moves the widget to a cell, if it fits there: inside the grid's columns
   * and clear of every other widget.
   *
   * @param column - The column its left edge goes to, from 1.
   * @param row - The row its top goes to, from 1.
   * @returns True when it moved.
   */
  public moveTo(column: number, row: number): boolean {
    const element = this.element as HTMLElement | null;
    const layer = element?.closest<HTMLElement>(WIDGETS_SELECTOR);
    if (!element || !layer) return false;

    const lines = gridLines(layer);
    const [across, down] = spanOf(element);
    const last = Math.max(1, lines.xs.length - across + 1);
    if (column < 1 || column > last || row < 1) return false;

    for (const other of layer.querySelectorAll(WIDGET_SELECTOR) as never as HTMLElement[]) {
      if (other === element || !other.getClientRects().length) continue;
      const rect = other.getBoundingClientRect();
      const [otherAcross, otherDown] = spanOf(other);
      const otherColumn = nearestLine(lines.xs, rect.left, lines.pitchX);
      const otherRow = nearestLine(lines.ys, rect.top, lines.pitchY);
      const clearX = column + across <= otherColumn || otherColumn + otherAcross <= column;
      const clearY = row + down <= otherRow || otherRow + otherDown <= row;
      if (!clearX && !clearY) return false;
    }

    this.properties.column = column;
    this.properties.row = row;
    return true;
  }

  protected createAttributes(): DesktopWidgetAttributes<E> {
    const { label, span, column, row } = this.properties;
    const style: Record<string, string> = {};
    if (column !== undefined) style['--widget-column'] = String(column);
    if (row !== undefined) style['--widget-row'] = String(row);

    return {
      id: this.id,
      role: 'group',
      tabindex: this.movable ? 0 : undefined,
      'aria-label': label,
      'aria-labelledby': label ? undefined : this.titleId,
      'data-desktop-widget': 'true',
      'data-span': span ?? '1x1',
      'data-dragging': this.session.dragging ? 'true' : undefined,
      style,
      onkeydown: this.handleKeyDown,
    };
  }

  protected attach() {
    const element = this.element as unknown as HTMLElement;
    element.addEventListener('pointerdown', this.handlePointerDown);
    return () => element.removeEventListener('pointerdown', this.handlePointerDown);
  }

  /** Where the widget sits now, as a cell. */
  private currentCell(): { column: number; row: number } | undefined {
    const element = this.element as HTMLElement | null;
    const layer = element?.closest<HTMLElement>(WIDGETS_SELECTOR);
    if (!element || !layer) return undefined;
    const lines = gridLines(layer);
    const rect = element.getBoundingClientRect();
    return {
      column: nearestLine(lines.xs, rect.left, lines.pitchX),
      row: nearestLine(lines.ys, rect.top, lines.pitchY),
    };
  }

  /** A press on the widget's glass or title starts a drag; its controls and fields keep their own presses. */
  private readonly handlePointerDown = (event: PointerEvent): void => {
    const element = this.element as unknown as HTMLElement;
    const target = event.target as Element | null;
    if (!this.movable || event.button !== 0 || event.defaultPrevented) return;
    const control = target?.closest?.(WINDOW_INTERACTIVE);
    if (control && control !== element) return;

    const start = element.getBoundingClientRect();
    let dragging = false;
    this.endDrag();

    this.closeSession = openDragSession({
      host: element,
      startX: event.clientX,
      startY: event.clientY,
      onMove: (moveEvent) => {
        if (dragging || Math.hypot(moveEvent.clientX - event.clientX, moveEvent.clientY - event.clientY) < DRAG_SLOP)
          return;
        dragging = true;
        this.session.dragging = true;
      },
      onUp: (upEvent) => {
        this.endDrag();
        if (!dragging) return;
        const layer = element.closest<HTMLElement>(WIDGETS_SELECTOR);
        if (!layer) return;
        const lines = gridLines(layer);
        this.moveTo(
          nearestLine(lines.xs, start.left + upEvent.clientX - event.clientX, lines.pitchX),
          nearestLine(lines.ys, start.top + upEvent.clientY - event.clientY, lines.pitchY)
        );
      },
      onCancel: () => this.endDrag(),
    });
    window.addEventListener('keydown', this.handleEscape, true);
  };

  /** Escape calls a drag off, leaving the widget where it was. */
  private readonly handleEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.endDrag();
  };

  /** Ends a drag in progress, if any; with none, there is nothing to undo — not even on a server, where there is no window. */
  private endDrag(): void {
    if (!this.closeSession) return;
    this.closeSession();
    this.closeSession = undefined;
    this.session.dragging = false;
    window.removeEventListener('keydown', this.handleEscape, true);
    const element = this.element as HTMLElement | null;
    element?.style.removeProperty('--drag-move-x');
    element?.style.removeProperty('--drag-move-y');
    element?.style.removeProperty('--drag-start-x');
    element?.style.removeProperty('--drag-start-y');
  }

  /** With the widget itself focused, the arrows move it a cell. */
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.target !== this.element || !this.movable) return;
    const dir = ARROWS[event.key];
    if (!dir) return;
    event.preventDefault();
    const cell = this.currentCell();
    if (cell) this.moveTo(cell.column + dir[0], cell.row + dir[1]);
  };
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Where a grid's tracks start, in client coordinates, read from the tracks
 * it actually laid out — rows a growing widget made taller included — and
 * the spacing to carry them on past the last one.
 *
 * @param layer - The grid.
 * @returns Each column's and row's start, and the step between cells.
 */
function gridLines(layer: HTMLElement): { xs: number[]; ys: number[]; pitchX: number; pitchY: number } {
  const style = getComputedStyle(layer);
  const rect = layer.getBoundingClientRect();
  const columns = tracks(style.gridTemplateColumns);
  const rows = tracks(style.gridTemplateRows);
  const columnGap = Number.parseFloat(style.columnGap) || 0;
  const rowGap = Number.parseFloat(style.rowGap) || 0;
  const padLeft = Number.parseFloat(style.paddingLeft) || 0;
  const padRight = Number.parseFloat(style.paddingRight) || 0;
  const padTop = Number.parseFloat(style.paddingTop) || 0;
  const cell = columns[0] ?? 0;

  // The columns are centered as a whole, so the space they leave is split either side of them.
  const width = layer.clientWidth - padLeft - padRight;
  const used = columns.reduce((sum, size) => sum + size, 0) + columnGap * Math.max(0, columns.length - 1);
  let x = rect.left + layer.clientLeft + padLeft + Math.max(0, (width - used) / 2) - layer.scrollLeft;
  let y = rect.top + layer.clientTop + padTop - layer.scrollTop;

  const xs = columns.map((size) => {
    const at = x;
    x += size + columnGap;
    return at;
  });
  const ys = rows.map((size) => {
    const at = y;
    y += size + rowGap;
    return at;
  });

  return { xs, ys, pitchX: cell + columnGap, pitchY: cell + rowGap };
}

/**
 * The track sizes in a resolved track list, e.g. `160px 160px`.
 *
 * @param list - The resolved `grid-template-*` value.
 * @returns Each track's size in pixels.
 */
function tracks(list: string): number[] {
  return list
    .split(/\s+/)
    .map((size) => Number.parseFloat(size))
    .filter((size) => !Number.isNaN(size));
}

/**
 * The line nearest a position, from 1, carried on past the last line at the
 * cell step, so a widget can land in a row that doesn't exist yet.
 *
 * @param lines - Each track's start.
 * @param at - The position.
 * @param pitch - The step between cells.
 * @returns The 1-based line.
 */
function nearestLine(lines: number[], at: number, pitch: number): number {
  if (!lines.length) return 1;
  const last = lines[lines.length - 1];
  if (pitch > 0 && at > last + pitch / 2) return lines.length + Math.round((at - last) / pitch);

  let best = 0;
  for (let i = 1; i < lines.length; i++) {
    if (Math.abs(lines[i] - at) < Math.abs(lines[best] - at)) best = i;
  }
  return best + 1;
}

/**
 * How many cells a widget takes, from its `data-span`.
 *
 * @param element - The widget.
 * @returns Cells across and down.
 */
function spanOf(element: HTMLElement): [number, number] {
  const [across, down] = (element.dataset.span ?? '1x1').split('x').map(Number);
  return [across || 1, down || 1];
}
