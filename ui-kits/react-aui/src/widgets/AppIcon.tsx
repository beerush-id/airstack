import { branded, COLORS, register, SIZES } from '@airlib/aui/utils';
import { Show, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles } from '../config.js';
import { Image, ImageContent, ImageFallback } from './Image.js';

export type AppIconProps = Omit<ComponentProps<'button'>, 'color' | 'className' | 'children'> &
  Omit<ComponentStyles, 'variant'> & {
    /** The app's name. Names the icon for screen readers and seeds the initials. */
    alt: string;
    /** Picture of the app, painting as it arrives; if it fails, `icon` or the initials show instead. */
    src?: string;
    /** A glyph for the app, shown in place of the initials. */
    icon?: ReactNode;
    /** A caption under the tile, such as the app's name in a launcher. It names the button instead of `alt`. */
    children?: ReactNode;
  };

export type AppIconTileProps = Pick<AppIconProps, 'alt' | 'src' | 'icon' | 'color'> & {
  /** Hides the tile from screen readers when something else already names the app. */
  'aria-hidden'?: 'true';
};

const APP_ICON = branded('app-icon');
const APP_ICON_TILE = branded('app-icon-tile');
const APP_ICON_LABEL = branded('app-icon-label');
const SCALE = branded('scale');

const APP_ICON_OMIT: Array<keyof AppIconProps> = ['alt', 'src', 'icon', 'size', 'color', 'className', 'children'];

register('appIcon', { size: SIZES.MD, color: COLORS.PRIMARY });

/**
 * An app as a pressable tile: its picture, or its glyph or initials while
 * there is none, with an optional caption underneath. It is a plain button,
 * so `onClick`, `aria-pressed`, and `disabled` work as they do on any button.
 */
export const AppIcon = setup<AppIconProps>((props) => {
  const className = () => $families([SCALE, APP_ICON], props, auiConfig.appIcon);

  // With a caption the tile only repeats the name, so the caption alone names the button.
  return () => (
    <button type="button" {...props.$omit(APP_ICON_OMIT)} className={className()}>
      <AppIconTile
        src={props.src}
        alt={props.alt}
        icon={props.icon}
        color={props.color}
        aria-hidden={props.children ? 'true' : undefined}
      />
      <Show when={() => props.children}>{() => <span className={APP_ICON_LABEL}>{props.children}</span>}</Show>
    </button>
  );
}, 'AppIcon');

/**
 * The tile alone — the app's picture, or its glyph or initials, on raised
 * glass. Put it in your own button when that button is already another
 * part, such as a dialog trigger, and give the button the `aui-app-icon`
 * class so it looks and moves like every other app icon.
 */
export const AppIconTile = setup<AppIconTileProps>((props) => {
  return () => (
    <Image
      src={props.src}
      alt={props.alt}
      color={props.color}
      className={APP_ICON_TILE}
      aria-hidden={props['aria-hidden']}
    >
      <ImageFallback>{props.icon}</ImageFallback>
      <ImageContent />
    </Image>
  );
}, 'AppIconTile');
