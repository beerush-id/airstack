import type { NavItem } from '@airlib/react/mdx';
import widgetsMeta from '@airlib-cache/metadata/docs/widgets/index.js';
import { OverviewIcon, StyleIcon, WidgetsIcon } from '../../components/index.js';
import { docsIndexRoute, docsThemingRoute } from './route.js';

interface MetaEntry {
  path: string;
  meta: {
    nav?: string;
    title?: string;
    'nav-icon'?: string;
    'nav-priority'?: number;
    [key: string]: unknown;
  };
}

function toNavItems(entries: MetaEntry[]): NavItem[] {
  return entries
    .map(({ path, meta }) => {
      const text = meta.nav || meta.title || path;
      const priority = meta['nav-priority'] ?? 999;

      return {
        text,
        priority,
        href: path,
        title: meta.title,
      };
    })
    .sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toUpperCase()))
    .map(({ text, href, title }) => ({ text, href, title }));
}

export const navs: NavItem[] = [
  { icon: OverviewIcon, text: 'Overview', route: docsIndexRoute },
  { icon: StyleIcon, text: 'Theming', route: docsThemingRoute },
  { separator: true },
  {
    icon: WidgetsIcon,
    text: 'Widgets',
    items: toNavItems(widgetsMeta),
  },
];
