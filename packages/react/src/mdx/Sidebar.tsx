import type { PreloadMode } from '@airlib/router';
import type { HTMLAttributes, ReactNode } from 'react';
import {
  type AnyType,
  classx,
  effect,
  For,
  Link,
  mutable,
  setup,
  Show,
  template,
  uIndex,
  uiRouterCtx,
  untrack,
} from '../index.js';

const SIDEBAR_NODE_INDEX = Symbol.for('air.mdx.sidebar.node');

export interface NavItem {
  text?: string;
  href?: string;
  icon?: (props?: AnyType) => ReactNode;
  route?: AnyType;
  items?: NavItem[];
  title?: string;
  separator?: boolean;
  collapsed?: boolean;
}

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  nav: NavItem[];
  preload?: PreloadMode;
  collapsible?: boolean;
}

export const Sidebar = template<SidebarProps>(
  ({ nav, className, preload, collapsible, ...restProps }) => (
    <nav {...restProps} className={classx('air-mdx-sidebar-nav', className)}>
      <For each={() => nav}>{(item) => <SidebarNode item={item} preload={preload} collapsible={collapsible} />}</For>
    </nav>
  ),
  'Sidebar'
);

export interface SidebarNodeProps extends HTMLAttributes<HTMLElement> {
  item: NavItem;
  level?: number;
  preload?: PreloadMode;
  collapsible?: boolean;
}

export const SidebarNode = setup<SidebarNodeProps>((props) => {
  const $restProps = props.$omit(['item', 'className', 'level', 'preload', 'collapsible']);
  const ctx = uiRouterCtx.get();
  const collapsed = mutable(untrack(() => (props.collapsible ?? false) && (props.item?.collapsed ?? false)));
  const childrenId = `sbn-${uIndex(SIDEBAR_NODE_INDEX)}`;

  const toggleCollapsed = () => {
    collapsed.value = !collapsed.value;
  };

  const hasActiveRoute = (item: NavItem) => {
    if (item.route?.active) return true;

    if (item.href && ctx?.router) {
      if (ctx.router.context.fullPath === item.href) return true;
    }

    if (item.items) return item.items.some(hasActiveRoute);
  };

  effect(() => {
    const hasActive = hasActiveRoute(props.item);
    if (hasActive) collapsed.value = false;
  });

  return () => {
    const { item, className, level, preload, collapsible } = props;

    if (item.separator) {
      return <hr {...$restProps} className={classx('air-mdx-sidebar-separator', className)} />;
    }

    if (item.items && item.items.length > 0) {
      const chevron = (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="16px"
          viewBox="0 -960 960 960"
          width="16px"
          fill="currentColor"
          aria-hidden="true"
          className="air-mdx-sidebar-chevron"
        >
          <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" />
        </svg>
      );

      return (
        <div
          {...$restProps}
          role="group"
          aria-label={item.text}
          className={classx('air-mdx-sidebar-group-container', { collapsed: collapsed.value }, className)}
          style={{ '--air-nav-level': `${level ?? 0}` } as Record<string, string>}
        >
          <Show when={() => item.text}>
            {() =>
              item.route ? (
                <div className="air-mdx-sidebar-group-header">
                  <Link
                    to={item.route as AnyType}
                    className="air-mdx-sidebar-link"
                    activeClass="active"
                    preload={preload}
                    keepVisible
                  >
                    <SidebarItem icon={item.icon} text={item.text} />
                  </Link>
                  <Show when={() => collapsible}>
                    {() => (
                      <button
                        type="button"
                        className="air-mdx-sidebar-toggle"
                        aria-expanded={!collapsed.value}
                        aria-controls={childrenId}
                        aria-label={item.text}
                        onClick={toggleCollapsed}
                      >
                        {chevron}
                      </button>
                    )}
                  </Show>
                </div>
              ) : collapsible ? (
                <button
                  type="button"
                  className="air-mdx-sidebar-group air-mdx-sidebar-group-toggle"
                  aria-expanded={!collapsed.value}
                  aria-controls={childrenId}
                  onClick={toggleCollapsed}
                >
                  <SidebarItem icon={item.icon} text={item.text} />
                  {chevron}
                </button>
              ) : (
                <div className="air-mdx-sidebar-group" aria-hidden="true">
                  <SidebarItem icon={item.icon} text={item.text} />
                </div>
              )
            }
          </Show>
          <div id={childrenId} className="air-mdx-sidebar-children" hidden={collapsed.value}>
            <For each={() => item.items!}>
              {(child) => (
                <SidebarNode
                  item={child}
                  preload={preload}
                  collapsible={collapsible}
                  level={typeof level === 'number' ? level + 1 : level}
                />
              )}
            </For>
          </div>
        </div>
      );
    }

    if (item.route) {
      return (
        <Link
          {...($restProps as AnyType)}
          to={item.route as AnyType}
          className={classx('air-mdx-sidebar-link', className)}
          activeClass="active"
          preload={preload}
          keepVisible
        >
          <SidebarItem icon={item.icon} text={item.text} />
        </Link>
      );
    } else if (item.href) {
      return (
        <Link
          {...($restProps as AnyType)}
          href={item.href}
          className={classx('air-mdx-sidebar-link', className)}
          activeClass="active"
          preload={preload}
          keepVisible
        >
          <SidebarItem icon={item.icon} text={item.text} />
        </Link>
      );
    }

    return (
      <span {...$restProps} className={classx('air-mdx-sidebar-text', className)}>
        <SidebarItem icon={item.icon} text={item.text} />
      </span>
    );
  };
}, 'SidebarNode');

const SidebarItem = template<{ icon?: () => ReactNode; text?: string }>(
  ({ icon, text }) => (
    <>
      {icon?.()}
      <span className="air-mdx-sidebar-item">{text}</span>
    </>
  ),
  'SidebarItem'
);
