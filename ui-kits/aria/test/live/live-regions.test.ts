import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type LiveRegionProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

const TUNING = [
  { label: 'advisory', props: {}, role: 'status', live: 'polite', atomic: 'true' },
  { label: 'urgent', props: { politeness: 'assertive' }, role: 'alert', live: 'assertive', atomic: 'true' },
  { label: 'stream', props: { atomic: false }, role: 'status', live: 'polite', atomic: 'false' },
  { label: 'silent', props: { politeness: 'off' }, role: 'status', live: 'off', atomic: 'true' },
] as const;

describe('Live Regions - Overview Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Reactive Dynamic Mutation Projection Invariant', () => {
    it('maps every politeness and atomicity combination onto one status region', () =>
      scope.run(() => {
        for (const tuning of TUNING) {
          component().run(() => {
            const region = aria('announcer', tuning.props as LiveRegionProps);
            const el = bind(document.createElement('div'), region);
            document.body.appendChild(el);

            // Urgency swaps the role: assertive interrupts as alert, the rest wait as status
            expect(el.getAttribute('role')).toBe(tuning.role);
            expect(el.getAttribute('aria-live')).toBe(tuning.live);
            expect(el.getAttribute('aria-atomic')).toBe(tuning.atomic);

            // A region is a region: nothing inside it is focusable or interactive
            expect(el.hasAttribute('tabindex')).toBe(false);
            expect(el.hasAttribute('aria-busy')).toBe(false);

            region.destroy();
            el.remove();
          });
        }
      }));

    it('announces what is added when the region is not atomic', () =>
      scope.run(() => {
        component().run(() => {
          const region = aria('announcer', { atomic: false });
          const el = bind(document.createElement('div'), region);
          document.body.appendChild(el);

          const first = document.createElement('p');
          first.textContent = 'Build started';
          el.appendChild(first);

          const second = document.createElement('p');
          second.textContent = 'Build passed';
          el.appendChild(second);

          // The whole history stays in the region for the reader to walk
          expect(el.textContent).toContain('Build started');
          expect(el.textContent).toContain('Build passed');
          expect(el.getAttribute('aria-atomic')).toBe('false');

          region.destroy();
          el.remove();
        });
      }));
  });

  describe('Atomic Region Synchronization Invariant', () => {
    it('replaces the announced whole when an atomic region is rewritten', () =>
      scope.run(() => {
        component().run(() => {
          const region = aria('announcer');
          const el = bind(document.createElement('div'), region);
          document.body.appendChild(el);

          el.textContent = 'Saving draft';
          expect(el.textContent).toBe('Saving draft');
          expect(el.getAttribute('aria-atomic')).toBe('true');

          el.textContent = 'Draft saved';
          expect(el.textContent).toBe('Draft saved');
          expect(el.textContent).not.toContain('Saving');

          region.destroy();
          el.remove();
        });
      }));

    it('keeps a counter region present but silent', () =>
      scope.run(() => {
        component().run(() => {
          const region = aria('announcer', { politeness: 'off' });
          const el = bind(document.createElement('time'), region);
          document.body.appendChild(el);
          el.dateTime = '2026-09-26T10:00:00Z';

          expect(el.getAttribute('role')).toBe('status');
          expect(el.getAttribute('aria-live')).toBe('off');

          for (let tick = 0; tick < 3; tick += 1) {
            el.textContent = `${tick}s`;
            expect(el.getAttribute('aria-live')).toBe('off');
            expect(el.hasAttribute('aria-valuenow')).toBe(false);
          }

          expect(el.textContent).toBe('2s');

          region.destroy();
          el.remove();
        });
      }));

    it('narrows what a region reports through the relevant token list', () =>
      scope.run(() => {
        component().run(() => {
          const additions = aria('announcer', { relevant: 'additions' });
          const additionsEl = bind(document.createElement('div'), additions);

          const removals = aria('announcer', { relevant: 'additions removals' });
          const removalsEl = bind(document.createElement('div'), removals);

          const all = aria('announcer', { relevant: 'all' });
          const allEl = bind(document.createElement('div'), all);

          document.body.append(additionsEl, removalsEl, allEl);

          expect(additionsEl.getAttribute('aria-relevant')).toBe('additions');
          expect(removalsEl.getAttribute('aria-relevant')).toBe('additions removals');
          expect(allEl.getAttribute('aria-relevant')).toBe('all');

          additions.destroy();
          removals.destroy();
          all.destroy();
          additionsEl.remove();
          removalsEl.remove();
          allEl.remove();
        });
      }));
  });
});
