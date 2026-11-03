import { Link, template } from '@airlib/react';
import { ariaIndexRoute } from '../../pages/(docs)/aria/route.js';

export const AriaCta = template(() => {
  return (
    <section className="border-t border-border" aria-labelledby="aria-cta-heading">
      <div className="air-section-inner py-12 lg:py-16">
        <div className={classes.inner}>
          <div className={classes.copy}>
            <span className="air-feature-eyebrow">Get started</span>
            <h2 id="aria-cta-heading" className="air-feature-title">
              Stop hand-writing ARIA.
            </h2>
            <p className="air-feature-body">
              Install the kit, wrap the pattern you need, and keep every pixel of the design you already have. The guide
              takes you from one controller to a full interface.
            </p>
          </div>

          <div className={classes.side}>
            <code className={classes.install}>bun add @airlib/aria</code>
            <div className={classes.actions}>
              <Link to={ariaIndexRoute} className="air-cta">
                Open the guide
              </Link>
              <a
                href="https://github.com/beerush-id/airstack"
                target="_blank"
                rel="noreferrer"
                className="air-cta-dark"
              >
                View source
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}, 'AriaCta');

const classes = {
  inner: 'grid items-center gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-16',
  copy: 'max-w-2xl',
  side: 'flex flex-col items-start gap-4 lg:items-end',
  install:
    'w-fit rounded-lg border border-border bg-surface px-3.5 py-2 font-mono text-[0.8125rem] leading-none text-on-surface',
  actions: 'flex flex-wrap items-center gap-3',
};
