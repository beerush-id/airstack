import { Head, Link, page } from '@airlib/react';
import { Showcase } from '@/components/Showcase.js';
import { docsGettingStartedRoute, docsIndexRoute } from './docs/route.js';
import { rootIndexRoute } from './route.js';

const PRIMARY_CTA = 'aui-control aui-control-lg aui-control-primary aui-button aui-button-lg aui-button-primary';
const SECONDARY_CTA =
  'aui-control aui-control-lg aui-control-primary aui-control-tonal aui-button aui-button-lg aui-button-primary aui-button-tonal';

const PROMISES = [
  {
    title: 'Accessible without trying',
    body: 'Roles, focus, keyboard travel, and screen-reader announcements come with every component. You never write an aria- attribute or a key handler.',
  },
  {
    title: 'Less code per screen',
    body: 'Hand a select its options and it renders the trigger, the popup, and every row. No parts to wire, no open state to track, no ids to pass around.',
  },
  {
    title: 'One look, set once',
    body: 'Six sizes, five variants, seven colors — the same words everywhere. Set them on a component and every part inside it follows, or set a default for the whole app.',
  },
  {
    title: 'Never stuck',
    body: 'When the simple form is not enough, swap in your own row or trigger content, or build the component from its parts — the behavior comes along either way.',
  },
  {
    title: 'Themes from one color',
    body: 'Light and dark from a single seed color, every token overridable from plain CSS. No CSS-in-JS, no build plugin.',
  },
  {
    title: 'Styling stays optional',
    body: 'Without the stylesheet every component is still a correct, operable control — so your own design system can take over whenever you want.',
  },
];

export default page(rootIndexRoute).render(() => {
  return (
    <>
      <Head
        meta={{
          title: 'Accessible React Components That Already Look Finished',
          description:
            'React AUI gives you accessible, keyboard-ready React components with a complete design system. Hand a component your data and it renders the whole control — select, combobox, date picker, dialog, tabs, and more.',
          keywords: [
            'React components',
            'React component library',
            'accessible React components',
            'React UI kit',
            'ARIA',
            'WAI-ARIA',
            'design system',
            'React select',
            'React combobox',
            'React date picker',
            'React dialog',
            'AirLib',
          ],
        }}
      />
      <div className="landing">
        <section className="landing-hero">
          <span className="landing-eyebrow">React AUI</span>
          <h1 className="landing-title">Accessible components that already look finished.</h1>
          <p className="landing-lead">
            Hand a component your data and get the whole control — structure, keyboard, focus, and a polished look.
            Ship the screen, not the plumbing behind it.
          </p>
          <div className="landing-ctas">
            <Link to={docsGettingStartedRoute} className={PRIMARY_CTA}>
              Get started
            </Link>
            <Link to={docsIndexRoute} className={SECONDARY_CTA}>
              Browse components
            </Link>
          </div>
          <code className="landing-install">npm install @airlib/react-aui @airlib/aui</code>
        </section>

        <section className="landing-section" aria-label="Live demo">
          <Showcase />
        </section>

        <section className="landing-section" aria-labelledby="landing-promises">
          <h2 id="landing-promises" className="landing-heading">
            What you stop worrying about
          </h2>
          <div className="landing-cards">
            {PROMISES.map((promise) => (
              <article key={promise.title} className="aui-card landing-card">
                <h3>{promise.title}</h3>
                <p>{promise.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-hero">
          <h2 className="landing-heading">Build the screen, not the plumbing.</h2>
          <div className="landing-ctas">
            <Link to={docsGettingStartedRoute} className={PRIMARY_CTA}>
              Get started
            </Link>
          </div>
        </section>
      </div>
    </>
  );
});
