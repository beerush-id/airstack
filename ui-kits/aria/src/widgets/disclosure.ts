import { $symbol, type AnyType, createContext, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import type {
  AriaAttributes,
  AriaEvent,
  AriaEventHandler,
  AriaOptions,
  AriaProps,
  BaseElement,
  DetachFn,
} from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';

/**
 * Ambient instance context for the enclosing Disclosure coordinator.
 */
export const disclosureCtx = createContext<DisclosureAria>();

/**
 * Controller-dispatched disclosure event carrying the committed expansion in `detail`.
 */
export type DisclosureEvent = AriaEvent<boolean>;

/**
 * Reactive input properties for DisclosureAria.
 */
export interface DisclosureProps extends AriaProps {
  /**
   * Called with the expanded state after the disclosure toggles.
   */
  ontoggle?: AriaEventHandler<DisclosureEvent>;
  /**
   * Deterministic identity and namespace for trigger/panel pair derivation.
   */
  id?: string;

  /**
   * Whether the panel is currently expanded.
   */
  expanded?: boolean;

  /**
   * Whether the disclosure is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Configuration options for DisclosureAria.
 */
export interface DisclosureOptions extends AriaOptions {
  /**
   * Whether bound to a native <details> host.
   * @default false
   */
  native?: boolean;
}

/**
 * Configuration options for DisclosureTriggerAria.
 */
export interface DisclosureTriggerOptions extends AriaOptions {
  /**
   * Whether bound to a native <button> or <summary> host.
   * @default true
   */
  native?: boolean;
  disabled?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for disclosure container hosts.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface DisclosureAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  open?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for disclosure trigger hosts.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface DisclosureTriggerAttributes<E extends BaseElement = HTMLButtonElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'button';
  disabled?: boolean;
  tabindex?: number;
  'aria-expanded'?: 'true' | 'false';
  'aria-controls'?: string;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Compiled HTML and ARIA attributes for disclosure panel hosts.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface DisclosurePanelAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'region';
  'aria-labelledby'?: string;
  hidden?: boolean;
}

/**
 * Headless disclosure container coordinator owning expansion state and
 * publishing the pair namespace for trigger/panel linkage.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class DisclosureAria<
  E extends BaseElement = HTMLElement,
  T extends DisclosureProps = DisclosureProps,
  A extends DisclosureAttributes<E> = DisclosureAttributes<E>,
  O extends DisclosureOptions = DisclosureOptions,
> extends Aria<E, T, A, O> {
  private readonly namespace = `disclosure-${uIndex($symbol('disclosure'), true)}`;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: false,
      ...options,
    });
    disclosureCtx.set(this as unknown as DisclosureAria);

    this.omittedAttrs.push('id', 'expanded', 'disabled', 'ontoggle');
    this.update();
  }

  /**
   * Deterministic identity and namespace for pair derivation.
   */
  public get id(): string {
    return this.properties.id ?? this.namespace;
  }

  /**
   * Whether the panel is currently expanded.
   */
  public get expanded(): boolean {
    return !!this.properties.expanded;
  }

  public set expanded(next: boolean) {
    if (this.disabled || next === this.expanded) return;
    this.properties.expanded = next;
    this.notifyToggle();
  }

  /**
   * Whether the disclosure is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Inverts the current expansion state.
   */
  public toggle(): void {
    this.expanded = !this.expanded;
  }

  /**
   * Computes the HTML and ARIA attributes for the disclosure container.
   */
  protected override createAttributes(): A {
    if (this.isNative) {
      return Object.assign(super.createAttributes(), {
        open: this.expanded,
      }) as A;
    }

    return super.createAttributes();
  }

  /**
   * Listens for browser-dispatched toggle on native hosts without re-dispatching.
   */
  protected override attach(): DetachFn | void {
    if (!this.isNative) return;
    const host = this.element as unknown as HTMLDetailsElement;
    const sync = () => {
      this.properties.expanded = host.open;
    };
    host.addEventListener('toggle', sync);
    return () => host.removeEventListener('toggle', sync);
  }

  private notifyToggle(): void {
    if (this.isNative) return;
    const host = this.element;
    if (host) {
      const event: DisclosureEvent = new CustomEvent('toggle', { bubbles: false, detail: this.expanded });
      host.dispatchEvent(event);
      this.properties.ontoggle?.(event);
    }
  }
}

/**
 * Headless disclosure trigger discovering its coordinator from ambient scope,
 * owning pointer and keyboard activation with disabled lockout.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template O - Options configuration type
 */
export class DisclosureTriggerAria<
  E extends BaseElement = HTMLButtonElement,
  P extends DisclosureTriggerOptions = DisclosureTriggerOptions,
  A extends DisclosureTriggerAttributes<E> = DisclosureTriggerAttributes<E>,
  O extends DisclosureOptions = DisclosureOptions,
> extends Aria<E, P, A, O> {
  /**
   * Unique controller instance identifier used as pair namespace without a coordinator.
   */
  public readonly id: string = `disclosure-trigger-${uIndex($symbol('disclosure-trigger'), true)}`;

  private readonly disclosure: DisclosureAria | null = disclosureCtx.get() ?? null;

  public spaceArmed = false;

  public constructor(props: DisclosureTriggerOptions = {}, options: O = {} as O) {
    super(props as AnyType, {
      native: true,
      ...options,
      clickable: true,
    });

    this.omittedAttrs.push('id', 'disabled', 'aria-expanded', 'aria-controls', 'aria-disabled');
    if (!this.isNative) {
      this.omittedAttrs.push('tabindex');
    }
    this.update();
  }

  /**
   * Expansion state read from the coordinator.
   */
  public get expanded(): boolean {
    return !!this.disclosure?.properties.expanded;
  }

  /**
   * Whether the trigger is disabled, factoring in coordinator disablement.
   */
  public get disabled(): boolean {
    return !!(this.properties.disabled ?? this.disclosure?.properties.disabled);
  }

  /**
   * Toggles the coordinator expansion unless disabled.
   */
  public toggle(): void {
    if (this.disabled) return;
    this.disclosure?.toggle();
  }

  private get parentId(): string {
    return this.disclosure?.id ?? this.id;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the trigger.
   */
  protected override createAttributes() {
    const isDisabled = this.disabled;
    const parentId = this.parentId;
    const attrs: Record<string, unknown> = {
      id: `${parentId}-trigger`,
      'aria-expanded': ariaBoolean(this.expanded),
      'aria-controls': `${parentId}-panel`,
      disabled: this.isNative ? isDisabled : undefined,
      'aria-disabled': ariaBoolean(isDisabled),
      onclick: this.handleClick,
      onkeydown: this.handleKeyDown,
      onkeyup: this.handleKeyUp,
    };

    if (!this.isNative) {
      attrs.role = 'button';
      attrs.tabindex = isDisabled ? -1 : 0;
    }

    return Object.assign(super.createAttributes(), attrs);
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (this.disabled || event.defaultPrevented) return;
    this.toggle();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled || event.defaultPrevented || !ALLOW_KEYS.includes(event.key)) return;

    if (event.key === ' ') {
      event.preventDefault();
      this.spaceArmed = true;
    } else {
      event.preventDefault();
      (event.currentTarget as HTMLElement)?.click?.();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const armed = this.spaceArmed;
    this.spaceArmed = false;
    if (this.disabled || event.defaultPrevented || !ALLOW_KEYS.includes(event.key)) return;

    if (event.key === ' ' && armed) {
      (event.currentTarget as HTMLElement)?.click?.();
    }
  };
}

const ALLOW_KEYS = [' ', 'Enter'];

/**
 * Headless disclosure panel discovering its coordinator from ambient scope,
 * projecting region semantics and collapsed hidden state.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class DisclosurePanelAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  AriaProps,
  DisclosurePanelAttributes<E>
> {
  /**
   * Unique controller instance identifier used as pair namespace without a coordinator.
   */
  public readonly id: string = `disclosure-panel-${uIndex($symbol('disclosure-panel'), true)}`;

  private readonly disclosure: DisclosureAria | null = disclosureCtx.get() ?? null;

  public constructor(props: AriaProps = {}) {
    super(props);

    this.omittedAttrs.push('id', 'role', 'aria-labelledby', 'hidden');
    this.update();
  }

  /**
   * Expansion state read from the coordinator.
   */
  public get expanded(): boolean {
    return !!this.disclosure?.properties.expanded;
  }

  private get parentId(): string {
    return this.disclosure?.id ?? this.id;
  }

  /**
   * Computes the HTML and ARIA attributes for the panel.
   */
  protected override createAttributes(): DisclosurePanelAttributes<E> {
    const parentId = this.parentId;
    return Object.assign(super.createAttributes(), {
      id: `${parentId}-panel`,
      role: 'region',
      'aria-labelledby': `${parentId}-trigger`,
      hidden: !this.expanded,
    }) as DisclosurePanelAttributes<E>;
  }
}
