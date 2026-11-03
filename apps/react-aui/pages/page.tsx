import { Head, Link, page } from '@airlib/react';
import ThemeChat from '@/components/theme-chat.mdx';
import { Showcase } from '@/components/Showcase.js';
import { docsDynamicRoute, docsGettingStartedRoute, docsIndexRoute, docsThemingRoute } from './docs/route.js';
import { rootIndexRoute } from './route.js';

const PRIMARY_CTA = 'aui-control aui-control-lg aui-control-primary aui-button aui-button-lg aui-button-primary';
const SECONDARY_CTA =
  'aui-control aui-control-lg aui-control-primary aui-control-tonal aui-button aui-button-lg aui-button-primary aui-button-tonal';

const PILLARS = [
  {
    eyebrow: 'Accessible',
    title: 'Accessible by default',
    body: 'Roles, focus, keyboard travel and screen-reader announcements ship inside every component. Nobody on your team writes an aria- attribute again.',
  },
  {
    eyebrow: 'From data',
    title: 'UI from data',
    body: 'Hand a component its options, items or messages and it renders the trigger, the popup and every row — whether a person wrote the data or an agent did.',
  },
  {
    eyebrow: 'One language',
    title: 'One design language',
    body: 'Six sizes, five variants, seven colors — the same words on every component. Set them once and every part inside follows.',
  },
  {
    eyebrow: 'Themes',
    title: 'Themes from one color',
    body: 'Light and dark from a single seed color, glass included. Every token is plain CSS you can override.',
  },
  {
    eyebrow: 'Parts',
    title: 'Parts when you need them',
    body: 'Swap a row, a trigger or a chip for your own, or build from the parts. The behavior comes along either way.',
  },
  {
    eyebrow: 'Headless',
    title: 'Works without the stylesheet',
    body: 'Drop the CSS and every control is still correct and operable, so your own design system can take over whenever you want.',
  },
];

export default page(rootIndexRoute).render(() => {
  return (
    <>
      <Head
        meta={{
          title: 'Data-Driven, Embeddable UI for Agents',
          description:
            'React AUI lets your agent answer with real, accessible screens inside your product, drawn by your design system and bound to your app state — and builds the rest of your app with the same components.',
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
          <span className="landing-pill">React UI kit · Accessible by default</span>
          <h1 className="landing-title">
            Data-driven, embeddable
            <br />
            UI for agents.
          </h1>
          <p className="landing-lead">
            Your agent shows instead of tells: real, working screens inside your product, on your design system and tied
            to your app's state. The same components build the rest of your app, so everything your users touch is
            accessible, by people and agents alike.
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

        <section className="landing-pillars" aria-label="What AUI gives you">
          {PILLARS.map((pillar) => (
            <article key={pillar.title} className="aui-card landing-pillar">
              <span className="landing-eyebrow">{pillar.eyebrow}</span>
              <h2>{pillar.title}</h2>
              <p>{pillar.body}</p>
            </article>
          ))}
        </section>

        <section className="landing-feature" aria-labelledby="landing-data">
          <div className="landing-feature-text">
            <span className="landing-eyebrow">UI from data</span>
            <h2 id="landing-data" className="landing-heading">
              Three-way interaction, made possible.
            </h2>
            <p>
              Instead of writing markdown and waiting for you to type an answer, your agent asks with an interface you
              can use, driving the same data your app and your agent read and write.
            </p>
            <Link to={docsDynamicRoute} className="landing-more">
              Learn UI from data →
            </Link>
          </div>
          <div className="landing-feature-demo air-mdx">
            <ThemeChat />
            <p className="landing-proof">Try it: switch the theme from the chat, then from the app.</p>
          </div>
        </section>

        <section className="landing-feature landing-feature-flip" aria-labelledby="landing-a11y">
          <div className="landing-feature-text">
            <span className="landing-eyebrow">Accessible</span>
            <h2 id="landing-a11y" className="landing-heading">
              UI that speaks and listens to anyone.
            </h2>
            <p>
              Every control tells screen readers and agents what it is, and takes input from a keyboard, a pointer, or an
              agent writing the data, with nothing for your team to add.
            </p>
            <Link to={docsGettingStartedRoute} className="landing-more">
              Get started →
            </Link>
          </div>
          <div className="landing-feature-demo">
            <Showcase />
            <p className="landing-proof">Try it: click into the form, then book the trip without touching the mouse.</p>
          </div>
        </section>

        <section className="landing-hero">
          <h2 className="landing-heading">Write the data. Ship the screen.</h2>
          <div className="landing-ctas">
            <Link to={docsGettingStartedRoute} className={PRIMARY_CTA}>
              Get started
            </Link>
            <Link to={docsThemingRoute} className={SECONDARY_CTA}>
              Make it yours
            </Link>
          </div>
        </section>
      </div>
    </>
  );
});
