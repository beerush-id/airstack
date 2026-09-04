import { $static, $symbol, type AnyType, createContext, uIndex } from '@airlib/core';
import { roverCtx } from '../context.js';
import { Aria } from '../core.js';
import { selectionGroup } from '../selection.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../types.js';
import { handleRovingKey } from '../utils/navigation.js';
import { OptionAria, type OptionOptions, type OptionProps } from '../widgets/option.js';

/**
 * Visual and keyboard orientation of the listbox.
 */
export type ListboxOrientation = 'vertical' | 'horizontal';

/**
 * Ambient instance context for the enclosing Listbox orchestrator.
 */
export const listboxCtx = createContext<ListboxAria>();

/**
 * Reactive input properties for the Listbox container orchestrator.
 */
export interface ListboxProps extends AriaProps {
  /**
   * Explicit DOM identifier and group namespace.
   */
  id?: string;

  /**
   * Currently selected option value, array of values (multi-select), or dictionary of boolean flags.
   */
  value?: AnyType;

  /**
   * Whether multiple options can be selected simultaneously.
   * Automatically inferred if `value` is initialized as an array.
   */
  multiple?: boolean;

  /**
   * Whether user interaction is disabled across the entire listbox.
   */
  disabled?: boolean;

  /**
   * Visual and keyboard navigation orientation of the options.
   * @default 'vertical'
   */
  orientation?: ListboxOrientation;
}

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
      this.props.id = this.props.id ?? `listbox-${uIndex($symbol(ROLE_LISTBOX), true)}`;
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
    return !!this.props.multiple || Array.isArray(this.props.value);
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

    return Object.assign(super.createAttributes(), {
      id: this.props.id,
      role: ROLE_LISTBOX,
      'aria-orientation': orientation,
      'aria-multiselectable': this.multiple ? 'true' : undefined,
      'aria-disabled': disabled ? 'true' : undefined,
      onkeydown: (e: KeyboardEvent) => {
        if (disabled || this.parentRover) return;

        handleRovingKey(this.element, e, {
          selector: OPTION_SELECTORS,
          orientation,
        });
      },
    }) as A;
  }
}
