import type { BaseElement } from '../types.js';
import { type ListboxAttributes, ListboxAria, type ListboxProps } from './listbox.js';

/**
 * Reactive input properties for GalleryAria: a listbox's, since a gallery is a set of options to
 * pick one or several from.
 */
export type GalleryProps = ListboxProps;

/**
 * Headless gallery: a listbox whose options are tiles wrapping into rows — photos, products,
 * thumbnails. Left and right move in reading order, up and down move to the nearest tile in the
 * row above or below; picking, typeahead, and the single tab stop work as in any listbox.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class GalleryAria<E extends BaseElement = HTMLElement> extends ListboxAria<
  E,
  GalleryProps,
  ListboxAttributes<E>
> {
  protected override flow = true;
}
