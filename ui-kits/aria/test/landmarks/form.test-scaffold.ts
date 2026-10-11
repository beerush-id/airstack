import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type FormLandmarkProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Form Landmark - Landmark Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Accessible Name Conditional Landmark Invariant', () => {
    it('compiles no role until the form is named, and withdraws it when the name goes', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<FormLandmarkProps>({});
          const form = aria('form', props);
          const el = bind(document.createElement('form'), form);
          document.body.appendChild(el);

          // An unnamed form is a structural container, not a landmark
          expect(form.attributes.role).toBeUndefined();
          expect(el.hasAttribute('role')).toBe(false);
          expect(el.hasAttribute('aria-label')).toBe(false);

          props.label = 'Shipping address';
          expect(form.attributes.role).toBe('form');
          expect(el.getAttribute('role')).toBe('form');
          expect(el.getAttribute('aria-label')).toBe('Shipping address');

          props.label = undefined;
          expect(form.attributes.role).toBeUndefined();
          expect(el.hasAttribute('role')).toBe(false);
          expect(el.hasAttribute('aria-label')).toBe(false);

          form.destroy();
          el.remove();
        });
      }));

    it('promotes the landmark through a referenced heading as readily as a string', () =>
      scope.run(() => {
        component().run(() => {
          const legend = document.createElement('h2');
          legend.id = 'checkout-heading';
          legend.textContent = 'Checkout';
          document.body.appendChild(legend);

          const props = mutable<FormLandmarkProps>({ labelledby: 'checkout-heading' });
          const form = aria('form', props);
          const el = bind(document.createElement('form'), form);
          document.body.appendChild(el);

          expect(el.getAttribute('role')).toBe('form');
          expect(el.getAttribute('aria-labelledby')).toBe('checkout-heading');
          expect(el.hasAttribute('aria-label')).toBe(false);

          // Losing the reference demotes the landmark again
          props.labelledby = undefined;
          expect(el.hasAttribute('role')).toBe(false);
          expect(el.hasAttribute('aria-labelledby')).toBe(false);

          form.destroy();
          el.remove();
          legend.remove();
        });
      }));
  });

  describe('Form Context & Host Parity Invariant', () => {
    it('stays out of the field and form mechanics it does not own', () =>
      scope.run(() => {
        component().run(() => {
          const form = aria('form', { label: 'Filters' });
          const el = bind(document.createElement('form'), form);
          document.body.appendChild(el);

          // The landmark controller compiles no form attributes of its own
          expect(el.hasAttribute('action')).toBe(false);
          expect(el.hasAttribute('method')).toBe(false);
          expect(el.hasAttribute('name')).toBe(false);
          expect(form.attributes.enctype).toBeUndefined();
          expect(form.attributes.novalidate).toBeUndefined();

          // A control placed inside the landmark keeps its own identity
          const search = aria('text-input', { kind: 'search', value: '' });
          const searchEl = bind(document.createElement('input'), search);
          searchEl.name = 'q';
          el.appendChild(searchEl);

          searchEl.value = 'anchors';
          searchEl.dispatchEvent(new Event('input', { bubbles: true }));
          expect(search.value).toBe('anchors');
          expect(new FormData(el).get('q')).toBe('anchors');

          // The landmark never intercepts the form's own submission
          const submit = new Event('submit', { bubbles: true, cancelable: true });
          el.dispatchEvent(submit);
          expect(submit.defaultPrevented).toBe(false);

          form.destroy();
          search.destroy();
          el.remove();
        });
      }));

    it('keeps the name on the landmark and off the element it labels', () =>
      scope.run(() => {
        component().run(() => {
          const form = aria('form', { label: 'Preferences' });
          const el = bind(document.createElement('form'), form);
          document.body.appendChild(el);

          expect(el.getAttribute('aria-label')).toBe('Preferences');
          expect(el.hasAttribute('title')).toBe(false);
          expect(el.getAttribute('name')).toBe('');

          // Naming the landmark does not make it focusable or operable
          expect(el.hasAttribute('tabindex')).toBe(false);

          const click = new MouseEvent('click', { bubbles: true, cancelable: true });
          el.dispatchEvent(click);
          expect(click.defaultPrevented).toBe(false);

          form.destroy();
          el.remove();
        });
      }));
  });
});
