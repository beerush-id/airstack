import { type AnyType, createContext } from '@airlib/react';

/** Where a widget stands while it's used: whether a command is running for it, and whether it's locked. */
export type WidgetContext = {
  /** A command is running for this widget right now. Set by whatever runs it. */
  busy: boolean;
  /** This widget stays locked. Set by a command's handler, or by `once` on success. */
  disabled: boolean;
  /** The actions used up by a button's own `once`, by name. */
  spent: Record<string, boolean>;
};

/** A widget's own state: pure data, kept as long as the widget and reachable from its data as `$this`. */
export type WidgetState = {
  ctx: WidgetContext;
  /** What its inputs edit, seeded by the answer. */
  form: Record<string, AnyType>;
};

/**
 * What hosts a widget's renderers: its own state, and how a press leaves the widget. The renderers
 * only wire; what an action does is decided by whatever the host hands it to.
 */
export type WidgetHost = {
  state: WidgetState;
  /**
   * Hands an action to whatever runs it.
   *
   * @param action - The action's name.
   * @param event - What triggered it.
   * @param done - What to do once it succeeds, e.g. using up a one-time button.
   * @param widgetId - The server's id of the widget it came from, when it has one.
   */
  dispatch(action: string, event: Event, done?: () => void, widgetId?: string): void;
  /**
   * Whether a link goes somewhere the host can open, beyond the links every page may have.
   *
   * @param href - The link.
   * @returns True when it's allowed.
   */
  allowsLink(href: string): boolean;
};

/** The host of the renderers inside. Set it in the setup of a component around them. */
export const widgetHostCtx = createContext<WidgetHost>();

/**
 * A widget's state as it starts.
 *
 * @returns Its plain, unlocked state, with nothing in its form yet.
 */
export function newWidgetState(): WidgetState {
  return { ctx: { busy: false, disabled: false, spent: {} }, form: {} };
}
