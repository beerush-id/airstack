import { For, template } from '@airlib/react';
import {
  ChecklistIcon,
  GridViewIcon,
  StateManagementIcon,
  StyleIcon,
  UserInterfaceIcon,
  WidgetsIcon,
} from '../icons.js';

export const AriaPatterns = template(() => {
  return (
    <section className="air-feature-section" aria-labelledby="aria-patterns-heading">
      <div className="air-feature-inner">
        <div className={classes.copy}>
          <span className="air-feature-eyebrow">What the controller owns</span>
          <h2 id="aria-patterns-heading" className="air-feature-title">
            One factory per pattern, one contract per element
          </h2>
          <p className="air-feature-body">
            Point a controller at your props and it returns the same props ready to spread — with every attribute, key
            binding, and focus rule that the pattern requires.
          </p>
        </div>

        <div className={classes.grid}>
          <For each={() => PATTERNS}>
            {(pattern) => (
              <div className="air-card flex gap-5">
                <pattern.icon className="size-9 shrink-0 text-brand" />
                <div className="air-card-content">
                  <span className="air-card-eyebrow">{pattern.eyebrow}</span>
                  <h3 className="air-card-title">{pattern.title}</h3>
                  <p className="air-card-body">{pattern.body}</p>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}, 'AriaPatterns');

const PATTERNS = [
  {
    eyebrow: 'Semantics',
    title: 'Roles compiled, not hand-written',
    body: 'Each controller compiles the role, aria-* states, tab order, and disabled semantics for the element you bind — and keeps them in sync as your state moves.',
    icon: ChecklistIcon,
  },
  {
    eyebrow: 'Keyboard',
    title: 'Contracts the browser will not give you',
    body: 'Arrow keys, Home and End, typeahead, Escape to dismiss, Enter and Space activation — the exact keys each WAI-ARIA pattern requires, wired once inside the controller.',
    icon: UserInterfaceIcon,
  },
  {
    eyebrow: 'Native first',
    title: 'Native hosts skip redundant ARIA',
    body: 'Bind a <button> and no role attribute is written; the browser keeps activation and form submission. Bind a <div> or an <svg> and the controller supplies what the browser will not.',
    icon: WidgetsIcon,
  },
  {
    eyebrow: 'Reactive',
    title: 'One proxy, no synchronization code',
    body: 'Hand your reactive props to the factory and the controller reads the same proxy. Mutate state in one place and every dependent attribute follows — nothing mirrored, nothing diffed.',
    icon: StateManagementIcon,
  },
  {
    eyebrow: 'Composites',
    title: 'Parts that agree with each other',
    body: 'Menus, listboxes, trees, grids, toolbars, and pickers coordinate focus, selection, and dismissal across their children, so keyboard users are never stranded between parts.',
    icon: GridViewIcon,
  },
  {
    eyebrow: 'Styling',
    title: 'Your CSS decides everything',
    body: 'No classes, no shadow DOM, no wrapper elements. State lands on your own markup as attributes you can target directly with [aria-pressed], [aria-selected], or [aria-expanded] selectors.',
    icon: StyleIcon,
  },
];

const classes = {
  copy: 'max-w-2xl',
  grid: 'mt-10 grid gap-4 md:grid-cols-2 lg:mt-12 lg:grid-cols-3',
};
