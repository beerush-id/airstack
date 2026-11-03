import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type Bindable, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** Image visual keys follow the shared control families; the rest is plain DOM. */
export type ImageProps = Omit<ComponentProps<'div'>, 'color'> &
  Partial<ComponentStyles> & {
    children?: ReactNode;
    src?: string;
    alt: string;
    status?: Bindable<ImageStatus>;
    onchange?: (event: CustomEvent<ImageStatus>) => void;
  };

export type ImageContentProps = Omit<ComponentProps<'img'>, 'color'> & Partial<ComponentStyles>;

export type ImageFallbackProps = Omit<ComponentProps<'div'>, 'color'> &
  Partial<ComponentStyles> & {
    children?: ReactNode;
  };

const IMAGE_ROLE = 'image';
const IMAGE_CONTENT_ROLE = 'image-content';
const IMAGE_FALLBACK_ROLE = 'image-fallback';

const imageStyles: ComponentStyles = {};
const imageContentStyles: ComponentStyles = {};
const imageFallbackStyles: ComponentStyles = {};

register('image', imageStyles);
register('imageContent', imageContentStyles);
register('imageFallback', imageFallbackStyles);

/**
 * Coordinator that owns the source lifecycle and keeps exactly one of its
 * two compound parts on screen. Without children it renders both itself,
 * with the fallback holding the initials of `alt`. The `alt` is shared by
 * both parts; an empty string marks the image decorative. `src` changes
 * open a new lifecycle; the status is read-only.
 */
export const Image = setup<ImageProps>((props) => {
  const image = aria(IMAGE_ROLE, props);
  const className = () => $families(AUI_CLASS.IMAGE, props, auiConfig.image);

  return () => (
    <div ref={image.ref} {...image.restProps([...OMIT_KEYS])} className={className()}>
      {props.children ?? (
        <>
          <ImageFallback />
          <ImageContent />
        </>
      )}
    </div>
  );
}, 'Image');

/**
 * The loaded representation on a native `<img>`. The coordinator projects
 * the shared source and label; the part reports its own settling and
 * hides itself from assistive technology until it is the active
 * representation.
 */
export const ImageContent = setup<ImageContentProps>((props) => {
  const content = aria(IMAGE_CONTENT_ROLE, props);
  const className = () => $families(AUI_CLASS.IMAGE_CONTENT, props, auiConfig.imageContent);

  // biome-ignore lint/a11y/useAltText: controlled by Aria.
  return () => <img ref={content.ref} {...content.restProps([...OMIT_KEYS])} className={className()} />;
}, 'ImageContent');

/**
 * The placeholder representation — initials, a skeleton, an icon. It
 * carries the shared label while it is the active representation and
 * withdraws once the content settles or the source is decorative.
 */
export const ImageFallback = setup<ImageFallbackProps>((props) => {
  const fallback = aria(IMAGE_FALLBACK_ROLE, props);
  const className = () => $families(AUI_CLASS.IMAGE_FALLBACK, props, auiConfig.imageFallback);

  return () => (
    <div ref={fallback.ref} {...fallback.restProps([...OMIT_KEYS])} className={className()}>
      {props.children ?? fallback.initial}
    </div>
  );
}, 'ImageFallback');
