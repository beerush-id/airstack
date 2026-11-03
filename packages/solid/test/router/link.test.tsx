/** @jsxImportSource solid-js */

import { createRouter, DEFAULT_CONFIG } from '@airlib/router';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { Link, page, UIRouter, uiRouterCtx } from '../../src/index.js';
import { DEFAULT_ROUTER_CONFIGS } from '../../src/router/constant.js';

describe('Anchor Solid - Link Component', () => {
  let pushSpy: MockInstance;
  let replaceSpy: MockInstance;
  let dispatchSpy: MockInstance;
  let scrollToSpy: MockInstance;
  let scrollIntoViewSpy: MockInstance;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    pushSpy = vi.spyOn(history, 'pushState');
    replaceSpy = vi.spyOn(history, 'replaceState');
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    scrollIntoViewSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewSpy as never;

    // Suppress jsdom navigation notice when testing browser-yielded clicks
    (window as any)._virtualConsole?.removeAllListeners?.('jsdomError');
    (window as any)._virtualConsole?.on?.('jsdomError', (error: any) => {
      if (error?.message?.includes('navigation to another Document')) return;
      console.error(error);
    });
  });

  afterEach(() => {
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
    dispatchSpy.mockRestore();
    scrollToSpy.mockRestore();
    uiRouterCtx.set(undefined as never);
    window.history.replaceState(null, '', '/');
  });

  const lastPopState = () =>
    dispatchSpy.mock.calls
      .map(([event]) => event as Event)
      .find((event): event is PopStateEvent => event instanceof PopStateEvent);

  describe('href resolution', () => {
    it('renders an anchor with the fullPath of a string href', () => {
      render(() => <Link href="/about">About Us</Link>);
      const anchor = screen.getByText('About Us');

      expect(anchor.tagName).toBe('A');
      expect(anchor.getAttribute('href')).toBe('/about');
    });

    it('normalizes trailing slashes away from the rendered href', () => {
      render(() => <Link href="/about/">About</Link>);

      expect(screen.getByText('About').getAttribute('href')).toBe('/about');
    });

    it('keeps query strings from a string href in the rendered href', () => {
      render(() => <Link href="/search?q=anchor">Search</Link>);

      expect(screen.getByText('Search').getAttribute('href')).toBe('/search?q=anchor');
    });

    it('resolves index route for parent route when matched by href', () => {
      const router = createRouter<JSX.Element>();
      const parentRoute = router.route('/dashboard');
      parentRoute.index = router.route('/dashboard') as any;

      render(() => (
        <UIRouter router={router}>
          <Link href="/dashboard">Dashboard</Link>
        </UIRouter>
      ));

      expect(screen.getByText('Dashboard').getAttribute('href')).toBe('/dashboard');
    });

    it('resolves href when matching a route without an index route', () => {
      const router = createRouter<JSX.Element>();
      router.route('/about');

      render(() => (
        <UIRouter router={router}>
          <Link href="/about">About Us</Link>
        </UIRouter>
      ));

      expect(screen.getByText('About Us').getAttribute('href')).toBe('/about');
    });

    it('handles unmatched href inside UIRouter gracefully', () => {
      const router = createRouter<JSX.Element>();

      render(() => (
        <UIRouter router={router}>
          <Link href="/unmatched-destination">Unmatched</Link>
        </UIRouter>
      ));

      expect(screen.getByText('Unmatched').getAttribute('href')).toBe('/unmatched-destination');
    });

    it('detects cross-origin href and renders full URL as href without forcing a default target', () => {
      render(() => <Link href="https://example.com/docs?lang=en#setup">External Docs</Link>);
      const anchor = screen.getByText('External Docs');

      expect(anchor.tagName).toBe('A');
      expect(anchor.getAttribute('href')).toBe('https://example.com/docs?lang=en#setup');
      expect(anchor.getAttribute('target')).toBeNull();
    });

    it('preserves an explicit target attribute on cross-origin links', () => {
      render(() => (
        <Link href="https://example.com/login" target="_self">
          External Login
        </Link>
      ));
      const anchor = screen.getByText('External Login');

      expect(anchor.getAttribute('href')).toBe('https://example.com/login');
      expect(anchor.getAttribute('target')).toBe('_self');
    });

    it('resolves the href from a bare Route in `to`', () => {
      const router = createRouter();
      const settingsRoute = router.route('/settings');

      render(() => <Link to={settingsRoute}>Settings</Link>);

      expect(screen.getByText('Settings').getAttribute('href')).toBe('/settings');
    });

    it('resolves the href from a RouteComponent in `to`', () => {
      const router = createRouter();
      const SettingsRoute = page(router.route('/settings'));

      render(() => <Link to={SettingsRoute}>Settings</Link>);

      expect(screen.getByText('Settings').getAttribute('href')).toBe('/settings');
    });

    it('fills dynamic route params into the href', () => {
      const router = createRouter();
      const profileRoute = router.route('/users').route('/:id');

      render(() => (
        <Link to={profileRoute} params={{ id: '42' }}>
          Profile
        </Link>
      ));

      expect(screen.getByText('Profile').getAttribute('href')).toBe('/users/42');
    });

    it('appends the query prop to route-based hrefs', () => {
      const router = createRouter();
      const contactRoute = router.route('/contact?ref');

      render(() => (
        <Link to={contactRoute} query={{ ref: 'test' }}>
          Contact
        </Link>
      ));

      expect(screen.getByText('Contact').getAttribute('href')).toBe('/contact?ref=test');
    });

    it('renders an empty href when neither `to` nor `href` is provided', () => {
      render(() => <Link>Empty Link</Link>);

      expect(screen.getByText('Empty Link').getAttribute('href')).toBe('/');
    });

    it('forwards unrelated attributes to the anchor element', () => {
      render(() => (
        <Link href="/about" data-testid="about-link" title="About us">
          About
        </Link>
      ));

      const anchor = screen.getByTestId('about-link');
      expect(anchor.tagName).toBe('A');
      expect(anchor.getAttribute('title')).toBe('About us');
    });
  });

  describe('active state', () => {
    it('applies aria-current and activeClass when the route is active', () => {
      const router = createRouter();
      const dashboardRoute = router.route('/dashboard');
      dashboardRoute.active = true;

      render(() => (
        <Link to={dashboardRoute} class="btn" activeClass="btn-active">
          Dashboard
        </Link>
      ));

      const anchor = screen.getByText('Dashboard');
      expect(anchor.getAttribute('aria-current')).toBe('page');
      expect(anchor.className).toContain('btn');
      expect(anchor.className).toContain('btn-active');
    });

    it('omits active styling when the route is inactive', () => {
      const router = createRouter();
      const dashboardRoute = router.route('/dashboard');
      dashboardRoute.active = false;

      render(() => (
        <Link to={dashboardRoute} class="btn" activeClass="btn-active">
          Dashboard
        </Link>
      ));

      const anchor = screen.getByText('Dashboard');
      expect(anchor.getAttribute('aria-current')).toBeNull();
      expect(anchor.className).not.toContain('btn-active');
    });

    it('reflects active state for string hrefs resolved through the router context', () => {
      dispatchSpy.mockImplementation(() => true);
      const router = createRouter<JSX.Element>();
      const aboutRoute = router.route('/about');
      aboutRoute.active = true;

      render(() => (
        <UIRouter router={router}>
          <Link href="/about" activeClass="current">
            About
          </Link>
        </UIRouter>
      ));

      const anchor = screen.getByText('About');
      expect(anchor.getAttribute('aria-current')).toBe('page');
      expect(anchor.className).toContain('current');
    });
  });

  describe('click navigation', () => {
    it('pushes from/to state payloads and dispatches a popstate event', () => {
      const from = { path: location.pathname, hash: location.hash, href: location.href, query: location.search };
      const to = {
        path: '/contact',
        hash: '',
        href: `${location.origin}/contact`,
        query: '',
      };

      render(() => <Link href="/contact">Contact</Link>);
      fireEvent.click(screen.getByText('Contact'));

      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(pushSpy).toHaveBeenCalledWith({ from, to }, '', to.href);
      expect(replaceSpy).not.toHaveBeenCalled();
      expect(lastPopState()?.state).toEqual({ from, to });
    });

    it('uses replaceState instead of pushState when `replace` is set', () => {
      render(() => (
        <Link href="/login" replace>
          Login
        </Link>
      ));
      fireEvent.click(screen.getByText('Login'));

      expect(replaceSpy).toHaveBeenCalledTimes(1);
      expect(replaceSpy).toHaveBeenCalledWith(
        expect.objectContaining({ to: expect.objectContaining({ path: '/login' }) }),
        '',
        `${location.origin}/login`
      );
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('navigates to the resolved url of a route target', () => {
      const router = createRouter();
      const contactRoute = router.route('/contact');

      render(() => <Link to={contactRoute}>Contact</Link>);
      fireEvent.click(screen.getByText('Contact'));

      expect(pushSpy).toHaveBeenCalledWith(
        expect.objectContaining({ to: expect.objectContaining({ path: '/contact' }) }),
        '',
        `${location.origin}/contact`
      );
    });

    it('skips navigation and onClick when the target url is already current', () => {
      window.history.replaceState(null, '', `${DEFAULT_CONFIG.baseUrl}/projects`);
      pushSpy.mockClear();
      replaceSpy.mockClear();

      const onClick = vi.fn();

      render(() => (
        <Link href="/projects" onClick={onClick}>
          Projects
        </Link>
      ));
      fireEvent.click(screen.getByText('Projects'));

      expect(pushSpy).not.toHaveBeenCalled();
      expect(replaceSpy).not.toHaveBeenCalled();
      expect(onClick).toHaveBeenCalled();
    });

    it('yields to the browser for modifier keys, non-left buttons, and custom targets', () => {
      const onClick = vi.fn();
      render(() => (
        <Link href="/about" onClick={onClick}>
          About
        </Link>
      ));
      const anchor = screen.getByText('About');

      fireEvent.click(anchor, { metaKey: true });
      fireEvent.click(anchor, { ctrlKey: true });
      fireEvent.click(anchor, { shiftKey: true });
      fireEvent.click(anchor, { altKey: true });
      fireEvent.click(anchor, { button: 1 });

      expect(pushSpy).not.toHaveBeenCalled();
      expect(replaceSpy).not.toHaveBeenCalled();
      expect(onClick).toHaveBeenCalledTimes(5);
    });

    it('yields to the browser and invokes onClick for cross-origin links', () => {
      const onClick = vi.fn();
      render(() => (
        <Link href="https://example.com" onClick={onClick}>
          External
        </Link>
      ));
      fireEvent.click(screen.getByText('External'));

      expect(pushSpy).not.toHaveBeenCalled();
      expect(replaceSpy).not.toHaveBeenCalled();
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('yields to the browser when a target attribute is set', () => {
      render(() => (
        <Link href="/external" target="_blank">
          External
        </Link>
      ));
      fireEvent.click(screen.getByText('External'));

      expect(pushSpy).not.toHaveBeenCalled();
      expect(replaceSpy).not.toHaveBeenCalled();
    });

    it('invokes the custom onClick handler after dispatching navigation', () => {
      const onClick = vi.fn();

      render(() => (
        <Link href="/next" onClick={onClick}>
          Next
        </Link>
      ));
      fireEvent.click(screen.getByText('Next'));

      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('hash navigation', () => {
    it('scopes hash hrefs to the current pathname and carries the hash into the state payload', () => {
      window.history.replaceState(null, '', `${DEFAULT_CONFIG.baseUrl}/docs`);

      render(() => <Link href="#setup">Setup</Link>);
      fireEvent.click(screen.getByText('Setup'));

      expect(pushSpy).toHaveBeenCalledTimes(1);
      const [data, , url] = pushSpy.mock.calls[0] as [Record<string, any>, string, string];

      expect(data.to.path).toBe('/docs');
      expect(data.to.hash).toBe('setup');
      expect(url).toBe(`${location.origin}/docs#setup`);
    });
  });

  describe('scroll management', () => {
    it('scrolls the body to the top on navigation when resetScroll is set', () => {
      const scrollTo = vi.fn();
      document.body.scrollTo = scrollTo;

      render(() => (
        <Link href="/next" resetScroll>
          Next
        </Link>
      ));
      fireEvent.click(screen.getByText('Next'));

      expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'auto' });
    });

    it('uses the string resetScroll value as scroll behavior', () => {
      const scrollTo = vi.fn();
      document.body.scrollTo = scrollTo;

      render(() => (
        <Link href="/next" resetScroll="smooth">
          Next
        </Link>
      ));
      fireEvent.click(screen.getByText('Next'));

      expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'smooth' });
    });

    it('leaves scroll restoration to the router when UIRouter manages it', () => {
      dispatchSpy.mockImplementation(() => true);
      const scrollTo = vi.fn();
      document.body.scrollTo = scrollTo;

      const router = createRouter<JSX.Element>();
      router.route('/next');

      render(() => (
        <UIRouter router={router} resetScroll>
          <Link href="/next" resetScroll>
            Next
          </Link>
        </UIRouter>
      ));
      fireEvent.click(screen.getByText('Next'));

      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('scrolls an active link into view on mount when keepVisible is set', async () => {
      const router = createRouter();
      const dashboardRoute = router.route('/dashboard');
      dashboardRoute.active = true;

      const scrollToSpy = vi.fn();
      HTMLElement.prototype.scrollTo = scrollToSpy;
      const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
      const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 500 });
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 200 });

      try {
        render(() => (
          <div style={{ 'overflow-y': 'auto' }}>
            <Link to={dashboardRoute} keepVisible>
              Dashboard
            </Link>
          </div>
        ));

        await Promise.resolve();
        expect(scrollToSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            behavior: DEFAULT_ROUTER_CONFIGS.scrollBehavior,
          })
        );
      } finally {
        if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
        if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
      }
    });

    it('uses the string keepVisible value as scroll behavior', async () => {
      const router = createRouter();
      const dashboardRoute = router.route('/dashboard');
      dashboardRoute.active = true;

      const scrollToSpy = vi.fn();
      HTMLElement.prototype.scrollTo = scrollToSpy;
      const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
      const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 500 });
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 200 });

      try {
        render(() => (
          <div style={{ 'overflow-y': 'auto' }}>
            <Link to={dashboardRoute} keepVisible="auto">
              Dashboard
            </Link>
          </div>
        ));

        await Promise.resolve();
        expect(scrollToSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            behavior: 'auto',
          })
        );
      } finally {
        if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
        if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
      }
    });

    it('does not scroll inactive links into view even with keepVisible', async () => {
      const router = createRouter();
      const dashboardRoute = router.route('/dashboard');
      dashboardRoute.active = false;

      const scrollToSpy = vi.fn();
      HTMLElement.prototype.scrollTo = scrollToSpy;

      render(() => (
        <div style={{ 'overflow-y': 'auto' }}>
          <Link to={dashboardRoute} keepVisible>
            Dashboard
          </Link>
        </div>
      ));

      await Promise.resolve();
      expect(scrollToSpy).not.toHaveBeenCalled();
    });
  });

  describe('hover preloading', () => {
    it('preloads the target on hover when preload="hover" is set', () => {
      const router = createRouter();
      const heavyRoute = router.route('/heavy');
      const preloadSpy = vi.spyOn(router, 'preload').mockImplementation(async () => {}) as any;

      render(() => (
        <Link to={heavyRoute} preload="hover">
          Heavy
        </Link>
      ));
      fireEvent.mouseEnter(screen.getByText('Heavy'));

      expect(preloadSpy).toHaveBeenCalledWith('/heavy');
      preloadSpy.mockRestore();
    });

    it('preloads on hover when the route options define preloadMode hover', () => {
      const router = createRouter();
      const heavyRoute = router.route('/heavy-native', { preloadMode: 'hover' });
      const preloadSpy = vi.spyOn(router, 'preload').mockImplementation(async () => {}) as any;

      render(() => <Link to={heavyRoute}>Heavy Native</Link>);
      fireEvent.mouseEnter(screen.getByText('Heavy Native'));

      expect(preloadSpy).toHaveBeenCalledWith('/heavy-native');
      preloadSpy.mockRestore();
    });

    it('forwards onMouseEnter but does not preload without a hover mode', () => {
      const router = createRouter();
      const plainRoute = router.route('/plain');
      const preloadSpy = vi.spyOn(router, 'preload').mockImplementation(async () => {}) as any;
      const onMouseEnter = vi.fn();

      render(() => (
        <Link to={plainRoute} onMouseEnter={onMouseEnter}>
          Plain
        </Link>
      ));
      fireEvent.mouseEnter(screen.getByText('Plain'));

      expect(preloadSpy).not.toHaveBeenCalled();
      expect(onMouseEnter).toHaveBeenCalledTimes(1);
      preloadSpy.mockRestore();
    });
  });

  describe('ref forwarding and keepVisible', () => {
    it('invokes callback refs with the anchor element', () => {
      const ref = vi.fn();

      render(() => (
        <Link href="/about" ref={ref as never}>
          About
        </Link>
      ));

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLElement));
    });

    it('scrolls into view on mount when keepVisible is true and route is active', () => {
      const router = createRouter();
      const activeRoute = router.route('/active-visible');
      activeRoute.active = true;
      const scrollToSpy = vi.fn();
      HTMLElement.prototype.scrollTo = scrollToSpy;
      const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
      const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 500 });
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 200 });

      try {
        render(() => (
          <div style={{ 'overflow-y': 'auto' }}>
            <Link to={activeRoute} keepVisible>
              Active Item
            </Link>
          </div>
        ));

        expect(scrollToSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            behavior: DEFAULT_ROUTER_CONFIGS.scrollBehavior,
          })
        );
      } finally {
        if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
        if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
      }
    });

    it('scrolls into view using custom behavior string when keepVisible is a string', () => {
      const router = createRouter();
      const activeRoute = router.route('/active-instant');
      activeRoute.active = true;
      const scrollToSpy = vi.fn();
      HTMLElement.prototype.scrollTo = scrollToSpy;
      const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
      const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 500 });
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 200 });

      try {
        render(() => (
          <div style={{ 'overflow-y': 'auto' }}>
            <Link to={activeRoute} keepVisible="instant">
              Instant Item
            </Link>
          </div>
        ));

        expect(scrollToSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            behavior: 'instant',
          })
        );
      } finally {
        if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
        if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
      }
    });

    it('handles mouseEnter on link without active route', () => {
      const mouseEnterSpy = vi.fn();
      render(() => (
        <Link href="/plain-external" onMouseEnter={mouseEnterSpy}>
          Plain External
        </Link>
      ));

      fireEvent.mouseEnter(screen.getByText('Plain External'));
      expect(mouseEnterSpy).toHaveBeenCalled();
    });
  });
});
