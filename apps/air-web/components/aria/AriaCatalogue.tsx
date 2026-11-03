import { For, Link, template } from '@airlib/react';
import { ariaIndexRoute } from '../../pages/(docs)/aria/route.js';

type Group = { title: string; slugs: [string, string][] };

export const AriaCatalogue = template(() => {
  return (
    <section id="patterns" className="air-feature-section scroll-mt-20" aria-labelledby="aria-catalogue-heading">
      <div className="air-section-inner py-12 lg:py-20">
        <div className={classes.copy}>
          <span className="air-feature-eyebrow">The catalogue</span>
          <h2 id="aria-catalogue-heading" className="air-feature-title">
            Every pattern, one factory
          </h2>
          <p className="air-feature-body">
            Fifty-four documented patterns, each one a controller you point at your own markup. Pick a name to read its
            contract, its keys, and its live demo.
          </p>
        </div>

        <div className={classes.grid}>
          <CatalogueGroup title="Atomic widgets" slugs={ATOMIC} />
          <CatalogueGroup title="Composites" slugs={COMPOSITES} />

          <div className={classes.stack}>
            <CatalogueGroup title="Landmarks" slugs={LANDMARKS} />
            <CatalogueGroup title="Live regions" slugs={LIVE} />
          </div>
        </div>

        <div className={classes.helper}>
          <div className="flex flex-col gap-1.5">
            <h3 className="air-card-title">Not sure where to start?</h3>
            <p className="air-card-body max-w-2xl">
              The overview walks through the props-in, attributes-out contract in one sitting, then hands you the
              pattern that matches your interface.
            </p>
          </div>
          <Link to={ariaIndexRoute} className="air-feature-more mt-0 shrink-0">
            Read the guide &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}, 'AriaCatalogue');

const CatalogueGroup = template<Group>(
  ({ title, slugs }) => (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
        <span className="font-mono text-xs text-on-surface-variant">{slugs.length}</span>
      </div>
      <div className="alp-pill-row">
        <For each={() => slugs}>
          {([name, slug]) => (
            <Link key={slug} href={`/docs/aria/${slug}`} className="alp-pill">
              {name}
            </Link>
          )}
        </For>
      </div>
    </div>
  ),
  'CatalogueGroup'
);

const ATOMIC: [string, string][] = [
  ['Button', 'button'],
  ['Checkbox', 'checkbox'],
  ['Disclosure', 'disclosure'],
  ['Divider', 'divider'],
  ['File Picker', 'file-picker'],
  ['Image', 'image'],
  ['Link', 'link'],
  ['Meter', 'meter'],
  ['Number Stepper', 'number-stepper'],
  ['Option', 'option'],
  ['Progress', 'progress'],
  ['Radio', 'radio'],
  ['Search Input', 'search-input'],
  ['Slider', 'slider'],
  ['Splitter', 'splitter'],
  ['Stepper', 'stepper'],
  ['Switch', 'switch'],
  ['Text Input', 'text-input'],
];

const COMPOSITES: [string, string][] = [
  ['Accordion', 'accordion'],
  ['Breadcrumb', 'breadcrumb'],
  ['Carousel', 'carousel'],
  ['Checkbox Group', 'checkbox-group'],
  ['Code Input', 'code-input'],
  ['Combobox', 'combobox'],
  ['Confirm', 'confirm'],
  ['Context Menu', 'context-menu'],
  ['Date Picker', 'date-picker'],
  ['Date Range Picker', 'date-range-picker'],
  ['Dialog', 'dialog'],
  ['Feed', 'feed'],
  ['Field', 'field'],
  ['Grid', 'grid'],
  ['Listbox', 'listbox'],
  ['Menu', 'menu'],
  ['Pagination', 'pagination'],
  ['Popover', 'popover'],
  ['Radio Group', 'radio-group'],
  ['Reorder', 'reorder'],
  ['Select', 'select'],
  ['Tabs', 'tabs'],
  ['Toast', 'toast'],
  ['Toggle Group', 'toggle-group'],
  ['Toolbar', 'toolbar'],
  ['Tooltip', 'tooltip'],
  ['Tree', 'tree'],
];

const LANDMARKS: [string, string][] = [
  ['Footer', 'footer'],
  ['Form', 'form'],
  ['Header', 'header'],
  ['Main', 'main'],
  ['Navigation', 'navigation'],
  ['Search', 'search'],
  ['Section', 'section'],
  ['Sidebar', 'sidebar'],
];

const LIVE: [string, string][] = [['Announcer', 'announcer']];

const classes = {
  copy: 'max-w-2xl',
  grid: 'mt-10 grid gap-10 lg:mt-12 lg:grid-cols-[1.05fr_1.5fr_1fr] lg:gap-12',
  stack: 'flex flex-col gap-8',
  helper: 'air-card mt-12 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between lg:mt-14',
};
