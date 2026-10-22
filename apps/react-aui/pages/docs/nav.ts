import type { NavItem } from '@airlib/react/mdx';
import { OverviewIcon, StyleIcon, WidgetsIcon } from '../../components/index.js';
import { docsIndexRoute, docsThemingRoute } from './route.js';
import { widgetsButtonRoute, widgetsSelectRoute, widgetsToggleRoute } from './widgets/route.js';

export const navs: NavItem[] = [
  { icon: OverviewIcon, text: 'Overview', route: docsIndexRoute },
  { icon: StyleIcon, text: 'Theming', route: docsThemingRoute },
  { separator: true },
  {
    icon: WidgetsIcon,
    text: 'Widgets',
    items: [
      { text: 'Button', route: widgetsButtonRoute },
      { text: 'Toggle', route: widgetsToggleRoute },
      { text: 'Select', route: widgetsSelectRoute },
    ],
  },
];
