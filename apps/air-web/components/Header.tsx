import { type AnyRoute, classx, For, Link, mutable, Show, Slot, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import docsRoute from '../pages/(docs)/route.js';
import ariaRoute from '../pages/aria/route.js';
import postsRoute from '../pages/posts/route.js';
import releasesRoute from '../pages/releases/route.js';
import rootRoute from '../pages/route.js';
import { DiscordIcon, GitHubIcon } from './icons.js';
import { LogoText } from './LogoText.js';
import { Search } from './Search.js';

const navs = [
  {
    text: 'Headless Kits',
    route: ariaRoute,
  },
  {
    text: 'Docs',
    route: docsRoute,
  },
  {
    text: 'Posts',
    route: postsRoute,
  },
  {
    text: 'Releases',
    route: releasesRoute,
  },
];

type HeaderProps = ComponentProps<'header'>;
type HeaderSlots = {
  nav?: () => ReactNode;
  search?: () => ReactNode;
};

const Header = setup<HeaderProps, HeaderSlots>((props, snippets) => {
  const state = mutable({ open: false });

  const close = () => {
    state.open = false;
  };

  return () => (
    <header className={classx('air-header', props.className)}>
      <div className="air-header-inner">
        <Link to={rootRoute} className="air-header-logo" aria-label="AirLib Logo" onClick={close}>
          <LogoText className="logo-text-image" />
        </Link>
        <Slot for={() => snippets.nav?.()}>
          <nav className="air-header-nav mx-4 hidden md:flex lg:mx-10">
            <For each={() => navs}>
              {({ route, text }) => (
                <Link to={route as AnyRoute} className="air-header-link" activeClass="active">
                  {text}
                </Link>
              )}
            </For>
          </nav>
        </Slot>
        <div className="flex-1">{props.children}</div>
        <Slot for={() => snippets.search?.()}>
          <div className="mx-2 hidden sm:block lg:mx-5">
            <Search />
          </div>
        </Slot>
        <ul className="air-header-socials hidden sm:flex items-center gap-4 sm:gap-6">
          <li>
            <a href="https://github.com/beerush-id/airstack" target="_blank" aria-label="GitHub">
              <GitHubIcon />
              <span className="hidden lg:inline">GitHub</span>
            </a>
          </li>
          <li>
            <a href="https://discord.gg/GJSXpKjxFR" target="_blank" aria-label="Discord">
              <DiscordIcon />
              <span className="hidden lg:inline">Discord</span>
            </a>
          </li>
        </ul>
        <button
          type="button"
          className="air-header-mobile-toggle inline-flex md:hidden items-center justify-center size-9 rounded-lg text-on-surface hover:text-primary transition-colors cursor-pointer"
          aria-label="Toggle navigation menu"
          onClick={() => (state.open = !state.open)}
        >
          <Show when={() => state.open} fallback={() => <MenuIcon className="size-6" />}>
            {() => <CloseIcon className="size-6" />}
          </Show>
        </button>
      </div>

      <Show when={() => state.open}>
        <div
          className="air-header-mobile-panel fixed inset-x-0 top-(--spacing-header) border-b border-border bg-surface px-6 py-5 shadow-xl md:hidden flex flex-col gap-4"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) close();
          }}
        >
          <div className="w-full sm:hidden">
            <Search />
          </div>
          <nav className="flex flex-col gap-3">
            <For each={() => navs}>
              {({ route, text }) => (
                <Link
                  to={route as AnyRoute}
                  className="text-base font-semibold text-on-surface hover:text-primary transition-colors py-1"
                  activeClass="text-primary"
                >
                  {text}
                </Link>
              )}
            </For>
          </nav>
          <div className="flex items-center gap-6 pt-3 border-t border-border sm:hidden">
            <a
              href="https://github.com/beerush-id/airstack"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface hover:text-primary"
            >
              <GitHubIcon className="size-4.5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://discord.gg/GJSXpKjxFR"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface hover:text-primary"
            >
              <DiscordIcon className="size-4.5" />
              <span>Discord</span>
            </a>
          </div>
        </div>
      </Show>
    </header>
  );
}, 'Header');

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 -960 960 960" fill="currentColor" className={classx('size-6', className)} aria-hidden="true">
      <path d="M160-269.23v-40h640v40H160ZM160-460v-40h640v40H160Zm0-190.77v-40h640v40H160Z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={classx('size-6', className)}
      aria-hidden="true"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default Header;
