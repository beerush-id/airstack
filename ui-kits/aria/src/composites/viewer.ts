import { mutable } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaProps, BaseElement, DetachFn } from '../types.js';
import { openDragSession } from '../utils/pointer.js';
import { clampRange } from '../utils/range.js';
import type { FullscreenHost } from '../widgets/fullscreen.js';

/**
 * Event carrying the index of the image now on show.
 */
export type ImageViewerChangeEvent = AriaEvent<number>;

/**
 * Reactive input properties for ImageViewerAria.
 */
export interface ImageViewerProps extends AriaProps {
  /** Names the viewer for screen readers, e.g. "Photos from the park". */
  label?: string;
  /** The images the viewer steps through; only how many there are matters here. */
  items?: readonly unknown[];
  /** Which image is on show, from zero. */
  index?: number;
  /** How far the image is magnified; 1 fits it to the viewer. */
  zoom?: number;
  /** The most it can be magnified. Defaults to 4. */
  maxZoom?: number;
  /** How much one zoom step magnifies. Defaults to 0.5. */
  zoomStep?: number;
  /** Whether stepping past the last image goes back to the first. */
  loop?: boolean;
  onchange?: AriaEventHandler<ImageViewerChangeEvent>;
}

/**
 * Compiled HTML and ARIA attributes for an image viewer.
 */
export interface ImageViewerAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'group';
  tabindex?: number;
  'aria-roledescription'?: string;
  'aria-label'?: string;
  'data-zoomed'?: 'true';
}

const MIN_ZOOM = 1;

/**
 * Headless image viewer: one image of a set on show at a time, fit to the viewer, magnified and
 * moved around on request. The arrows and Home/End step through the set, `+`, `-` and `0` zoom,
 * the wheel zooms, and dragging moves a magnified image. Its position and zoom are published as
 * `--aria-viewer-x`, `--aria-viewer-y` and `--aria-viewer-zoom` for styles to apply. It can fill
 * the screen through a full-screen toggle inside it.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class ImageViewerAria<E extends BaseElement = HTMLElement>
  extends Aria<E, ImageViewerProps, ImageViewerAttributes<E>>
  implements FullscreenHost
{
  public readonly fullscreenHost = true as const;

  /**
   * Where a magnified image has been moved to, in pixels from center.
   */
  public pan = mutable({ x: 0, y: 0 });

  private closeDrag?: () => void;

  public constructor(props: Partial<ImageViewerProps> = {}) {
    super(props);
    this.omittedAttrs.push('label', 'items', 'index', 'zoom', 'maxZoom', 'zoomStep', 'loop', 'onchange');
    this.update();
  }

  /**
   * The image on show, from zero.
   */
  public get index(): number {
    return clampRange(this.properties.index ?? 0, 0, Math.max(this.count - 1, 0));
  }

  /**
   * How many images the viewer steps through.
   */
  public get count(): number {
    return this.properties.items?.length ?? 0;
  }

  /**
   * How far the image is magnified; 1 fits it.
   */
  public get zoom(): number {
    return clampRange(this.properties.zoom ?? MIN_ZOOM, MIN_ZOOM, this.maxZoom);
  }

  public get maxZoom(): number {
    return this.properties.maxZoom ?? 4;
  }

  /**
   * Shows the image at `index`, fit to the viewer.
   *
   * @param index - The image to show, from zero; wraps around with `loop`.
   */
  public show(index: number): void {
    const count = this.count;
    if (count === 0) return;

    const next = this.properties.loop ? ((index % count) + count) % count : clampRange(index, 0, count - 1);
    if (next === this.index) return;

    this.properties.index = next;
    this.fit();
    this.notifyChange();
  }

  /** Shows the next image. */
  public next(): void {
    this.show(this.index + 1);
  }

  /** Shows the previous image. */
  public previous(): void {
    this.show(this.index - 1);
  }

  /**
   * Magnifies the image to `zoom`, keeping it inside its bounds.
   *
   * @param zoom - The magnification; 1 fits the image.
   */
  public zoomTo(zoom: number): void {
    this.properties.zoom = clampRange(zoom, MIN_ZOOM, this.maxZoom);
    if (this.properties.zoom === MIN_ZOOM) this.pan.x = this.pan.y = 0;
    else this.clampPan();
  }

  /** Magnifies one step. */
  public zoomIn(): void {
    this.zoomTo(this.zoom + (this.properties.zoomStep ?? 0.5));
  }

  /** Shrinks one step, down to fitting. */
  public zoomOut(): void {
    this.zoomTo(this.zoom - (this.properties.zoomStep ?? 0.5));
  }

  /** Fits the image to the viewer again. */
  public fit(): void {
    this.zoomTo(MIN_ZOOM);
  }

  protected override createAttributes(): ImageViewerAttributes<E> {
    const zoom = this.zoom;

    return {
      role: 'group',
      tabindex: 0,
      'aria-roledescription': 'image viewer',
      'aria-label': this.properties.label,
      'data-zoomed': zoom > MIN_ZOOM ? 'true' : undefined,
      style: {
        '--aria-viewer-zoom': String(zoom),
        '--aria-viewer-x': `${this.pan.x}px`,
        '--aria-viewer-y': `${this.pan.y}px`,
      },
      onkeydown: this.handleKey,
      onwheel: this.handleWheel,
      onpointerdown: this.handlePointerDown,
    } as ImageViewerAttributes<E>;
  }

  protected override attach(): DetachFn | void {
    return () => this.closeDrag?.();
  }

  /** Keeps a magnified image from being moved off its own edges. */
  private clampPan(): void {
    const box = (this.element as unknown as HTMLElement | null)?.getBoundingClientRect();
    if (!box) return;

    const limitX = (box.width * (this.zoom - 1)) / 2;
    const limitY = (box.height * (this.zoom - 1)) / 2;
    this.pan.x = clampRange(this.pan.x, -limitX, limitX);
    this.pan.y = clampRange(this.pan.y, -limitY, limitY);
  }

  private notifyChange(): void {
    const event: ImageViewerChangeEvent = new CustomEvent('change', { bubbles: true, detail: this.index });
    this.element?.dispatchEvent(event);
    this.properties.onchange?.(event);
  }

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.target !== this.element) return;

    const actions: Record<string, () => void> = {
      ArrowRight: () => this.next(),
      ArrowLeft: () => this.previous(),
      Home: () => this.show(0),
      End: () => this.show(this.count - 1),
      '+': () => this.zoomIn(),
      '=': () => this.zoomIn(),
      '-': () => this.zoomOut(),
      '0': () => this.fit(),
    };

    const action = actions[event.key];
    if (!action) return;

    event.preventDefault();
    action();
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.zoom === MIN_ZOOM || event.defaultPrevented) return;

    this.closeDrag = openDragSession({
      onMove: (move) => {
        this.pan.x += move.movementX;
        this.pan.y += move.movementY;
        this.clampPan();
      },
      onUp: () => undefined,
      onCancel: () => undefined,
    });
  };
}
