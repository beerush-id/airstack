import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiProps, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { ArrowLeft, ArrowRight } from '../icons/index.js';
import { createStyleScope } from '../utils/common.js';

export type CarouselDirection = 1 | -1;

export type CarouselProps = AuiProps<'div'> & {
  id?: string;
  label: string;
  keys?: string[];
  value?: Bindable<string>;
  loop?: boolean;
  playing?: Bindable<boolean>;
  autoplay?: Bindable<boolean>;
  interval?: number;
  arrowNav?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  onchange?: (event: CustomEvent<string | undefined>) => void;
  ontoggle?: (event: CustomEvent<boolean>) => void;
};

export type CarouselViewportProps = AuiProps<'div'> & {
  label?: string;
  children?: ReactNode;
};

export type CarouselSlideProps = AuiProps<'div'> & {
  id?: string;
  name: string;
  children?: ReactNode;
};

export type CarouselNavProps = AuiProps<'button'> & {
  label?: string;
  direction: CarouselDirection;
  children?: ReactNode;
};

export type CarouselPickerProps = AuiProps<'button'> & {
  id?: string;
  name: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  children?: ReactNode;
};

export type CarouselPlayerProps = AuiProps<'button'> & {
  label?: string;
  playingLabel?: string;
  children?: ReactNode;
};

const CAROUSEL_ROLE = 'carousel';
const VIEWPORT_ROLE = 'carousel-viewport';
const SLIDE_ROLE = 'carousel-slide';
const NAV_ROLE = 'carousel-nav';
const PICKER_ROLE = 'carousel-picker';
const PLAYER_ROLE = 'carousel-player';

const VIEWPORT_OMIT = [...OMIT_KEYS, 'label'];
const NAV_OMIT = [...OMIT_KEYS, 'direction'];
const PICKER_OMIT = [...OMIT_KEYS, 'name', 'selected'];

const carouselButtonStyles: ComponentStyles = { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.TONAL };

register('carousel', {});
register('carouselViewport', {});
register('carouselSlide', {});
register('carouselNav', { ...carouselButtonStyles });
register('carouselPicker', { color: COLORS.PRIMARY });
register('carouselPlayer', { ...carouselButtonStyles });

const carouselScope = createStyleScope();

/**
 * One slide at a time behind a set of travelers. The root holds the current
 * slide, the rotation state, and the timer; the viewport, slides, steppers,
 * dots, and player all find it in scope, and follow its size, color, and variant.
 */
export const Carousel = setup<CarouselProps>((props) => {
  const carousel = aria(CAROUSEL_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CAROUSEL, { className: props.className }, auiConfig.carousel);

  carouselScope.provide(props);

  return () => (
    <div ref={carousel.ref} {...carousel.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'Carousel');

/**
 * The slide area and its single tab stop. Timed movement stays quiet while
 * rotation runs and becomes polite when it stops.
 */
export const CarouselViewport = setup<CarouselViewportProps>((props) => {
  const viewport = aria(VIEWPORT_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CAROUSEL_VIEWPORT, props, auiConfig.carouselViewport);

  return () => (
    <div ref={viewport.ref} {...viewport.restProps(VIEWPORT_OMIT)} className={className()}>
      {props.children}
    </div>
  );
}, 'CarouselViewport');

/**
 * One slide, visible only while its `name` is current and named for screen
 * readers by its dot.
 */
export const CarouselSlide = setup<CarouselSlideProps>((props) => {
  const slide = aria(SLIDE_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CAROUSEL_SLIDE, props, auiConfig.carouselSlide);

  return () => (
    <div ref={slide.ref} {...slide.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'CarouselSlide');

/**
 * One step button. It steps `direction` and disables itself at the bound it
 * has nowhere left to go, or while the group is locked. Without children it
 * shows an arrow pointing its way.
 */
export const CarouselNav = setup<CarouselNavProps>((props) => {
  const styles = carouselScope.inherit(props);
  const nav = aria(NAV_ROLE, props as AnyType);
  const className = () => {
    const families = $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.CAROUSEL_NAV], styles, auiConfig.carouselNav);
    return props.children ? families : `${families} ${AUI_CLASS.CONTROL_ICON}`;
  };

  return () => (
    <button ref={nav.ref} {...nav.restProps(NAV_OMIT)} type="button" className={className()}>
      {props.children ?? (props.direction < 0 ? <ArrowLeft aria-hidden="true" /> : <ArrowRight aria-hidden="true" />)}
    </button>
  );
}, 'CarouselNav');

/**
 * One dot. It jumps to the slide it names and marks itself current while that
 * slide is up.
 */
export const CarouselPicker = setup<CarouselPickerProps>((props) => {
  const scoped = carouselScope.inherit(props);
  const picker = aria(PICKER_ROLE, props as AnyType);
  const className = () =>
    $families(
      [AUI_CLASS.SCALE, AUI_CLASS.CAROUSEL_PICKER],
      { color: scoped.color, className: props.className },
      auiConfig.carouselPicker
    );

  return () => (
    <button ref={picker.ref} {...picker.restProps(PICKER_OMIT)} type="button" className={className()}>
      {props.children}
    </button>
  );
}, 'CarouselPicker');

/**
 * The play/pause button. Its state travels through the label swap, never
 * through a pressed state.
 */
export const CarouselPlayer = setup<CarouselPlayerProps>((props) => {
  const styles = carouselScope.inherit(props);
  const player = aria(PLAYER_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.CAROUSEL_PLAYER], styles, auiConfig.carouselPlayer);

  return () => (
    <button
      ref={player.ref}
      {...player.restProps([...OMIT_KEYS, 'label', 'playingLabel'] as never)}
      type="button"
      className={className()}
    >
      {props.children}
    </button>
  );
}, 'CarouselPlayer');
