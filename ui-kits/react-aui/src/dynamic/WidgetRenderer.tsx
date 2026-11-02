import { $bind, $static, $use, type AnyType, For, Snippet, setup } from '@airlib/react';
import { createElement, type ComponentType } from 'react';
import { auiAppCtx } from './app.js';
import { type AuiComponentRole, auiComponents, WIDGET_CONTROLS } from './components.js';
import { type WidgetHost, widgetHostCtx } from './host.js';
import { type WidgetVocabulary, widgetVocabularyCtx } from './vocabulary.js';

/** The HTML an answer may use for prose and simple layout; nothing that runs code or loads a page. */
export type WidgetTag =
  | 'p'
  | 'span'
  | 'strong'
  | 'em'
  | 's'
  | 'del'
  | 'sup'
  | 'sub'
  | 'small'
  | 'code'
  | 'pre'
  | 'blockquote'
  | 'ul'
  | 'ol'
  | 'li'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'br'
  | 'hr'
  | 'a'
  | 'dl'
  | 'dt'
  | 'dd'
  | 'table'
  | 'thead'
  | 'tbody'
  | 'tr'
  | 'th'
  | 'td';

/** A value JSON can carry. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * A prop kept live on state: `state` is a dotted path into the app
 * (`settings.theme`), or into the widget's own state from `$this`
 * (`$this.form.title`). Read-only unless `writable`, which lets the component
 * write back — a control editing the setting it shows.
 */
export type WidgetBinding = {
  /** The prop it fills, e.g. `value`. */
  prop: string;
  /** Where it reads from, e.g. `settings.theme` or `$this.form.title`. */
  state: string;
  /** Whether the component may write the value back. Defaults to false. */
  writable?: boolean;
};

/**
 * One piece of UI described as data: text, or a component or tag by its role
 * with plain-data props, live bindings to the app's state, and children of
 * its own. It holds no code, so an answer can be stored, replayed, and drawn
 * on the server.
 */
export type WidgetNode =
  | string
  | {
      /** Which component draws it (`card`, `tab-button`), a prose tag (`p`, `ul`), or a role the vocabulary adds. */
      role: AuiComponentRole | WidgetTag | (string & {});
      props?: Record<string, JsonValue>;
      bindings?: WidgetBinding[];
      children?: WidgetNode[];
    };

export type WidgetRendererProps = {
  /** The piece of UI to draw. */
  node: WidgetNode;
};

const TAGS = new Set<string>([
  'p',
  'span',
  'strong',
  'em',
  's',
  'del',
  'sup',
  'sub',
  'small',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h3',
  'h4',
  'h5',
  'h6',
  'br',
  'hr',
  'a',
  'dl',
  'dt',
  'dd',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]);

/** Only web and mail links; a `javascript:` or data link never reaches the page. */
const SAFE_HREF = /^(https?:|mailto:|\/|#)/i;

/**
 * Draws one piece of UI described as data. It resolves the node's role to an
 * AUI component, or to a prose tag, hands it the node's props, and draws each
 * child with another renderer; text is drawn as text. A role it doesn't know
 * draws nothing and is reported, so a mistaken answer never breaks the page.
 * An `action` prop wires a press to the host, and `once` makes it one-time;
 * nothing here decides what either does. A control turns off while its widget
 * is busy or locked.
 */
export const WidgetRenderer = setup<WidgetRendererProps>((props) => {
  const app = auiAppCtx.get();
  const host = widgetHostCtx.get();
  const vocabulary = widgetVocabularyCtx.get() ?? (auiComponents as WidgetVocabulary);
  // A node is complete once drawn and never changes, so what it draws is read once; its bindings stay live.
  const view = $static(() => {
    const node = props.node;
    if (typeof node === 'string') return { text: node };
    const target = resolve(node.role, vocabulary);
    const tag = typeof target === 'string';
    const attributes = safeProps(node.props, tag, host);
    for (const binding of node.bindings ?? []) bind(attributes, binding, app, host, tag);
    if (WIDGET_CONTROLS.has(node.role)) followLock(attributes, host);
    wireAction(attributes, node.props?.once === true, host);
    return { target, attributes, children: node.children, liveTag: tag && !!node.bindings?.length };
  });
  if ('text' in view) return () => view.text;

  const { target, attributes, children, liveTag } = view;

  // Drawing a component chosen at runtime means handing it its props as an object. Without
  // children of its own, a node keeps whatever `children` its props or bindings give it.
  const draw = () => {
    if (!children?.length) return createElement(target as AnyType, attributes);
    return createElement(
      target as AnyType,
      attributes,
      <For each={() => children}>{(child) => <WidgetRenderer node={child} />}</For>
    );
  };

  return () => {
    if (!target) return null;
    return liveTag ? <Snippet>{draw}</Snippet> : draw();
  };
}, 'WidgetRenderer');

/**
 * Whether a role draws anything, so whoever writes nodes can be told before they're drawn.
 *
 * @param role - The role.
 * @returns True for a component's role or a prose tag.
 */
export function isWidgetRole(role: string): boolean {
  return Object.hasOwn(auiComponents, role) || TAGS.has(role);
}

/**
 * The component or tag a role draws.
 *
 * @param role - The node's role.
 * @param vocabulary - The components data may name.
 * @returns The component or tag, or undefined for a role nothing answers to.
 */
function resolve(role: string, vocabulary: WidgetVocabulary): ComponentType | string | undefined {
  if (Object.hasOwn(vocabulary, role)) return vocabulary[role];
  if (TAGS.has(role)) return role;
  console.warn(`[WidgetRenderer] No component or tag for role "${role}"; it was not drawn.`);
  return undefined;
}

/**
 * A node's props without anything that could run code or inject markup.
 *
 * @param props - The props the node carries.
 * @param tag - Whether they go to a plain HTML tag, whose `src` is a link too.
 * @param host - The widget's host, which may allow links of its own.
 * @returns The props to hand over.
 */
function safeProps(props: Record<string, JsonValue> | undefined, tag: boolean, host?: WidgetHost): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    if (!isSafeProp(key)) continue;
    if ((key === 'href' || (tag && key === 'src')) && !isSafeLink(value, host)) continue;
    safe[key] = key === 'items' && Array.isArray(value) ? value.map((item) => safeItem(item, host)) : value;
  }
  return safe;
}

/**
 * One item of a list a component draws from its props, like a gallery's tiles: it's data too, so a
 * link in it answers to the same rule as a link on a node.
 *
 * @param item - The item.
 * @param host - The widget's host, which may allow links of its own.
 * @returns The item, without a link that may not reach the page.
 */
function safeItem(item: JsonValue, host?: WidgetHost): JsonValue {
  if (typeof item !== 'object' || item === null || Array.isArray(item) || !('href' in item)) return item;
  const { href, ...rest } = item;
  return isSafeLink(href, host) ? item : rest;
}

/**
 * Whether a link may reach the page.
 *
 * @param value - The link.
 * @param host - The widget's host, which may allow links of its own.
 * @returns True for a web or mail link, or one the host allows.
 */
function isSafeLink(value: JsonValue, host?: WidgetHost): boolean {
  return typeof value === 'string' && (SAFE_HREF.test(value) || !!host?.allowsLink(value));
}

/**
 * Fills a prop from state, kept live: two-way when the binding is writable,
 * read-only otherwise. A path from `$this` reads the widget's own state, any
 * other the app's. A path that leaves that state, or a prop that could run
 * code, binds nothing.
 *
 * @param attributes - The props being handed to the component.
 * @param binding - Which prop, from where, and whether it may write back.
 * @param app - The app the desktop runs for.
 * @param host - The widget's host, whose state `$this` reads.
 * @param tag - Whether they go to a plain HTML tag, which reads the state where it's drawn and can't
 *   write back: only components take a live prop.
 */
function bind(
  attributes: Record<string, unknown>,
  binding: WidgetBinding,
  app: AnyType,
  host: WidgetHost | undefined,
  tag: boolean
): void {
  const path = binding.state.split('.');
  const own = path[0] === OWN_STATE;
  if (own) path.shift();
  const root: AnyType = own ? host?.state : app;
  if (!root || !isSafeProp(binding.prop)) return;
  const key = path.pop();
  if (!key || [...path, key].some((step) => UNSAFE_STEPS.has(step))) return;

  let owner: AnyType = root;
  for (const step of path) {
    owner = owner?.[step];
    if (owner === null || typeof owner !== 'object') {
      console.warn(`[WidgetRenderer] No state at "${binding.state}"; "${binding.prop}" was not bound.`);
      return;
    }
  }

  if (tag) {
    Object.defineProperty(attributes, binding.prop, {
      configurable: true,
      enumerable: true,
      get() {
        const value = owner[key];
        // An object brings the whole tree down as a tag's child.
        return typeof value === 'object' ? undefined : value;
      },
    });
    return;
  }
  attributes[binding.prop] = binding.writable ? $bind(owner, key) : $use(owner, key);
}

/**
 * Turns a control off while its widget is busy or locked. A control its data already disabled stays
 * that way.
 *
 * @param attributes - The props being handed to the component.
 * @param host - The widget's host; outside a widget, nothing changes.
 */
function followLock(attributes: Record<string, unknown>, host?: WidgetHost): void {
  if (!host || attributes.disabled === true) return;
  const { ctx } = host.state;
  attributes.disabled = $use(() => ctx.busy || ctx.disabled);
}

/**
 * Wires a node's `action` to its host: pressing it hands the action over, and it stays disabled
 * while the widget is busy or locked, or once a `once` action is used up. `action` is the
 * renderer's, so it never reaches the component. `once` doesn't get that far: it reads as a handler
 * to `isSafeProp`, so it comes from the node.
 *
 * @param attributes - The props being handed to the component.
 * @param once - Whether the action can only succeed once.
 * @param host - The widget's host.
 */
function wireAction(attributes: Record<string, unknown>, once: boolean, host?: WidgetHost): void {
  const { action } = attributes;
  delete attributes.action;
  if (typeof action !== 'string' || !host) return;

  const { ctx } = host.state;
  attributes.onClick = (event: Event) => {
    const done = once ? () => void (ctx.spent[action] = true) : undefined;
    host.dispatch(action, event, done);
  };
  attributes.disabled = $use(() => ctx.busy || ctx.disabled || !!ctx.spent[action]);
}

/** The first step of a path into the widget's own state. */
const OWN_STATE = '$this';

/** Steps a state path may never take, so a binding can't reach past the app's own state. */
const UNSAFE_STEPS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Whether data may set a prop: never a handler, raw markup, a ref, or a style, whose look belongs to
 * the components and which brings the whole tree down when it's a string.
 *
 * @param key - The prop's name.
 * @returns True when data may set it.
 */
function isSafeProp(key: string): boolean {
  return !/^on/i.test(key) && key !== 'dangerouslySetInnerHTML' && key !== 'ref' && key !== 'style';
}
