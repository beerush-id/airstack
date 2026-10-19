import { type AnyRoute, For, Link, mutable, setup, Show } from '@airlib/react';
import type { ComponentProps } from 'react';
import docsRoute from '../pages/docs/route.js';
import rootRoute from '../pages/route.js';

const navs = [{ text: 'Docs', route: docsRoute }];

const Header = setup<ComponentProps<'header'>>((props) => {
  const state = mutable({ open: false });

  const close = () => {
    state.open = false;
  };

  return () => (
    <header className="docs-header">
      <div className="docs-header-inner">
        <Link to={rootRoute} className="docs-header-brand" aria-label="React Maui home" onClick={close}>
          React Maui
        </Link>
        <nav className="docs-header-nav" aria-label="Primary">
          <For each={() => navs}>
            {({ route, text }) => (
              <Link to={route as AnyRoute} className="docs-header-link" activeClass="active">
                {text}
              </Link>
            )}
          </For>
        </nav>
        <div className="docs-header-spacer">{props.children}</div>
        <button
          type="button"
          className="docs-header-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={state.open}
          onClick={() => (state.open = !state.open)}
        >
          <Show when={() => state.open} fallback={() => <span aria-hidden="true">☰</span>}>
            {() => <span aria-hidden="true">✕</span>}
          </Show>
        </button>
      </div>

      <Show when={() => state.open}>
        <nav
          className="docs-header-panel"
          aria-label="Mobile"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) close();
          }}
        >
          <For each={() => navs}>
            {({ route, text }) => (
              <Link to={route as AnyRoute} className="docs-header-link" activeClass="active">
                {text}
              </Link>
            )}
          </For>
        </nav>
      </Show>
    </header>
  );
}, 'Header');

export default Header;
