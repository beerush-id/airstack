import { aria } from '@airlib/aria';
import { $bind, type Bindable, For, Link, mutable, setup, Snippet, template } from '@airlib/react';
import { ariaIndexRoute } from '../../pages/(docs)/aria/route.js';

export const AriaHero = template(() => {
  return (
    <section className={classes.root} aria-labelledby="aria-hero-heading">
      <div className={`air-section-inner ${classes.inner}`}>
        <div className={classes.copy}>
          <p className={classes.badge}>
            <span aria-hidden="true" className={classes.badgeDot} />
            Headless &middot; WAI-ARIA &middot; Zero styling
          </p>

          <h1 id="aria-hero-heading" className={classes.title}>
            Behavior for any element.
            <br />
            Your markup, your styles.
          </h1>

          <p className={classes.body}>
            <code className={classes.inlineCode}>@airlib/aria</code> compiles roles, states, focus order, and keyboard
            contracts onto the elements you already render — in React, SolidJS, or plain DOM.
          </p>

          <div className={classes.actions}>
            <Link to={ariaIndexRoute} className="air-cta">
              Read the guide
            </Link>
            <a href="#patterns" className="air-cta-dark">
              Browse 54 patterns
            </a>
          </div>

          <div className={classes.proof}>
            <code className={classes.install}>bun add @airlib/aria</code>

            <ul className={classes.proofList}>
              <For each={() => PROOF}>
                {(item) => (
                  <li className={classes.proofItem}>
                    <span aria-hidden="true" className={classes.proofDot} />
                    {item}
                  </li>
                )}
              </For>
            </ul>
          </div>
        </div>

        <AttributeInspector />
      </div>
    </section>
  );
}, 'AriaHero');

const AttributeInspector = setup(() => {
  const state = mutable({ pressed: false });

  return () => (
    <div className={classes.inspector}>
      <div className="alp-inspector">
        <div className="alp-inspector-head">
          <code className="alp-inspector-source">aria('toggle', props, &#123; native: false &#125;)</code>
          <span className="alp-inspector-live">Live</span>
        </div>

        <div className="alp-inspector-stage">
          <ToggleHost pressed={$bind(state, 'pressed')} />
        </div>

        <div className="alp-attr-list">
          <div className="alp-attr-row">
            <span className="alp-attr-key">role</span>
            <span className="alp-attr-value is-on">button</span>
          </div>
          <div className="alp-attr-row">
            <span className="alp-attr-key">tabindex</span>
            <span className="alp-attr-value">0</span>
          </div>
          <div className="alp-attr-row">
            <span className="alp-attr-key">aria-pressed</span>
            <Snippet data={() => state.pressed}>
              {(pressed) => (
                <span className={pressed ? 'alp-attr-value is-on' : 'alp-attr-value is-off'}>
                  {pressed ? 'true' : 'false'}
                </span>
              )}
            </Snippet>
          </div>
          <div className="alp-attr-row">
            <span className="alp-attr-key">type</span>
            <span className="alp-attr-value is-empty">&#8212; native hosts only</span>
          </div>
        </div>

        <p className="alp-inspector-note">
          A <code>&lt;div&gt;</code> has none of this. The controller injected the role and focusability, then handles
          Enter and Space itself — click it, or focus it and press either key.
        </p>
      </div>
    </div>
  );
}, 'AttributeInspector');

const ToggleHost = setup<{ pressed?: Bindable<boolean> }>((props) => {
  const toggle = aria<HTMLElement>('toggle', props, { native: false });

  return () => (
    <div ref={toggle.ref} {...toggle.restProps(['children'])} className="alp-host">
      <svg className="alp-host-star" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z" />
      </svg>
      <span>Favourite</span>
    </div>
  );
}, 'ToggleHost');

const dotGrid =
  'bg-[radial-gradient(color-mix(in_srgb,var(--color-on-surface)_14%,transparent)_1px,transparent_1px)] bg-size-[22px_22px]';

const PROOF = ['54 documented patterns', 'React, SolidJS & plain DOM', '0 bytes of CSS shipped'];

const classes = {
  root: `relative overflow-hidden border-b border-border ${dotGrid}`,
  inner:
    'relative z-(--z-content) grid items-center gap-12 py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 lg:pt-20 lg:pb-24',
  copy: 'flex min-w-0 flex-col items-start',
  badge:
    'inline-flex items-center gap-2 rounded-full border border-border bg-surface-variant px-3 py-1 text-xs font-semibold text-on-surface-variant',
  badgeDot: 'size-1.5 rounded-full bg-brand',
  title:
    'mt-6 max-w-[24ch] font-heading text-[2.5rem] leading-[1.1] font-medium tracking-[-1.2px] text-on-surface lg:text-[3.25rem]',
  body: 'mt-6 max-w-130 text-base leading-relaxed text-on-surface-variant lg:text-lg',
  inlineCode: 'rounded-md bg-surface-variant px-1.5 py-0.5 font-mono text-[0.9em] text-on-surface',
  actions: 'mt-8 flex flex-wrap items-center gap-4',
  proof: 'mt-6 flex flex-col items-start gap-4',
  install:
    'rounded-lg border border-border bg-surface-variant px-3.5 py-2 font-mono text-[0.8125rem] leading-none text-on-surface',
  proofList: 'flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-on-surface-variant',
  proofItem: 'inline-flex items-center gap-1.5',
  proofDot: 'size-1 rounded-full bg-brand',
  inspector: 'w-full min-w-0 lg:max-w-[32rem] lg:justify-self-end',
};
