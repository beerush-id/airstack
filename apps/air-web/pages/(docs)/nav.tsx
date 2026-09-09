import type { NavItem } from '@airlib/react/mdx';
import ariaCompositesMeta from '@airlib-cache/metadata/(docs)/aria/composites/index.js';
import ariaMeta from '@airlib-cache/metadata/(docs)/aria/index.js';
import formMeta from '@airlib-cache/metadata/(docs)/form/index.js';
import docsMeta from '@airlib-cache/metadata/(docs)/index.js';
// import componentsMeta from '@airlib-cache/metadata/(docs)/material-css/components/index.js';
// import extensionsMeta from '@airlib-cache/metadata/(docs)/material-css/extensions/index.js';
// import materialMeta from '@airlib-cache/metadata/(docs)/material-css/index.js';
// import layoutMeta from '@airlib-cache/metadata/(docs)/material-css/layout/index.js';
// import materialUtilitiesMeta from '@airlib-cache/metadata/(docs)/material-css/utilities/index.js';
import remoteFunctionMeta from '@airlib-cache/metadata/(docs)/remote-function/index.js';
import routingMeta from '@airlib-cache/metadata/(docs)/routing/index.js';
import stateMeta from '@airlib-cache/metadata/(docs)/state-management/index.js';
import storageMeta from '@airlib-cache/metadata/(docs)/storage/index.js';
import uiMeta from '@airlib-cache/metadata/(docs)/user-interface/index.js';
import workflowMeta from '@airlib-cache/metadata/(docs)/workflow/index.js';
import type { ComponentType } from 'react';
import {
  ArticleIcon,
  BuildIcon,
  ChecklistIcon,
  ExtensionIcon,
  GettingStartedIcon,
  GridViewIcon,
  InstallIcon,
  MarkdownIcon,
  NewspaperIcon,
  OverviewIcon,
  RemoteFunctionIcon,
  RouteIcon,
  SsrIcon,
  StateManagementIcon,
  StorageIcon,
  StyleIcon,
  UserInterfaceIcon,
  WidgetsIcon,
  WorkflowIcon,
} from '@/components/icons.js';
import utilitiesRoute from './utilities/route.js';

const ICONS: Record<string, ComponentType> = {
  home: OverviewIcon,
  overview: OverviewIcon,
  docs: OverviewIcon,
  download: InstallIcon,
  install: InstallIcon,
  installation: InstallIcon,
  'rocket-launch': GettingStartedIcon,
  rocket: GettingStartedIcon,
  'getting-started': GettingStartedIcon,
  book: GettingStartedIcon,
  dns: SsrIcon,
  ssr: SsrIcon,
  'universal-ssr': SsrIcon,
  server: SsrIcon,
  markdown: MarkdownIcon,
  call: RemoteFunctionIcon,
  rpc: RemoteFunctionIcon,
  'remote-function': RemoteFunctionIcon,
  'account-tree': WorkflowIcon,
  tree: WorkflowIcon,
  workflow: WorkflowIcon,
  workflows: WorkflowIcon,
  'data-object': StateManagementIcon,
  object: StateManagementIcon,
  state: StateManagementIcon,
  'state-management': StateManagementIcon,
  anchor: StateManagementIcon,
  route: RouteIcon,
  palette: UserInterfaceIcon,
  ui: UserInterfaceIcon,
  'user-interface': UserInterfaceIcon,
  checklist: ChecklistIcon,
  style: StyleIcon,
  storage: StorageIcon,
  widgets: WidgetsIcon,
  'grid-view': GridViewIcon,
  grid: GridViewIcon,
  extension: ExtensionIcon,
  build: BuildIcon,
  article: ArticleIcon,
  newspaper: NewspaperIcon,
  news: NewspaperIcon,
};

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

function toNavItems(entries: MetaEntry[], withIcon = false): NavItem[] {
  return entries
    .map(({ path, meta }) => {
      const text = meta.nav || meta.title || path;
      const priority = meta['nav-priority'] ?? 999;
      const Icon = withIcon && meta['nav-icon'] ? ICONS[meta['nav-icon']] : undefined;

      return {
        text,
        priority,
        href: path,
        title: meta.title,
        icon: Icon ? () => <Icon /> : undefined,
      };
    })
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    .map(({ text, href, icon, title }) => (icon ? { text, href, icon, title } : { text, href, title }));
}

export const navs: NavItem[] = [
  ...toNavItems(docsMeta, true),
  { separator: true },
  {
    text: 'State Management',
    icon: () => <StateManagementIcon />,
    collapsed: true,
    items: toNavItems(stateMeta),
  },
  {
    text: 'Remote Function',
    icon: () => <RemoteFunctionIcon />,
    collapsed: true,
    items: toNavItems(remoteFunctionMeta),
  },
  {
    text: 'Routing',
    icon: () => <RouteIcon />,
    collapsed: true,
    items: toNavItems(routingMeta),
  },
  {
    text: 'Workflows',
    icon: () => <WorkflowIcon />,
    collapsed: true,
    items: toNavItems(workflowMeta),
  },
  {
    text: 'User Interface',
    icon: () => <UserInterfaceIcon />,
    collapsed: true,
    items: toNavItems(uiMeta),
  },
  { separator: true },
  {
    text: 'Form',
    icon: () => <ChecklistIcon />,
    collapsed: true,
    items: toNavItems(formMeta),
  },
  {
    text: 'ARIA',
    icon: () => <WidgetsIcon />,
    collapsed: true,
    items: [
      ...toNavItems(ariaMeta)
        .filter((item) => item.href !== '/docs/aria/selection')
        .sort((a, b) => a.href.localeCompare(b.href)),
      { separator: true },
      {
        text: 'Composites',
        icon: () => <GridViewIcon />,
        items: toNavItems(ariaCompositesMeta),
        collapsed: true,
      },
      {
        text: 'ARIA Utilities',
        items: [toNavItems(ariaMeta).find((item) => item.href === '/docs/aria/selection')!],
        collapsed: true,
        icon: () => <BuildIcon />,
      },
    ],
  },
  // {
  //   text: 'AirLib Material 3 CSS',
  //   icon: () => <StyleIcon />,
  //   collapsed: true,
  //   items: [
  //     ...toNavItems(materialMeta),
  //     {
  //       text: 'Components',
  //       icon: () => <WidgetsIcon />,
  //       items: toNavItems(componentsMeta),
  //     },
  //     {
  //       text: 'Layout',
  //       icon: () => <GridViewIcon />,
  //       items: toNavItems(layoutMeta),
  //     },
  //     {
  //       text: 'Extensions',
  //       icon: () => <ExtensionIcon />,
  //       items: toNavItems(extensionsMeta),
  //     },
  //     {
  //       text: 'Utilities',
  //       icon: () => <BuildIcon />,
  //       items: toNavItems(materialUtilitiesMeta),
  //     },
  //   ],
  // },
  {
    text: 'Storage',
    icon: () => <StorageIcon />,
    collapsed: true,
    items: toNavItems(storageMeta),
  },
  {
    text: 'Utilities',
    route: utilitiesRoute,
    icon: () => <BuildIcon />,
  },
];
