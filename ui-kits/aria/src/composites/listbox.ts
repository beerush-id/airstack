import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { roverCtx } from '../context.js';
import { Aria } from '../core.js';
import { selectionGroup } from '../selection.js';
import type { AriaAttributes, AriaProps, BaseElement, Orientation, Primitive } from '../types.js';
import { handleRovingKey } from '../utils/navigation.js';
import { OptionAria, type OptionOptions, type OptionProps } from '../widgets/option.js';

/**
 * Visual and keyboard orientation of the listbox.
 */
export type ListboxOrientation = Orientation;

/**
 * Ambient instance context for the enclosing Listbox orchestrator.
 */
export const listboxCtx = createContext<ListboxAria>();

/**
 * Reactive input properties for single-select ListboxAria.
 *
 * @template T - Candidate option value type
 */
export interface SingleListboxProps<T extends Primitive = Primitive> extends AriaProps {
  multiple?: false;

  /**
   * Explicit DOM identifier and group namespace.
   */
  id?: string;

  /**
   * Active option value.
   */
  value?: T;

  /**
   * Focus movement axis and aria-orientation.
   * @default 'vertical'
   */
  orientation?: ListboxOrientation;

  /**
   * When true, arrows move focus without selecting until Enter/Space.
   * @default true
   */
  manual?: boolean;

  /**
   * Enforces a selection constraint requiring a non-empty value.
   */
  required?: boolean;

  /**
   * Whether user interaction is disabled across the entire listbox.
   */
  disabled?: boolean;
}

/**
 * Reactive input properties for multi-select ListboxAria.
 *
 * @template T - Candidate option value type
 */
export interface MultipleListboxProps<T extends Primitive = Primitive> extends AriaProps {
  multiple: true;

  /**
   * Explicit DOM identifier and group namespace.
   */
  id?: string;

  /**
   * Array of active option values.
   */
  value?: T[];

  /**
   * Focus movement axis and aria-orientation.
   * @default 'vertical'
   */
  orientation?: ListboxOrientation;

  /**
   * Enforces a selection constraint requiring a non-empty value.
   */
  required?: boolean;

  /**
   * Whether user interaction is disabled across the entire listbox.
   */
  disabled?: boolean;
}

/**
 * Reactive input properties for the Listbox container orchestrator.
 */
export type ListboxProps<T extends Primitive = Primitive> = SingleListboxProps<T> | MultipleListboxProps<T>;

/**
 * Compiled HTML and ARIA attributes for a listbox container element.
 *
 * @template E - Target Element type
 */
export interface ListboxAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'listbox';
  tabindex?: number;
  'aria-multiselectable'?: 'true' | 'false';
  'aria-orientation'?: ListboxOrientation;
  'aria-required'?: 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
}

const ROLE_LISTBOX = 'listbox';
const DEFAULT_ORIENTATION: ListboxOrientation = 'vertical';
const OPTION_SELECTORS = '[role="option"]:not([aria-disabled="true"]):not([disabled])';

/**
 * Headless WAI-ARIA Listbox coordinator managing option selection,
 * roving tabindex keyboard navigation, and ambient context.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class ListboxAria<
  E extends BaseElement = HTMLElement,
  T extends ListboxProps = ListboxProps,
  A extends ListboxAttributes<E> = ListboxAttributes<E>,
> extends Aria<E, T, A> {
  private parentRover = roverCtx.get();

  public constructor(props: Partial<T> = {}) {
    super(props);
    $static(() => {
      this.props.id = this.props.id ?? `${ROLE_LISTBOX}-${uIndex($symbol(ROLE_LISTBOX), true)}`;
    });
    listboxCtx.set(this as unknown as ListboxAria);
    roverCtx.set(this as unknown as Aria<BaseElement>);
    selectionGroup.set(this.props as Record<string, unknown>);

    this.omittedAttrs.push('role', 'aria-multiselectable', 'aria-orientation', 'aria-disabled');
    this.update();
  }

  /**
   * Whether user interaction is disabled across the entire listbox.
   */
  public get disabled(): boolean {
    return !!this.props.disabled;
  }

  /**
   * Visual and keyboard navigation orientation of the listbox.
   */
  public get orientation(): ListboxOrientation {
    return this.props.orientation ?? DEFAULT_ORIENTATION;
  }

  /**
   * Whether multiple options may be selected concurrently.
   */
  public get multiple(): boolean {
    return !!this.props.multiple;
  }

  /**
   * Spawns an OptionAria controller bound to this listbox.
   *
   * @param props - Reactive option properties
   * @param options - Controller configuration options
   * @returns Configured OptionAria instance
   */
  public option<TE extends BaseElement = HTMLElement>(
    props?: Partial<OptionProps>,
    options?: Partial<OptionOptions>
  ): OptionAria<TE> {
    return new OptionAria<TE>(props, options);
  }

  /**
   * Computes HTML and ARIA attributes for the listbox container.
   */
  protected override createAttributes(): A {
    const disabled = this.disabled;
    const orientation = this.orientation;
    const isMultiple = this.multiple;

    return Object.assign(super.createAttributes(), {
      id: this.props.id,
      role: ROLE_LISTBOX,
      tabindex: disabled ? -1 : 0,
      'aria-orientation': orientation,
      'aria-multiselectable': isMultiple ? 'true' : 'false',
      'aria-required': this.props.required ? 'true' : undefined,
      'aria-disabled': disabled ? 'true' : 'false',
      onkeydown: (e: KeyboardEvent) => {
        if (disabled || this.parentRover) return;

        handleRovingKey(this.element, e, {
          selector: OPTION_SELECTORS,
          orientation,
          manual: this.props.manual ?? true,
        });
      },
    }) as A;
  }
}
