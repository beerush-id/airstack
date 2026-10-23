import { aria, type GalleryAria, type OptionAria } from '@airlib/aria';
import { AUI_CLASS, branded, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, renderDynamic, Show, Slot, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CheckIcon } from '../icons/index.js';
import { createStyleScope } from '../utils/common.js';
import { Image } from '../widgets/Image.js';

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
  value?: Bindable<GalleryValue>;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  items?: GalleryEntry[];
  children?: ReactNode | ((gallery: GalleryAria) => ReactNode);
  onchange?: (event: CustomEvent<string | string[]>) => void;
};

export type GalleryItemProps = ComponentStyles & Omit<GalleryEntry, 'value'> & {
  value: string;
  selected?: Bindable<boolean>;
  children?: ReactNode | ((option: OptionAria) => ReactNode);
};

const GALLERY_ROLE = 'gallery';
const OPTION_ROLE = 'option';
const ITEM_OMIT = [...OMIT_KEYS, 'src', 'alt', 'title', 'description', 'meta'];

const CAPTION = {
  TITLE: branded('gallery-caption-title'),
  DESCRIPTION: branded('gallery-caption-description'),
  META: branded('gallery-caption-meta'),
};

register('gallery', {});
register('galleryItem', { size: SIZES.MD, color: COLORS.PRIMARY });

const galleryScope = createStyleScope();

/**
 * Pictures to pick from, laid out as tiles that wrap into rows: photos, products, thumbnails.
 * Pick one, or several with `multiple`; the arrows move through the tiles in reading order and
 * by row. With `items` it renders every tile itself; the `item` slot refines each one.
 */
export const Gallery = setup<GalleryProps, GallerySlots>((props, slots) => {
  const gallery = aria(GALLERY_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.GALLERY, { className: props.className }, auiConfig.gallery);

  galleryScope.provide(props);

  return () => (
    <div ref={gallery.ref} {...gallery.restProps([...OMIT_KEYS, 'items'])} className={className()}>
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
 * One tile: the picture, its caption, and a check while it's picked. Its accessible name is its
 * title, or the picture's `alt` when it has none.
 */
export const GalleryItem = setup<GalleryItemProps>((props) => {
  const styles = galleryScope.inherit(props);
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
      <Show when={() => option.selected}>{() => <CheckIcon aria-hidden="true" />}</Show>
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
