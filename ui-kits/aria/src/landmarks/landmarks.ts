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
 * keyboard behavior, and hold no state beyond their name. A landmark defaults to a custom
 * host and so compiles its role; pass `native: true` when binding the matching HTML5 tag.
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
  protected get requiresName(): boolean {
    return false;
  }

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: false,
      ...options,
    });

    this.omittedAttrs.push('label', 'labelledby', 'aria-label', 'aria-labelledby');
    this.update();
  }

  /**
   * Accessible label compiled to aria-label.
   */
  public get label(): string | undefined {
    return this.properties.label;
  }

  /**
   * Element ID providing the accessible name.
   */
  public get labelledby(): string | undefined {
    return this.properties.labelledby;
  }

  /**
   * Whether the landmark carries an accessible name.
   */
  public get named(): boolean {
    return !!this.properties.label || !!this.properties.labelledby;
  }

  /**
   * Computes the HTML and ARIA attributes for the landmark.
   *
   * @returns Landmark attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      role: this.exposesRole ? this.landmarkRole : undefined,
      'aria-label': this.properties.label,
      'aria-labelledby': this.properties.labelledby,
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
 * Reactive input properties for HeaderAria.
 */
export interface HeaderProps extends LandmarkProps {}

/**
 * Behavioral configuration options for HeaderAria.
 */
export interface HeaderOptions extends LandmarkOptions {}

/**
 * Headless header landmark marking the prime header area of a document. Compiles the
 * banner role output.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class HeaderAria<
  E extends BaseElement = HTMLElement,
  T extends HeaderProps = HeaderProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override get landmarkRole(): LandmarkRole {
    return 'banner';
  }
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
 * Headless WAI-ARIA main landmark marking the primary unique content of a document.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class MainAria<
  E extends BaseElement = HTMLElement,
  T extends MainProps = MainProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override get landmarkRole(): LandmarkRole {
    return 'main';
  }
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
 * links. A page holding more than one requires a label on each so they can be told apart.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class NavigationAria<
  E extends BaseElement = HTMLElement,
  T extends NavigationProps = NavigationProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override get landmarkRole(): LandmarkRole {
    return 'navigation';
  }
}

/**
 * Reactive input properties for SidebarAria.
 */
export interface SidebarProps extends LandmarkProps {}

/**
 * Behavioral configuration options for SidebarAria.
 */
export interface SidebarOptions extends LandmarkOptions {}

/**
 * Headless sidebar landmark marking supporting content beside the main content.
 * Compiles the complementary role output.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class SidebarAria<
  E extends BaseElement = HTMLElement,
  T extends SidebarProps = SidebarProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override get landmarkRole(): LandmarkRole {
    return 'complementary';
  }
}

/**
 * Reactive input properties for FooterAria.
 */
export interface FooterProps extends LandmarkProps {}

/**
 * Behavioral configuration options for FooterAria.
 */
export interface FooterOptions extends LandmarkOptions {}

/**
 * Headless footer landmark marking the prime footer area of a document. Compiles the
 * contentinfo role output.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class FooterAria<
  E extends BaseElement = HTMLElement,
  T extends FooterProps = FooterProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override get landmarkRole(): LandmarkRole {
    return 'contentinfo';
  }
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
 * Headless WAI-ARIA search landmark marking the site search facility.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class SearchAria<
  E extends BaseElement = HTMLElement,
  T extends SearchLandmarkProps = SearchLandmarkProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override get landmarkRole(): LandmarkRole {
    return 'search';
  }
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
  protected override get landmarkRole(): LandmarkRole {
    return 'form';
  }

  protected override get requiresName(): boolean {
    return true;
  }
}

/**
 * Reactive input properties for SectionAria.
 */
export interface SectionProps extends LandmarkProps {}

/**
 * Behavioral configuration options for SectionAria.
 */
export interface SectionOptions extends LandmarkOptions {}

/**
 * Headless section landmark marking a significant self-contained section. A
 * section is only computed as a landmark when named, so the region role is compiled
 * solely when `label` or `labelledby` is present; unnamed it stays a generic container.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class SectionAria<
  E extends BaseElement = HTMLElement,
  T extends SectionProps = SectionProps,
  A extends LandmarkAttributes<E> = LandmarkAttributes<E>,
> extends LandmarkAria<E, T, A> {
  protected override get landmarkRole(): LandmarkRole {
    return 'region';
  }

  protected override get requiresName(): boolean {
    return true;
  }
}
