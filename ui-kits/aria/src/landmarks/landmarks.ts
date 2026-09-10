import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';

/**
 * WAI-ARIA landmark roles compiled by this family.
 */
export type LandmarkRole =
  | 'banner'
  | 'main'
  | 'navigation'
  | 'complementary'
  | 'contentinfo'
  | 'search'
  | 'form'
  | 'region';

/**
 * Reactive input properties shared by every landmark.
 */
export interface LandmarkProps extends AriaProps {
  /**
   * Accessible label compiled to aria-label.
   */
  label?: string;

  /**
   * Element ID providing the accessible name, compiled to aria-labelledby.
   */
  labelledby?: string;
}

/**
 * Behavioral configuration options shared by every landmark.
 */
export interface LandmarkOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a landmark element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface LandmarkAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: LandmarkRole;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/**
 * Headless WAI-ARIA landmark base compiling an accessible name and the role the host
 * element does not already imply. Landmarks are structural: they take no focus, own no
 * keyboard behavior, and hold no state beyond their name.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export abstract class LandmarkAria<
  E extends BaseElement = HTMLElement,
  T extends LandmarkProps = LandmarkProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
  O extends LandmarkOptions = LandmarkOptions,
> extends Aria<E, T, A, O> {
  /**
   * WAI-ARIA role compiled when the host element does not already imply it.
   */
  protected abstract readonly landmarkRole: LandmarkRole;

  /**
   * Whether the landmark is exposed as a landmark only when it carries an accessible name.
   */
  protected readonly requiresName = false;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
    });

    this.omittedAttrs.push('aria-label', 'aria-labelledby');
    this.update();
  }

  /**
   * Accessible label compiled to aria-label.
   */
  public get label(): string | undefined {
    return this.props.label;
  }

  /**
   * Element ID providing the accessible name.
   */
  public get labelledby(): string | undefined {
    return this.props.labelledby;
  }

  /**
   * Whether the landmark carries an accessible name.
   */
  public get named(): boolean {
    return !!this.props.label || !!this.props.labelledby;
  }

  /**
   * Computes the HTML and ARIA attributes for the landmark.
   *
   * @returns Landmark attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      role: this.exposesRole ? this.landmarkRole : undefined,
      'aria-label': this.props.label,
      'aria-labelledby': this.props.labelledby,
    }) as A;
  }

  /**
   * Whether the role must be written explicitly rather than left to the host element.
   */
  protected get exposesRole(): boolean {
    return this.requiresName ? this.named : !this.isNative;
  }
}

/**
 * Reactive input properties for BannerAria.
 */
export interface BannerProps extends LandmarkProps {}

/**
 * Behavioral configuration options for BannerAria.
 */
export interface BannerOptions extends LandmarkOptions {}

/**
 * Headless WAI-ARIA banner landmark marking the prime header area of a document,
 * bound to a native `<header>` by default.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class BannerAria<
  E extends BaseElement = HTMLElement,
  T extends BannerProps = BannerProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override readonly landmarkRole: LandmarkRole = 'banner';
}

/**
 * Reactive input properties for MainAria.
 */
export interface MainProps extends LandmarkProps {}

/**
 * Behavioral configuration options for MainAria.
 */
export interface MainOptions extends LandmarkOptions {}

/**
 * Headless WAI-ARIA main landmark marking the primary unique content of a document,
 * bound to a native `<main>` by default.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class MainAria<
  E extends BaseElement = HTMLElement,
  T extends MainProps = MainProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override readonly landmarkRole: LandmarkRole = 'main';
}

/**
 * Reactive input properties for NavigationAria.
 */
export interface NavigationProps extends LandmarkProps {}

/**
 * Behavioral configuration options for NavigationAria.
 */
export interface NavigationOptions extends LandmarkOptions {}

/**
 * Headless WAI-ARIA navigation landmark marking a major collection of navigational
 * links, bound to a native `<nav>` by default. A page holding more than one requires
 * a label on each so they can be told apart.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class NavigationAria<
  E extends BaseElement = HTMLElement,
  T extends NavigationProps = NavigationProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override readonly landmarkRole: LandmarkRole = 'navigation';
}

/**
 * Reactive input properties for ComplementaryAria.
 */
export interface ComplementaryProps extends LandmarkProps {}

/**
 * Behavioral configuration options for ComplementaryAria.
 */
export interface ComplementaryOptions extends LandmarkOptions {}

/**
 * Headless WAI-ARIA complementary landmark marking supporting content beside the main
 * content, bound to a native `<aside>` by default.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class ComplementaryAria<
  E extends BaseElement = HTMLElement,
  T extends ComplementaryProps = ComplementaryProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override readonly landmarkRole: LandmarkRole = 'complementary';
}

/**
 * Reactive input properties for ContentinfoAria.
 */
export interface ContentinfoProps extends LandmarkProps {}

/**
 * Behavioral configuration options for ContentinfoAria.
 */
export interface ContentinfoOptions extends LandmarkOptions {}

/**
 * Headless WAI-ARIA contentinfo landmark marking the prime footer area of a document,
 * bound to a native `<footer>` by default.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class ContentinfoAria<
  E extends BaseElement = HTMLElement,
  T extends ContentinfoProps = ContentinfoProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override readonly landmarkRole: LandmarkRole = 'contentinfo';
}

/**
 * Reactive input properties for SearchAria.
 */
export interface SearchLandmarkProps extends LandmarkProps {}

/**
 * Behavioral configuration options for SearchAria.
 */
export interface SearchLandmarkOptions extends LandmarkOptions {}

/**
 * Headless WAI-ARIA search landmark marking the site search facility, bound to a
 * native `<search>` element by default.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class SearchAria<
  E extends BaseElement = HTMLElement,
  T extends SearchLandmarkProps = SearchLandmarkProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override readonly landmarkRole: LandmarkRole = 'search';
}

/**
 * Reactive input properties for FormAria.
 */
export interface FormLandmarkProps extends LandmarkProps {}

/**
 * Behavioral configuration options for FormAria.
 */
export interface FormLandmarkOptions extends LandmarkOptions {}

/**
 * Headless WAI-ARIA form landmark marking a significant form area. A `<form>` is only
 * exposed as a landmark when it carries an accessible name, so the role is compiled
 * solely when `label` or `labelledby` is present; unnamed it stays a structural container.
 *
 * @template E - Target Element type (defaults to HTMLFormElement)
 */
export class FormAria<
  E extends BaseElement = HTMLFormElement,
  T extends FormLandmarkProps = FormLandmarkProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override readonly landmarkRole: LandmarkRole = 'form';
  protected override readonly requiresName = true;
}

/**
 * Reactive input properties for RegionAria.
 */
export interface RegionLandmarkProps extends LandmarkProps {}

/**
 * Behavioral configuration options for RegionAria.
 */
export interface RegionLandmarkOptions extends LandmarkOptions {}

/**
 * Headless WAI-ARIA region landmark marking a significant self-contained section. A
 * region is only computed as a landmark when named, so the role is compiled solely when
 * `label` or `labelledby` is present; unnamed it stays a generic container.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class RegionAria<
  E extends BaseElement = HTMLElement,
  T extends RegionLandmarkProps = RegionLandmarkProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override readonly landmarkRole: LandmarkRole = 'region';
  protected override readonly requiresName = true;
}
