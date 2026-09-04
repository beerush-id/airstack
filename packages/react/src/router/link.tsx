import { classx, derived, untrack } from '@airlib/core';
import { Route } from '@airlib/router';
import type { MouseEventHandler, ReactNode, RefObject } from 'react';
import { setup } from '../hoc.js';
import { onMount } from '../lifecycle.js';
import type { ComponentProps } from '../types.js';
import { DEFAULT_ROUTER_CONFIGS } from './constant.js';
import { getCurrentUrl, uiRouterCtx } from './router.tsx';
import type { AnyRoute, LinkProps, RouteComponent } from './types.js';

type LinkComponent = <T>(props: LinkProps<T>) => ReactNode;

/**
 * A reactive anchor component for client-side navigation.
 * Automatically handles `active` state and preloads route definitions on hover if configured.
 *
 * @param props Link properties including the target route (`to`), params, and query.
 *   `href` acts as the fallback target when `to` is absent; when both are present, `to` wins.
 * @returns A reactive `<a>` element.
 */
export const Link = setup<LinkProps<AnyRoute>>((props) => {
  const $props = props as ComponentProps<LinkProps<AnyRoute>> & {
    query: Record<string, unknown>;
    params: Record<string, unknown>;
  };
  const restProps = props.$omit([
    'to',
    'href',
    'params' as never,
    'query' as never,
    'onClick',
    'onMouseEnter',
    'preload',
    'replace',
    'activeClass',
    'className',
    'children',
    'fullMatch',
    'keepVisible',
    'resetScroll',
    'ref',
  ]);

  const ctx = uiRouterCtx.get();
  const router = ctx?.router;
  const state = derived.as(() => {
    const { href, params, query } = $props;

    const activeUrl = untrack(() => new URL(getCurrentUrl()));
    if (!activeUrl.pathname.endsWith('/')) {
      activeUrl.pathname = `${activeUrl.pathname}/`;
    }

    let route: AnyRoute | undefined;
    let target: URL;

    if (props.to) {
      route = props.to instanceof Route ? props.to : (props.to as RouteComponent<AnyRoute>).route;
      target = new URL(
        untrack(() => route!.url(params, query)),
        activeUrl
      );
    } else {
      target = new URL(href || '/', activeUrl);

      if (target.origin !== activeUrl.origin) {
        return {
          url: target,
          hash: target.hash.substring(1),
          href: target.href,
          search: target.search,
          pathname: target.pathname,
          fullPath: target.href,
        };
      }

      if (router && href) {
        route = untrack(() => router.find(target, true)?.route);
        /* istanbul ignore next */
        if (route?.index) route = route.index as unknown as AnyRoute;
      }
    }

    if (target.pathname !== '/' && target.pathname.endsWith('/')) {
      target.pathname = target.pathname.replace(/\/$/, '');
    }

    const hash = target.hash.substring(1);
    return {
      url: target,
      hash,
      route,
      query,
      params,
      href: target.href,
      search: target.search,
      pathname: target.pathname,
      fullPath: target.pathname + (target.hash ? target.hash : '') + target.search,
    };
  });

  const dispatchUrl = () => {
    const data = {
      from: { path: location.pathname, hash: location.hash, href: location.href, query: location.search },
      to: { path: state.pathname, hash: state.hash, href: state.href, query: state.search },
    };
    if (props.replace) {
      history.replaceState(data, '', state.href);
    } else {
      history.pushState(data, '', state.href);
    }
    window.dispatchEvent(new PopStateEvent('popstate', { state: data }));
  };

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    // Let the browser handle standard "open in new tab/window" modifiers and custom targets.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || $props.target) {
      return;
    }

    e.preventDefault();

    if (state.href !== location.href) {
      dispatchUrl();
      const behavior = typeof props.resetScroll === 'string' ? props.resetScroll : 'auto';

      if (!ctx?.resetScroll && props.resetScroll) {
        document.body.scrollTo({ left: 0, top: 0, behavior });
      }
    }

    $props.onClick?.(e);
  };

  const handleHover: MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (state.route && (props.preload === 'hover' || state.route.options.preloadMode === 'hover')) {
      void state.route.router.preload(state.fullPath);
    }

    $props.onMouseEnter?.(e);
  };

  const ref = { current: null } as RefObject<HTMLAnchorElement | null>;
  const assignRef = (el: HTMLAnchorElement | null) => {
    ref.current = el;

    let cleanup: (() => void) | undefined;

    if ('ref' in props) {
      if (typeof props.ref === 'function') {
        cleanup = props.ref(el) as never;
      } else {
        (props.ref as RefObject<HTMLAnchorElement | null>).current = el;
      }
    }

    return cleanup;
  };

  onMount(() => {
    if (!ref.current || !props.keepVisible || !state.route?.active) return;

    const el = ref.current;
    const behavior = typeof props.keepVisible === 'string' ? props.keepVisible : DEFAULT_ROUTER_CONFIGS.scrollBehavior;

    let container = el.parentElement;

    while (container && container !== document.body) {
      const scrollable = container.scrollHeight > container.clientHeight;

      if (scrollable && /(auto|scroll)/.test(getComputedStyle(container).overflowY)) {
        const elRect = el.getBoundingClientRect();
        const boxRect = container.getBoundingClientRect();

        container.scrollTo({
          top: container.scrollTop + elRect.top - boxRect.top - (container.clientHeight - elRect.height) / 2,
          behavior,
        });

        return;
      }

      container = container.parentElement;
    }
  });

  return () => (
    <a
      {...restProps}
      ref={assignRef}
      href={state.fullPath}
      onClick={handleClick}
      onMouseEnter={handleHover}
      aria-current={state.route?.active ? 'page' : undefined}
      className={classx(props.className, state.route?.active ? props.activeClass : null)}
    >
      {props.children}
    </a>
  );
}, 'Link') as LinkComponent;
