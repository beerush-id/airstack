import type { NavItem } from '@airlib/react/mdx';
import { docsIndexRoute, docsThemingRoute } from './route.js';
import { widgetsButtonRoute, widgetsSelectRoute, widgetsToggleRoute } from './widgets/route.js';

export const navs: NavItem[] = [
  { text: 'Overview', route: docsIndexRoute },
  { text: 'Theming', route: docsThemingRoute },
  {
    text: 'Widgets',
    items: [
      { text: 'Button', route: widgetsButtonRoute },
      { text: 'Toggle', route: widgetsToggleRoute },
      { text: 'Select', route: widgetsSelectRoute },
    ],
  },
];
