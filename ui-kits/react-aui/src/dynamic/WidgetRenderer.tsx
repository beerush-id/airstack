import { $bind, $static, $use, type AnyType, For, setup } from '@airlib/react';
import { createElement, type ComponentType } from 'react';
import { auiAppCtx } from './app.js';
import { type AuiComponentRole, auiComponents } from './components.js';
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
 * A prop kept live on the app's state: `state` is a dotted path into the app
 * (`settings.theme`). Read-only unless `writable`, which lets the component
 * write back — a control editing the setting it shows.
 */
export type WidgetBinding = {
  /** The prop it fills, e.g. `value`. */
  prop: string;
  /** Where in the app's state it reads from, e.g. `settings.theme`. */
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
 */
export const WidgetRenderer = setup<WidgetRendererProps>((props) => {
  const app = auiAppCtx.get();
  const vocabulary = widgetVocabularyCtx.get() ?? (auiComponents as WidgetVocabulary);
  // A node is complete once drawn and never changes, so what it draws is read once; its bindings stay live.
  const view = $static(() => {
    const node = props.node;
    if (typeof node === 'string') return { text: node };
    const target = resolve(node.role, vocabulary);
    const attributes = safeProps(node.props, typeof target === 'string');
    for (const binding of node.bindings ?? []) bind(attributes, binding, app);
    return { target, attributes, children: node.children };
  });
  if ('text' in view) return () => view.text;

  const { target, attributes, children } = view;

  return () => {
    if (!target) return null;
    // Drawing a component chosen at runtime means handing it its props as an object. Without
    // children of its own, a node keeps whatever `children` its props or bindings give it.
    if (!children?.length) return createElement(target as AnyType, attributes);
    return createElement(
      target as AnyType,
      attributes,
      <For each={() => children}>{(child) => <WidgetRenderer node={child} />}</For>
    );
  };
}, 'WidgetRenderer');

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
 * @param tag - Whether they go to a plain HTML tag, which takes links.
 * @returns The props to hand over.
 */
function safeProps(props: Record<string, JsonValue> | undefined, tag: boolean): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    if (!isSafeProp(key)) continue;
    if (tag && (key === 'href' || key === 'src') && !(typeof value === 'string' && SAFE_HREF.test(value))) continue;
    safe[key] = value;
  }
  return safe;
}

/**
 * Fills a prop from the app's state, kept live: two-way when the binding is
 * writable, read-only otherwise. A path that leaves the app's own state, or a
 * prop that could run code, binds nothing.
 *
 * @param attributes - The props being handed to the component.
 * @param binding - Which prop, from where in the app's state, and whether it may write back.
 * @param app - The app the desktop runs for.
 */
function bind(attributes: Record<string, unknown>, binding: WidgetBinding, app: AnyType): void {
  if (!app || !isSafeProp(binding.prop)) return;
  const path = binding.state.split('.');
  const key = path.pop();
  if (!key || [...path, key].some((step) => UNSAFE_STEPS.has(step))) return;

  let owner: AnyType = app;
  for (const step of path) {
    owner = owner?.[step];
    if (owner === null || typeof owner !== 'object') {
      console.warn(`[WidgetRenderer] No app state at "${binding.state}"; "${binding.prop}" was not bound.`);
      return;
    }
  }

  attributes[binding.prop] = binding.writable ? $bind(owner, key) : $use(owner, key);
}

/** Steps a state path may never take, so a binding can't reach past the app's own state. */
const UNSAFE_STEPS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Whether data may set a prop: never a handler, raw markup, or a ref.
 *
 * @param key - The prop's name.
 * @returns True when data may set it.
 */
function isSafeProp(key: string): boolean {
  return !/^on/i.test(key) && key !== 'dangerouslySetInnerHTML' && key !== 'ref';
}
