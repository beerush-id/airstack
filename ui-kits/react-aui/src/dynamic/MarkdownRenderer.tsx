import { effect, For, mutable, setup, untrack } from '@airlib/react';
import type { Definition, Nodes, Root, RootContent, Table } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { auiComponents } from './components.js';
import { Formula } from './Formula.js';
import { type WidgetVocabulary, widgetVocabularyCtx } from './vocabulary.js';
import { type WidgetNode, WidgetRenderer } from './WidgetRenderer.js';

export type MarkdownRendererProps = {
  /** The markdown to draw. It may grow while drawn, as an answer streams in. */
  text: string;
};

/** One top-level block of the text: the source it came from, and what it draws. */
type Block = { id: number; source: string; nodes: WidgetNode[] };

const CLASS = { MARKDOWN: 'aui-markdown', TASK: 'aui-markdown-task' };

/** CommonMark with GitHub's tables, task lists, strikethrough, autolinks, and footnotes, plus `$…$` and `$$…$$` math. */
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

let blockCount = 0;

/**
 * Draws markdown with AUI's parts: prose as prose, task lists as checkboxes,
 * math as formulas, through the same renderer answers use. It holds no raw
 * HTML — markup in the text shows as text — and a link only goes to the web,
 * mail, or the page.
 *
 * It keeps up with text that is still arriving: each top-level block is drawn
 * once and kept while its source stays the same, so as words stream in only
 * the block they land in is drawn again. Text cut off mid-way still reads —
 * an unclosed `**` shows as itself until its pair arrives, and an unclosed
 * code fence shows as code in progress.
 */
export const MarkdownRenderer = setup<MarkdownRendererProps>((props) => {
  // Whatever vocabulary is in force around it, markdown adds its formulas.
  const outer = widgetVocabularyCtx.get() ?? (auiComponents as WidgetVocabulary);
  widgetVocabularyCtx.set(Object.assign({}, outer, { math: Formula }));

  const blocks = mutable<Block[]>([], { recursive: 'flat' });

  effect(() => {
    const text = props.text ?? '';
    untrack(() => sync(blocks, text));
  });

  return () => (
    <div className={CLASS.MARKDOWN}>
      <For each={() => blocks}>
        {(block) => (
          <For key={block.id} each={() => block.nodes}>
            {(node) => <WidgetRenderer node={node} />}
          </For>
        )}
      </For>
    </div>
  );
}, 'MarkdownRenderer');

/**
 * Brings the drawn blocks up to date with the text, replacing only the blocks
 * whose source changed.
 *
 * @param blocks - The blocks drawn so far.
 * @param text - The text as it stands now.
 */
function sync(blocks: Block[], text: string): void {
  const tree = parser.parse(text) as Root;
  const definitions = collectDefinitions(tree);

  tree.children.forEach((node, index) => {
    const source = text.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? text.length);
    if (blocks[index]?.source === source) return;
    blocks[index] = { id: ++blockCount, source, nodes: convert(node, definitions) };
  });

  if (blocks.length > tree.children.length) blocks.splice(tree.children.length);
}

/**
 * The link definitions a document declares, for the links that refer to them by label.
 *
 * @param tree - The parsed document.
 * @returns Each definition by its label.
 */
function collectDefinitions(tree: Root): Map<string, Definition> {
  const definitions = new Map<string, Definition>();
  for (const node of tree.children) {
    if (node.type === 'definition') definitions.set(node.identifier, node);
  }
  return definitions;
}

/**
 * Turns a markdown node into the UI it draws.
 *
 * @param node - The markdown node.
 * @param definitions - The document's link definitions.
 * @returns The nodes it draws; empty for what draws nothing, such as a definition.
 */
function convert(node: Nodes, definitions: Map<string, Definition>): WidgetNode[] {
  const children = () => ('children' in node ? node.children.flatMap((child) => convert(child, definitions)) : []);

  switch (node.type) {
    case 'text':
    case 'html':
      return [node.value];
    case 'paragraph':
      return [{ role: 'p', children: children() }];
    case 'heading':
      // Inside an answer or a note the page's own headings stay above, so levels start at h3.
      return [{ role: `h${Math.min(node.depth + 2, 6)}`, children: children() }];
    case 'thematicBreak':
      return [{ role: 'hr' }];
    case 'blockquote':
      return [{ role: 'blockquote', children: children() }];
    case 'list':
      return [
        {
          role: node.ordered ? 'ol' : 'ul',
          props: node.ordered && node.start && node.start !== 1 ? { start: node.start } : undefined,
          children: node.children.flatMap((item) => convert(item, definitions)),
        },
      ];
    case 'listItem': {
      // A tight item holds its text directly; a loose one keeps its paragraphs apart.
      const content = node.spread
        ? children()
        : node.children.flatMap((child) =>
            child.type === 'paragraph' ? child.children.flatMap((part) => convert(part, definitions)) : convert(child, definitions)
          );
      if (typeof node.checked !== 'boolean') return [{ role: 'li', children: content }];
      // A checkbox's children are its glyph, so the task's words sit beside it and name it.
      return [
        {
          role: 'li',
          props: { className: CLASS.TASK },
          children: [
            { role: 'checkbox', props: { checked: node.checked, disabled: true, 'aria-label': plainText(node) } },
            { role: 'span', children: content },
          ],
        },
      ];
    }
    case 'code':
      return [
        {
          role: 'pre',
          children: [{ role: 'code', props: node.lang ? { className: `language-${node.lang}` } : undefined, children: [node.value] }],
        },
      ];
    case 'inlineCode':
      return [{ role: 'code', children: [node.value] }];
    case 'emphasis':
      return [{ role: 'em', children: children() }];
    case 'strong':
      return [{ role: 'strong', children: children() }];
    case 'delete':
      return [{ role: 'del', children: children() }];
    case 'break':
      return [{ role: 'br' }];
    case 'link':
      return [{ role: 'a', props: link(node.url, node.title), children: children() }];
    case 'image':
      return [{ role: 'image', props: { src: node.url, alt: node.alt ?? '' } }];
    case 'linkReference': {
      const definition = definitions.get(node.identifier);
      return definition ? [{ role: 'a', props: link(definition.url, definition.title), children: children() }] : children();
    }
    case 'imageReference': {
      const definition = definitions.get(node.identifier);
      return definition ? [{ role: 'image', props: { src: definition.url, alt: node.alt ?? '' } }] : [node.alt ?? ''];
    }
    case 'table':
      return [table(node, definitions)];
    case 'math':
      return [{ role: 'math', props: { tex: node.value, display: true } }];
    case 'inlineMath':
      return [{ role: 'math', props: { tex: node.value } }];
    case 'footnoteReference':
      return [{ role: 'sup', children: [`[${node.label ?? node.identifier}]`] }];
    case 'footnoteDefinition':
      return [{ role: 'small', children: [`[${node.label ?? node.identifier}] `, ...children()] }];
    default:
      return children();
  }
}

/**
 * A table: its first row as the header, the rest as the body.
 *
 * @param node - The markdown table.
 * @param definitions - The document's link definitions.
 * @returns The table it draws.
 */
/**
 * A node's words without their formatting, for where only text fits: a control's name.
 *
 * @param node - The markdown node to read.
 * @returns Its text, with every mark and emphasis dropped.
 */
function plainText(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  return 'children' in node ? node.children.map((child) => plainText(child as Nodes)).join('') : '';
}

function table(node: Table, definitions: Map<string, Definition>): WidgetNode {
  // A cell converts to its contents, which go in the row's own header or data cell.
  const row = (cells: RootContent[], role: 'th' | 'td'): WidgetNode => ({
    role: 'tr',
    children: cells.map((cell) => ({ role, children: convert(cell, definitions) })),
  });
  const [head, ...body] = node.children;
  return {
    role: 'table',
    children: [
      { role: 'thead', children: head ? [row(head.children, 'th')] : [] },
      { role: 'tbody', children: body.map((tableRow) => row(tableRow.children, 'td')) },
    ],
  };
}

/**
 * A link's props: where it goes, and its title when it has one.
 *
 * @param url - Where it goes.
 * @param title - Its title, if any.
 * @returns The link's props.
 */
function link(url: string, title?: string | null): Record<string, string> {
  return title ? { href: url, title } : { href: url };
}
