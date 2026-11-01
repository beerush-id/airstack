import { aria } from '@airlib/aria';
import { AUI_CLASS, register, VARIANTS } from '@airlib/aui/utils';
import {
  $static,
  $use,
  type AnyType,
  type Bindable,
  classx,
  createContext,
  effect,
  For,
  mutable,
  onCleanup,
  onMount,
  Show,
  Snippet,
  setup,
  subscribe,
} from '@airlib/react';
import type { FormEvent, MouseEvent, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { Toast, ToastClose } from '../composites/Toast.js';
import { newWidgetState, type WidgetContext, type WidgetHost, type WidgetState, widgetHostCtx } from '../dynamic/host.js';
import { MarkdownRenderer } from '../dynamic/MarkdownRenderer.js';
import { WidgetRenderer } from '../dynamic/WidgetRenderer.js';
import { Form } from '../landmarks/index.js';
import { Card, type CardProps } from '../widgets/Card.js';
import type { DockWidgetEntry, DockWidgetPart } from './dock/registry.js';

/** Something pressed in a widget, for whoever owns the list to act on. */
export type DockWidgetAction = {
  /** What the widget asked for: a button's `action`, or a form's `formAction`. */
  action: string;
  /** What triggered it. */
  event: Event;
  /** The widget's live values. */
  form: WidgetState['form'];
  /** The widget's live state: set `disabled` to lock it. */
  ctx: WidgetContext;
  /** The entry it was pressed in. */
  widget: DockWidgetEntry;
  /** The owner's id of the part it was pressed in, when it has one. */
  widgetId?: string;
};

export type DockWidgetsProps = ComponentStyles & {
  /** Names the stack for screen readers, e.g. "Assistant"; with it the stack is a landmark. */
  label?: string;
  /** What to show, oldest first: a reactive array, set or map of entries. The stack only draws it. */
  widgets?: Iterable<DockWidgetEntry> | Map<string, DockWidgetEntry>;
  /**
   * Called with what was pressed in a widget. While it runs the widget is busy; what it returns is
   * drawn under the widget, and what it throws says so there. An `AbortError` draws nothing.
   */
  onaction?: (action: DockWidgetAction) => ReactNode | Promise<ReactNode>;
  /** Called with any link pressed in an answer; call `preventDefault` on the event to take it from the browser. */
  onlink?: (href: string, event: MouseEvent<HTMLElement>) => void;
  /** Whether data may link somewhere beyond the web and mail links every page may have. */
  allowsLink?: (href: string) => boolean;
  /** Called when a widget's close button is pressed, or its time is up; taking it off the list is yours. */
  ondismiss?: (widget: DockWidgetEntry) => void;
  /** Names each widget's close button; without it, widgets have none. */
  closeLabel?: string;
  /** Milliseconds before a widget asks to leave on its own, the user's choice; off (`false`) by default, so nothing goes before it is read. */
  autoDismiss?: number | false;
  /** Caps how many widgets an open stack shows; older ones move out of view until newer ones are dismissed. Without it, an open stack shows every widget, scrolling once they outgrow the screen. */
  visible?: number;
  /** Over the windows, like the dock (default), or on the desktop beneath them. */
  layer?: 'above' | 'below';
  /** Whether an answer is on its way: the stack stays showing, and its quiet spell starts when this ends. */
  waiting?: boolean;
  /**
   * Whether the stack is out, in place of the pointer: `true` holds it open as pointing at it does,
   * until a press outside it and the dock shuts it, and `false` shuts it, showing only an answer
   * while `waiting` and for its quiet spell after, and what waits on the user. Left out, it fades
   * after a quiet spell, and pointing at its area opens it.
   */
  open?: Bindable<boolean>;
};

export type DockWidgetsSlots = {
  /** What sits under an entry, e.g. what can be done with it. Called for every entry; nothing draws nothing. */
  footer: (widget: DockWidgetEntry) => ReactNode;
  /** What sits outside an entry, right below it, on the open stack's frame: it shows and leaves with the frame. Called for every entry; nothing draws nothing. */
  after: (widget: DockWidgetEntry) => ReactNode;
};

export type DockWidgetProps = ComponentStyles & {
  /** The widget to draw. */
  widget: DockWidgetEntry;
};

const CLASS = {
  WIDGETS: 'aui-dock-widgets',
  LIST: 'aui-dock-widgets-list',
  WIDGET: 'aui-dock-widget',
  IMPORTANT: 'aui-dock-widget-important',
  USER: 'aui-dock-widget-user',
  AFTER: 'aui-dock-widget-after',
  FORM: 'aui-dock-widget-form',
  /** The prompt, which focus returns to once a press inside the stack is done. */
  PROMPT: 'aui-dock-input',
  /** The dock, whose presses are for the stack rather than away from it. */
  DOCK: 'aui-dock',
};

const WIDGETS_OMIT = [
  ...OMIT_KEYS,
  'widgets',
  'onaction',
  'onlink',
  'allowsLink',
  'ondismiss',
  'closeLabel',
  'autoDismiss',
  'visible',
  'layer',
  'waiting',
  'open',
];

/** What marks a stack gone quiet, for its look to follow. */
const ASLEEP = 'data-asleep';
/** What marks a shut stack showing an answer that came. */
const TELLING = 'data-telling';
/** How long a stack stays with nothing happening, where the theme doesn't say. */
const QUIET_SPELL = 6000;

/** The card a widget is drawn in: raised, so it stands off the words around it. */
const CARD_SIZE = 'sm';
const CARD_VARIANT = VARIANTS.ELEVATED;

register('dockWidgets', {});

/** The stack, for each widget it draws: its settings, and how a widget says it changed. */
const dockWidgetsCtx = createContext<{ props: DockWidgetsProps; slots: Partial<DockWidgetsSlots>; touch: () => void }>();

/**
 * The stack above the dock, newest nearest the prompt, over the windows. It
 * only draws what it's given: the list is the owner's, and the stack reports
 * what happens to it. Place it in the `Desktop` right after the `Dock`: it
 * shares the dock's `Tab` loop, so people move between the prompt and an
 * answer's buttons without leaving. After a quiet spell it fades away; a new
 * or changing entry, pointing at its area, or focus inside brings it back. An
 * entry waiting on the user is marked, and tints the pill a sleeping stack
 * leaves. While a window has focus the stack sits beneath the windows, until
 * the user reaches for it. Only the answers' area takes the pointer; the
 * space around it belongs to the windows behind.
 */
export const DockWidgets = setup<DockWidgetsProps, DockWidgetsSlots>((props, slots) => {
  const region = aria('dock-region', props as AnyType);
  let quiet: ReturnType<typeof setTimeout> | undefined;

  // Whether a shut stack is showing an answer that came, until its quiet spell is over.
  let telling = false;

  // Only what's new wakes the stack and starts its quiet spell: pointing at it just shows it. None starts while an answer is on its way.
  const touch = () => {
    const stack = region.current as HTMLElement | null;
    clearTimeout(quiet);
    if (!stack) return;
    const { open, waiting } = $static(() => ({ open: props.open, waiting: props.waiting }));
    telling = !open && (!!waiting || telling);
    stack.toggleAttribute(TELLING, telling);
    stack.removeAttribute(ASLEEP);
    if (waiting || open || (open === false && !telling)) return;
    quiet = setTimeout(() => {
      telling = false;
      stack.removeAttribute(TELLING);
      stack.setAttribute(ASLEEP, '');
    }, quietSpell(stack));
  };

  // Pointing at an answer a shut stack is showing holds it; leaving starts its quiet spell over.
  const hold = () => {
    if (telling) clearTimeout(quiet);
  };
  const release = () => {
    if (telling) touch();
  };
  // A press anywhere else is the user moving on. A popup open from the stack keeps it: its press is the stack's.
  const shut = (event: PointerEvent) => {
    const stack = region.current as HTMLElement | null;
    const target = event.target as Element;
    if (!props.open || !stack || stack.contains(target) || target.closest(`.${CLASS.DOCK}`)) return;
    if (!stack.querySelector('[aria-expanded="true"]')) props.open = false;
  };

  onMount(() => {
    touch();
    // Captured, so nothing a window does with the press keeps it from here.
    document.addEventListener('pointerdown', shut, true);
    return () => document.removeEventListener('pointerdown', shut, true);
  });
  onCleanup(() => clearTimeout(quiet));
  dockWidgetsCtx.set({ props, slots, touch });

  const entries = (): DockWidgetEntry[] => {
    const { widgets } = props;
    if (!widgets) return [];
    return [...(widgets instanceof Map ? widgets.values() : widgets)];
  };

  effect(() => {
    void entries().length;
    void props.waiting;
    void props.open;
    touch();
  });

  // One listener for every link in the answers, in their widgets and their words alike.
  const followLink = (event: MouseEvent<HTMLElement>) => {
    const href = (event.target as Element).closest('a[href]')?.getAttribute('href');
    if (href) props.onlink?.(href, event);
  };

  return () => (
    <div
      ref={region.ref}
      {...region.restProps(WIDGETS_OMIT as never)}
      data-layer={props.layer ?? 'above'}
      data-visible={props.visible}
      data-open={props.open ? '' : undefined}
      data-shut={props.open === false ? '' : undefined}
      onPointerEnter={hold}
      onPointerLeave={release}
      className={$families(CLASS.WIDGETS, props, auiConfig.dockWidgets)}
    >
      <div className={CLASS.LIST} onClick={followLink}>
        <For each={entries}>{(widget) => <DockWidget key={widget.id} widget={widget} />}</For>
      </div>
    </div>
  );
}, 'DockWidgets');

/**
 * One entry on the dock's glass. It announces itself when it appears, and asks
 * to leave by its close button or, when the user turned auto-dismiss on, after
 * a while, pausing while it is pointed at or focused. It holds what's its own:
 * the state its widgets edit, and what a press in them drew, which is shown
 * under them. The entry itself stays what its owner wrote.
 */
export const DockWidget = setup<DockWidgetProps>((props) => {
  const stack = dockWidgetsCtx.get();
  // The widget drawn is fixed for this component's life; so is its timer, set once when it appears.
  const { widget, view, critical, from, duration } = $static(() => {
    const { widget } = props;
    const { view, critical, from, important } = widget;
    return { widget, view, critical, from, duration: important ? undefined : stack?.props.autoDismiss || undefined };
  });
  const className = () =>
    classx(CLASS.WIDGET, AUI_CLASS.TOAST_FLOATING, widget.important && CLASS.IMPORTANT, from === 'user' && CLASS.USER);

  // A result is the host's: the widget stays what its owner wrote. Shallow, so what it holds stays as drawn.
  const result = mutable({ view: undefined as ReactNode }, { recursive: false });
  const state = mutable(newWidgetState());

  // An entry's parts are reactive, and writing to them counts as activity.
  const parts = $static(() => widget.children);
  if (parts && stack) onCleanup(subscribe(parts, stack.touch));

  // The widget is the scope of everything drawn in it: its state, and where its presses go.
  widgetHostCtx.set({
    state,
    allowsLink: (href) => !!stack?.props.allowsLink?.(href),
    dispatch(action, event, done, widgetId) {
      const { form, ctx } = state;
      ctx.busy = true;
      Promise.resolve()
        .then(() => stack?.props.onaction?.({ action, event, form, ctx, widget, widgetId }))
        .then((drawn) => {
          result.view = drawn;
          done?.();
        })
        .catch((error) => {
          if (error?.name !== 'AbortError') result.view = error instanceof Error ? error.message : String(error);
        })
        .finally(() => {
          ctx.busy = false;
          returnFocus();
        });
    },
  });

  return () => (
    <>
      <Toast
        critical={critical}
        duration={duration}
        size={props.size}
        className={className()}
        ondismiss={() => stack?.props.ondismiss?.(widget)}
      >
        <div className={`${CLASS.WIDGET}-content`}>
          {view ?? <For each={() => widget.children ?? []}>{(part) => <DockWidgetPartView part={part} />}</For>}
          <Snippet>{() => result.view}</Snippet>
          <Snippet>{() => stack?.slots.footer?.(widget)}</Snippet>
        </div>
        <Show when={() => stack?.props.closeLabel}>{(label) => <ToastClose aria-label={label} />}</Show>
      </Toast>
      <div className={CLASS.AFTER}>
        <Snippet>{() => stack?.slots.after?.(widget)}</Snippet>
      </div>
    </>
  );
}, 'DockWidget');

/**
 * One part of an answer: markdown text redrawn as its words arrive, or a
 * widget drawn once from its data, in a card that takes its look from `props`.
 * A widget's `form` is the widget's own state, so writing to it there shows at
 * once, and with a `formAction` a form sits in the card: submitting runs that
 * action. Its controls turn themselves off while it's busy or locked.
 */
const DockWidgetPartView = setup<{ part: DockWidgetPart }>((props) => {
  const part = $static(() => props.part);
  const kind = $static(() => props.part.type);
  // Text is markdown, redrawn block by block as its words arrive.
  if (kind === 'text') return () => <MarkdownRenderer text={$use(part as { text: string }, 'text')} />;

  const widgetHost = widgetHostCtx.get();
  // A part is complete once drawn, so what it declares is read once, and seeds the state once.
  const { nodes, size, variant, color, id, formAction, once, ctx } = $static(() => {
    const widget = part as Exclude<DockWidgetPart, { type: 'text' }>;
    const { id, status, form, formAction, once } = widget;
    if (widgetHost) {
      // The first form is the state; a second in the same answer joins it.
      if (form && Object.keys(widgetHost.state.form).length) Object.assign(widgetHost.state.form, form);
      else if (form) widgetHost.state.form = form;
      // A settled widget is over: it comes back filled in, and locked.
      if (status === 'settled') widgetHost.state.ctx.disabled = true;
    }
    // How the card looks is the data's to say; nothing else about it is.
    const { size = CARD_SIZE, variant = CARD_VARIANT, color } = (widget.props ?? {}) as Pick<CardProps, 'size' | 'variant' | 'color'>;
    return { nodes: widget.children ?? [], size, variant, color, id, formAction, once, ctx: widgetHost?.state.ctx };
  });
  // Whatever's pressed inside goes out as this part, so its owner knows which widget it was.
  const dispatch: WidgetHost['dispatch'] = (action, event, done) => widgetHost?.dispatch(action, event, done, id);
  if (widgetHost) widgetHostCtx.set({ ...widgetHost, dispatch });

  const content = () => <For each={() => nodes}>{(node) => <WidgetRenderer node={node} />}</For>;
  if (!formAction || !widgetHost || !ctx) {
    return () => (
      <Card size={size} variant={variant} color={color}>
        {content()}
      </Card>
    );
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch(formAction, event.nativeEvent, once ? () => void (ctx.disabled = true) : undefined);
  };

  return () => (
    <Card size={size} variant={variant} color={color}>
      <Form className={CLASS.FORM} aria-busy={ctx.busy} onSubmit={submit}>
        {content()}
      </Form>
    </Card>
  );
}, 'DockWidgetPart');

/**
 * How long a stack stays with nothing happening: the theme's `--aui-dock-widgets-idle`.
 *
 * @param stack - The stack.
 * @returns The time, in milliseconds.
 */
function quietSpell(stack: HTMLElement): number {
  const idle = getComputedStyle(stack).getPropertyValue('--aui-dock-widgets-idle').trim();
  const time = Number.parseFloat(idle) * (idle.endsWith('ms') ? 1 : 1000);
  return Number.isNaN(time) ? QUIET_SPELL : time;
}

/**
 * Hands focus back to the prompt after a press inside the stack, unless the press sent it somewhere
 * else, e.g. a window it opened. Focus left in the stack would hold it awake.
 */
function returnFocus(): void {
  const focused = document.activeElement;
  if (focused && focused !== document.body && !focused.closest(`.${CLASS.WIDGETS}`)) return;
  document.querySelector<HTMLElement>(`.${CLASS.PROMPT}`)?.focus({ preventScroll: true });
}
