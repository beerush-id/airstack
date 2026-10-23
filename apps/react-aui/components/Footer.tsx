import { classx, Link } from '@airlib/react';
import type { ComponentProps } from 'react';
import { docsGettingStartedRoute, docsIndexRoute, docsThemingRoute } from '../pages/docs/route.js';
import rootRoute from '../pages/route.js';

const POPULAR = [
  { label: 'Select', href: '/docs/widgets/select' },
  { label: 'Combobox', href: '/docs/widgets/combobox' },
  { label: 'Date Picker', href: '/docs/widgets/date-picker' },
  { label: 'Dialog', href: '/docs/widgets/dialog' },
  { label: 'Menu', href: '/docs/widgets/menu' },
  { label: 'Tabs', href: '/docs/widgets/tabs' },
];

export default function Footer({ className }: ComponentProps<'footer'>) {
  return (
    <footer className={classx('site-footer', className)}>
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link to={rootRoute} className="site-footer-logo" aria-label="React AUI home">
            React AUI
          </Link>
          <p className="site-footer-tagline">
            Accessible React components that already look finished. Built on AirLib Headless Kits and the AUI design
            system.
          </p>
        </div>

        <nav className="site-footer-columns" aria-label="Footer">
          <section className="site-footer-column">
            <h3>Learn</h3>
            <ul>
              <li>
                <Link to={docsIndexRoute}>Overview</Link>
              </li>
              <li>
                <Link to={docsGettingStartedRoute}>Getting Started</Link>
              </li>
              <li>
                <Link to={docsThemingRoute}>Theming</Link>
              </li>
            </ul>
          </section>

          <section className="site-footer-column">
            <h3>Popular components</h3>
            <ul>
              {POPULAR.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="site-footer-column">
            <h3>AirLib</h3>
            <ul>
              <li>
                <a href="https://airlib.dev" target="_blank" rel="noreferrer">
                  AirLib framework
                </a>
              </li>
              <li>
                <a href="https://github.com/beerush-id/airstack" target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://discord.gg/GJSXpKjxFR" target="_blank" rel="noreferrer">
                  Discord
                </a>
              </li>
            </ul>
          </section>
        </nav>
      </div>

      <div className="site-footer-bottom">
        <span>
          © {new Date().getFullYear()} React AUI · Made with love by{' '}
          <a href="https://mahdaen.name" target="_blank" rel="noreferrer">
            Nanang Mahdaen El Agung
          </a>
        </span>
        <span>Accessible by default · Styled when you want it</span>
      </div>
    </footer>
  );
}
