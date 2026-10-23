import type { AriaEvent, AriaEventHandler, BaseElement } from '../types.js';
import { type ListboxAttributes, ListboxAria, type ListboxProps } from './listbox.js';

/**
 * A prompt point on an image, in the image's own pixels: where to look, and whether what's there
 * belongs to the object or not.
 */
export type SegmentPoint = { x: number; y: number; include: boolean };

/**
 * Event carrying the prompt point just placed.
 */
export type SegmentPointEvent = AriaEvent<SegmentPoint>;

/**
 * Reactive input properties for ImageSegmentsAria: a listbox's — its options are the image's
 * segments — plus the point prompts.
 */
export type ImageSegmentsProps = ListboxProps & {
  /** `select` picks segments; `point` places prompt points for finding a new one. */
  mode?: 'select' | 'point';
  /** The prompt points placed so far, in the image's pixels. */
  points?: SegmentPoint[];
  /** Called with each point as it's placed. */
  onpoint?: AriaEventHandler<SegmentPointEvent>;
};

/**
 * Headless segmentation surface: an image's segments — the masks a model like SAM returns — as
 * options to pick, one or several, with the listbox's keys and announcements. In `point` mode a
 * press places a prompt point instead, measured in the image's own pixels through the surface's
 * transform, so its size and zoom never skew it; Alt marks the point as excluded. The surface is
 * the `<svg>` that draws the image, its viewBox the image's size.
 *
 * @template E - Target Element type (defaults to SVGSVGElement)
 */
export class ImageSegmentsAria<E extends BaseElement = SVGSVGElement> extends ListboxAria<
  E,
  ImageSegmentsProps,
  ListboxAttributes<E>
> {
  public constructor(props: Partial<ImageSegmentsProps> = {}) {
    super(props, true);
    this.omittedAttrs.push('mode', 'points', 'onpoint');
    this.on('pointerdown', this.handlePointerDown);
    this.update();
  }

  /**
   * Places a prompt point.
   *
   * @param point - Where, in the image's pixels, and whether it's included.
   */
  public addPoint(point: SegmentPoint): void {
    this.properties.points = [...(this.properties.points ?? []), point];

    const event: SegmentPointEvent = new CustomEvent('point', { bubbles: true, detail: point });
    this.element?.dispatchEvent(event);
    this.properties.onpoint?.(event);
  }

  /** Clears every prompt point. */
  public clearPoints(): void {
    this.properties.points = [];
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.properties.mode !== 'point' || event.button !== 0 || event.defaultPrevented) return;

    const svg = this.element as unknown as SVGSVGElement | null;
    const matrix = svg?.getScreenCTM?.();
    if (!svg || !matrix) return;

    const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    event.preventDefault();
    this.addPoint({ x: Math.round(at.x), y: Math.round(at.y), include: !event.altKey });
  };
}
