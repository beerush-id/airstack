import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { roverCtx } from '../context.js';
import { Aria } from '../core.js';
import { selectionGroup } from '../selection.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaProps, BaseElement, DetachFn } from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';
import { handleRovingKey } from '../utils/navigation.js';

const ROLE_LISTBOX = 'listbox';
const OPTION_SELECTOR = ['[role="option"]'];
const ENABLED_OPTION_SELECTOR = OPTION_SELECTOR.map((s) => `${s}:not([aria-disabled="true"]):not(:disabled)`).join(',');
const ACTIVATION_KEYS = [' ', 'Enter'];
const TYPEAHEAD_WINDOW = 500;

export const listboxCtx = createContext<ListboxProps>();

interface ListboxBaseProps extends AriaProps {
  /**
   * Optional DOM element identifier and option namespace.
   */
  id?: string;

  /**
   * Accessible name announced for the container.
   */
  label?: string;

  /**
   * Whether user interaction is disabled across every option.
   */
  disabled?: boolean;

  /**
   * Whether a non-empty selection is required.
   */
  required?: boolean;

  /**
   * Whether the options wrap into visual rows, like a grid of tiles: the arrows then move by
   * reading order and by row instead of along one line.
   */
  flow?: boolean;
}

/**
 * Reactive input properties for single-select ListboxAria.
 */
export interface SingleListboxProps extends ListboxBaseProps {
  multiple?: false;

  /**
   * Selected option value; `null` is the unselected token.
   */
  value?: string;

  /**
   * Called with the option value as traversal moves the cursor onto it.
   */
  oninput?: AriaEventHandler<AriaEvent<string>>;

  /**
   * Called with the whole value after a member commit reaches the container.
   */
  onchange?: AriaEventHandler<AriaEvent<string>>;
}

/**
 * Reactive input properties for multi-select ListboxAria.
 */
export interface MultipleListboxProps extends ListboxBaseProps {
  multiple: true;

  /**
   * Selected option values.
   */
  value?: string[];

  /**
   * Called with the option value as traversal moves the cursor onto it.
   */
  oninput?: AriaEventHandler<AriaEvent<string>>;

  /**
   * Called with the whole value after a member commit reaches the container.
   */
  onchange?: AriaEventHandler<AriaEvent<string[]>>;
}

/**
 * Reactive input properties for ListboxAria (single or multiple selection).
 */
export type ListboxProps = SingleListboxProps | MultipleListboxProps;

/**
 * Compiled HTML and ARIA attributes for a listbox container.
 *
 * @template E - Target Element type
 */
export interface ListboxAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'listbox';
  tabindex?: number;
  'aria-label'?: string;
  'aria-multiselectable'?: 'true';
  'aria-required'?: 'true';
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless WAI-ARIA Listbox coordinator: a selection group whose members are options, with
 * roving focus traversal and typeahead over the option text.
 *
 * The selected option holds the single tab stop through the shared `SelectionAria` roving
 * rule, and the container takes that stop only while nothing is selected so an empty list
 * stays reachable. Traversal moves focus only; selection changes on click, `Space`, or `Enter`.
 * With `multiple`, Shift-click adds the range from the last option clicked.
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
  private queryTimer?: ReturnType<typeof setTimeout>;
  private parentRover = roverCtx.get();
  private searchQuery = '';
  /** The option last clicked without Shift: where the next Shift-click's range starts. */
  private anchor?: HTMLElement;
  /** Set while a range is being clicked in, so those clicks don't move the anchor. */
  private extending = false;

  protected selector = OPTION_SELECTOR.join(',');
  protected enabledSelector = ENABLED_OPTION_SELECTOR;

  public get id() {
    return this.properties.id;
  }

  public constructor(props: Partial<T> = {}, deferred = false) {
    const ambientProps = listboxCtx.get(props as ListboxProps);
    super(ambientProps as Partial<T>);

    $static(() => {
      this.properties.id = this.properties.id ?? `${ROLE_LISTBOX}-${uIndex($symbol(ROLE_LISTBOX), true)}`;

      if (this.properties.multiple && !this.properties.value) {
        this.properties.value = [];
      }
    });

    roverCtx.set(this as unknown as Aria<BaseElement>);
    selectionGroup.set(this.properties as Record<string, unknown>);

    this.omittedAttrs.push('id', 'label', 'value', 'multiple', 'disabled', 'required', 'flow', 'oninput', 'onchange');
    this.on('keydown', this.handleKeyDown);

    if (!deferred) {
      this.update();
    }
  }

  /**
   * Value currently held by the container: the selected token, or the array of tokens in
   * the multiple archetype. Writing it re-derives every option without announcing a commit.
   */
  public get value(): string | string[] | undefined {
    return this.properties.value;
  }

  public set value(val: string | string[] | undefined) {
    this.properties.value = val;
  }

  /**
   * Whether user interaction is disabled across every option.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Computes HTML and ARIA attributes for the listbox container.
   */
  protected override createAttributes(): A {
    const disabled = this.disabled;

    const attrs: Record<string, unknown> = {
      id: this.id,
      role: ROLE_LISTBOX,
      tabindex: disabled ? undefined : 0,
      'aria-disabled': ariaBoolean(disabled),
    };

    if (this.properties.required) {
      attrs['aria-required'] = 'true';
    }

    if (this.properties.label) {
      attrs['aria-label'] = this.properties.label;
    }

    if (this.properties.multiple) {
      attrs['aria-multiselectable'] = 'true';
    }

    return attrs as A;
  }

  /**
   * Forwards the announcements made inside the container: the option that took the cursor
   * carries its own value as `input`, and a member commit is announced as `change` with the
   * whole value. Also keeps a pending typeahead query from outliving the container, and reads
   * clicks before the options do, for Shift-click ranges.
   */
  protected override attach(): DetachFn {
    const host = this.element!;
    host.addEventListener('click', this.handleRangeClick, true);

    return () => {
      clearTimeout(this.queryTimer);
      host.removeEventListener('click', this.handleRangeClick, true);
    };
  }

  /**
   * In a multiple listbox, Shift-click selects every option from the anchor to the one clicked,
   * leaving the rest as they are; any other click makes its option the next anchor. The range is
   * selected through each option's own click, so every option announces its change as usual.
   */
  private readonly handleRangeClick = (event: MouseEvent): void => {
    if (this.extending || this.disabled) return;
    const option = (event.target as Element | null)?.closest<HTMLElement>(this.enabledSelector);
    if (!option || !this.element!.contains(option)) return;

    const options = this.enabledOptions();
    const from = this.anchor ? options.indexOf(this.anchor) : -1;
    if (!event.shiftKey || !this.properties.multiple || from < 0) {
      this.anchor = option;
      return;
    }

    event.preventDefault();
    const to = options.indexOf(option);
    const range = options.slice(Math.min(from, to), Math.max(from, to) + 1);
    this.extending = true;
    try {
      for (const each of range) {
        if (each.getAttribute('aria-selected') !== 'true') each.click();
      }
    } finally {
      this.extending = false;
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled || event.defaultPrevented || this.parentRover) return;

    const flow = !!this.properties.flow;
    if (handleRovingKey(this.element, event, { selector: this.enabledSelector, manual: true, flow })) return;

    if (ACTIVATION_KEYS.includes(event.key)) {
      const target = this.focusedOption() ?? this.enabledOptions()[0];
      if (!target) return;

      event.preventDefault();
      target.click();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;

    this.search(event.key);
  };

  private enabledOptions(): HTMLElement[] {
    return Array.from(this.element!.querySelectorAll<HTMLElement>(this.enabledSelector));
  }

  private focusedOption(): HTMLElement | undefined {
    const active = this.element!.ownerDocument.activeElement;
    return active instanceof HTMLElement && active.matches(this.selector) ? active : undefined;
  }

  private search(key: string): void {
    const options = this.enabledOptions();
    if (options.length === 0) return;

    clearTimeout(this.queryTimer);
    this.queryTimer = setTimeout(() => {
      this.searchQuery = '';
    }, TYPEAHEAD_WINDOW);

    const focused = this.focusedOption();
    const from = focused ? options.indexOf(focused) : -1;
    const seed = this.searchQuery as string;

    let query = seed + key.toLowerCase();
    let matched = this.match(options, from, query);

    if (!matched) {
      query = key.toLowerCase();
      matched = this.match(options, from, query);
    }

    if (!matched) {
      this.searchQuery = '';
      return;
    }

    this.searchQuery = query;
    matched.focus();
  }

  private match(options: HTMLElement[], from: number, query: string): HTMLElement | undefined {
    for (let step = 1; step <= options.length; step++) {
      const element = options[(from + step + options.length) % options.length];

      if (element.textContent.toLowerCase().startsWith(query)) {
        return element;
      }
    }

    return undefined;
  }
}
