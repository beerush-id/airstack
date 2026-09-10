import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, TextInputAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('TextInput - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Value Ownership Contract', () => {
    it('follows SSR -> Mount -> Interaction lifecycle for live value sync', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria('text-input', { value: 'hi' });

          // 1. SSR Phase: public spread carries defaultValue, never value or handlers
          expect(input.current).toBeNull();
          expect(input.value).toBe('hi');
          expect(input.attributes.defaultValue).toBe('hi');
          expect((input.attributes as Record<string, unknown>).value).toBeUndefined();
          expect((input.attributes as Record<string, unknown>).oninput).toBeUndefined();

          // 2. Mount Phase: element binds with the default value
          const el = bind(document.createElement('input'), input);
          expect(input.current).toBe(el);
          expect(el.getAttribute('value')).toBe('hi');

          // 3. Interaction Phase: typing flows into props
          el.value = 'hello';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(input.value).toBe('hello');

          // 4. Programmatic Phase: setting updates props and default
          input.value = 'yo';
          expect(input.value).toBe('yo');
          expect(el.getAttribute('value')).toBe('yo');
        });
      }));
  });

  describe('Search-Input Face Contract', () => {
    it('defaults role to text-input on direct construction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = new TextInputAria({ value: 'direct' });
          expect(input.value).toBe('direct');
          expect((input.attributes as Record<string, unknown>).type).toBeUndefined();
        });
      }));

    it('locks role to search-input with native search type', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const search = aria('search-input', { value: 'q' });

          expect(search.current).toBeNull();
          expect((search.attributes as Record<string, unknown>).type).toBe('search');
          expect(search.attributes.defaultValue).toBe('q');

          const el = bind(document.createElement('input'), search);
          expect(el.value).toBe('q');
        });
      }));
  });

  describe('State Compilation Contract', () => {
    it('compiles readonly, disabled, required, and invalid projections', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria('text-input', {
            readonly: true,
            disabled: true,
            required: true,
            invalid: 'grammar',
            placeholder: 'Name',
            label: 'Full name',
          });

          expect(input.attributes.readonly).toBe(true);
          expect(input.attributes.disabled).toBe(true);
          expect(input.attributes.required).toBe(true);
          expect(input.attributes['aria-invalid']).toBe('grammar');
          expect(input.attributes.placeholder).toBe('Name');
          expect(input.attributes['aria-label']).toBe('Full name');

          const el = bind(document.createElement('input'), input);
          expect(el.readOnly).toBe(true);
          expect(el.disabled).toBe(true);
        });
      }));

    it('emits explicit aria-invalid false by default', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria('text-input');
          expect(input.attributes['aria-invalid']).toBe('false');
        });
      }));

    it('maps invalid true and false variants explicitly', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          expect(aria('text-input', { invalid: true }).attributes['aria-invalid']).toBe('true');
          expect(aria('text-input', { invalid: false }).attributes['aria-invalid']).toBe('false');
        });
      }));

    it('omits optional keys by default', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria('text-input');
          expect(input.value).toBe('');
          expect(aria('text-input', { value: null as never }).value).toBe('');
          expect(input.attributes.readonly).toBe(false);
          expect(input.attributes.disabled).toBe(false);
          expect(input.attributes.required).toBe(false);
          expect(input.attributes.placeholder).toBeUndefined();
          expect(input.attributes['aria-label']).toBeUndefined();
          expect((input.attributes as Record<string, unknown>).type).toBeUndefined();
        });
      }));
  });

  describe('Disabled Guard Contract', () => {
    it('ignores input events while disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria('text-input', { value: 'hi', disabled: true });
          const el = bind(document.createElement('input'), input);

          el.value = 'blocked';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(input.value).toBe('hi');
        });
      }));
  });

  describe('Refiner Shielding Contract', () => {
    it('ignores refiner overrides of owned value and state keys', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria('text-input', { value: 'hi' });
          const unrefine = input.refine(() => ({ value: 'hacked', disabled: true }) as never);

          expect(input.value).toBe('hi');
          expect(input.attributes.defaultValue).toBe('hi');

          unrefine();
          expect(input.value).toBe('hi');
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('cleans up element bindings on destroy', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria('text-input', { value: 'hi' });
          const el = bind(document.createElement('input'), input);

          expect(input.current).toBe(el);

          input.destroy();
          expect(input.current).toBeNull();
        });
      }));

    it('detaches cleanly on ref(null)', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria('text-input');
          const el = bind(document.createElement('input'), input);

          expect(input.current).toBe(el);
          input.ref(null);
          expect(input.current).toBeNull();
        });
      }));
  });
});
