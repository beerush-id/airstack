import { aria, type ListboxAria, type OptionAria } from '@airlib/aria';
import { AUI_CLASS, branded, COLORS, register, SIZES } from '@airlib/aui/utils';
import {
  $static,
  type AnyType,
  type Bindable,
  createContext,
  For,
  renderDynamic,
  setup,
  Show,
  Slot,
} from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CheckIcon } from '../icons/index.js';
import { createStyleScope } from '../utils/common.js';
import { Image } from '../widgets/Image.js';
import { type PickModeProps, pickModes } from './pick-modes.js';

export type GalleryValue = string | string[] | null;

/** One tile of an `items` gallery: a picture, and the words under it when it has any. */
export type GalleryEntry = {
  /** What the selection holds when this tile is picked. */
  value: string;
  /** The picture. */
  src: string;
  /** What the picture shows, for screen readers; empty only for a purely decorative tile. */
  alt: string;
  /** The tile's name under the picture: a product, a file, a place. */
  title?: string;
  /** One supporting line: a price, a size, a date. */
  description?: string;
  /** What sits at the caption's end: a rating, a duration, a count. */
  meta?: string;
  disabled?: boolean;
};

export type GallerySlots = {
  /** Content of each tile, replacing the picture and caption. */
  item: (entry: GalleryEntry, option: OptionAria) => ReactNode;
};

export type GalleryProps = ComponentStyles & {
  id?: string;
  /** Names the gallery for screen readers, e.g. "Photos from the park". */
  label?: string;
  /** The picked tile, or the checked tiles while picking several. */
  value?: Bindable<GalleryValue>;
  /** Whether several tiles are picked at once. With `checkable`, the gallery switches it itself; bind it to follow. */
  multiple?: Bindable<boolean>;
  /**
   * Puts a check on each tile, as photo libraries do. A click picks one tile, without a check;
   * checking a tile, or Ctrl/Cmd- or Shift-clicking one, switches to picking several, carrying
   * the picked tile along. Then a click checks or unchecks, and Shift-click checks a range.
   * Unchecking the last tile, Escape, or pressing the gallery's background switches back to
   * picking one, with none picked.
   */
  checkable?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Whether the tiles wrap into rows, so the arrows move by reading order and by row. Defaults to true. */
  flow?: boolean;
  items?: GalleryEntry[];
  children?: ReactNode | ((gallery: ListboxAria) => ReactNode);
  onchange?: (event: CustomEvent<string | string[]>) => void;
};

export type GalleryItemProps = ComponentStyles &
  Omit<GalleryEntry, 'value'> & {
    value: string;
    selected?: Bindable<boolean>;
    children?: ReactNode | ((option: OptionAria) => ReactNode);
  };

const LISTBOX_ROLE = 'listbox';
const OPTION_ROLE = 'option';
const ITEM_OMIT = [...OMIT_KEYS, 'src', 'alt', 'title', 'description', 'meta'];

const CAPTION = {
  TITLE: branded('gallery-caption-title'),
  DESCRIPTION: branded('gallery-caption-description'),
  META: branded('gallery-caption-meta'),
};
const CHECK_CLASS = branded('gallery-check');

register('gallery', {});
register('galleryItem', { size: SIZES.MD, color: COLORS.PRIMARY });

const galleryScope = createStyleScope();
/** The gallery its tiles belong to, for whether they carry a check. */
const galleryCtx = createContext<GalleryProps>();

/**
 * Pictures to pick from, laid out as tiles that wrap into rows: photos, products, thumbnails.
 * Pick one, or several with `multiple`; with `checkable`, people switch between the two as in a
 * photo library. The arrows move through the tiles in reading order and by row. With `items` it
 * renders every tile itself; the `item` slot refines each one.
 */
export const Gallery = setup<GalleryProps, GallerySlots>((props, slots) => {
  // A gallery is a listbox whose tiles wrap into rows, unless told they don't.
  $static(() => {
    if (props.flow === undefined) (props as GalleryProps).flow = true;
  });
  const gallery = aria(LISTBOX_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.GALLERY, { className: props.className }, auiConfig.gallery);

  galleryScope.provide(props);
  galleryCtx.set(props);

  const modes = pickModes(props as PickModeProps, `.${CHECK_CLASS}`);

  return () => (
    <div
      ref={gallery.ref}
      {...gallery.restProps([...OMIT_KEYS, 'items', 'checkable'])}
      className={className()}
      {...modes}
    >
      {props.items ? (
        <For each={() => props.items ?? []}>
          {(entry) => (
            <GalleryItem
              value={entry.value}
              src={entry.src}
              alt={entry.alt}
              title={entry.title}
              description={entry.description}
              meta={entry.meta}
              disabled={entry.disabled}
            >
              {(option) => <Slot for={() => slots.item?.(entry, option)}>{GalleryTile(entry)}</Slot>}
            </GalleryItem>
          )}
        </For>
      ) : (
        renderDynamic(props.children, gallery)
      )}
    </div>
  );
}, 'Gallery');

/**
 * One tile: the picture and its caption. Its accessible name is its title, or the picture's `alt`
 * when it has none. While several are picked, or in a `checkable` gallery, it carries a check:
 * filled while checked, an empty circle otherwise.
 */
export const GalleryItem = setup<GalleryItemProps>((props) => {
  const styles = galleryScope.inherit(props);
  const gallery = galleryCtx.get();
  const option = aria(OPTION_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.SCALE, AUI_CLASS.GALLERY_ITEM], styles, auiConfig.galleryItem);

  return () => (
    <div
      ref={option.ref}
      {...option.restProps(ITEM_OMIT as never)}
      aria-label={props.title ?? props.alt}
      className={className()}
    >
      {props.children ? renderDynamic(props.children, option) : GalleryTile(props)}
      <Show when={() => gallery?.checkable || gallery?.multiple}>
        {() => (
          <span
            className={CHECK_CLASS}
            aria-hidden="true"
            data-checked={gallery?.multiple && option.selected ? 'true' : undefined}
          >
            <CheckIcon />
          </span>
        )}
      </Show>
    </div>
  );
}, 'GalleryItem');

/**
 * What a tile shows by default: the picture, then the caption when there are words for it. The
 * picture is decorative once a title names the tile, so the name isn't read twice.
 *
 * @param entry - The tile's picture and words.
 * @returns The tile's content.
 */
function GalleryTile(entry: Omit<GalleryEntry, 'value'>): ReactNode {
  return (
    <>
      <Image src={entry.src} alt={entry.title ? '' : entry.alt} className={AUI_CLASS.GALLERY_MEDIA} />
      {(entry.title || entry.description || entry.meta) && (
        <div className={AUI_CLASS.GALLERY_CAPTION}>
          {entry.title && <span className={CAPTION.TITLE}>{entry.title}</span>}
          {entry.description && <span className={CAPTION.DESCRIPTION}>{entry.description}</span>}
          {entry.meta && <span className={CAPTION.META}>{entry.meta}</span>}
        </div>
      )}
    </>
  );
}
