import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, TextInputAria, type TextInputEvent } from '../../src/index.js';
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

  describe('Value Synchronization & Commit Invariant', () => {
    it('passes the browser input and change events through a native host without adding any', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria('text-input', { value: 'hi' });
          const el = bind(document.createElement('input'), input);

          const commits: string[] = [];
          el.addEventListener('change', () => commits.push(input.value));

          // Typing keeps props and the live node in step
          el.value = 'hello';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(input.value).toBe('hello');
          expect(el.value).toBe('hello');

          // The browser's own commit event arrives once, carrying the synced value
          el.dispatchEvent(new Event('change', { bubbles: true }));
          expect(commits).toEqual(['hello']);

          el.dispatchEvent(new Event('change', { bubbles: true }));
          expect(commits).toEqual(['hello', 'hello']);

          // 6. Teardown
          input.destroy();
          expect(input.current).toBeNull();
        });
      }));

    it('announces a bubbling change CustomEvent carrying the committed value on a custom host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria<HTMLDivElement>('text-input', { value: '' }, { native: false });
          const el = bind(document.createElement('div'), input);

          const commits: Array<{ detail: unknown; bubbles: boolean; kind: string }> = [];
          el.addEventListener('change', (event) => {
            commits.push({
              detail: (event as CustomEvent).detail,
              bubbles: event.bubbles,
              kind: event.constructor.name,
            });
          });

          // A value that moved is committed when the host loses focus
          input.assign({ value: 'abc' });
          el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

          expect(commits).toHaveLength(1);
          expect(commits[0].detail).toBe('abc');
          expect(commits[0].bubbles).toBe(true);
          expect(commits[0].kind).toBe('CustomEvent');

          // Losing focus again with nothing changed produces no second commit
          el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(commits).toHaveLength(1);

          // One diff, one announcement
          input.assign({ value: 'abcdef' });
          el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(commits).toHaveLength(2);
          expect(commits[1].detail).toBe('abcdef');

          input.destroy();
          expect(input.current).toBeNull();
        });
      }));

    it('withholds commits from a disabled custom host and restores them on release', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria<HTMLDivElement>('text-input', { value: 'locked', disabled: true }, { native: false });
          const el = bind(document.createElement('div'), input);

          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');
          expect(el.getAttribute('role')).toBe('textbox');

          const commits: Array<unknown> = [];
          el.addEventListener('change', (event) => commits.push((event as TextInputEvent).detail));

          input.assign({ value: 'edited while disabled' });
          el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

          expect(commits).toEqual([]);

          // Releasing the guard restores the commit path on the same node
          input.assign({ disabled: false, value: 'free text' });
          expect(el.getAttribute('aria-disabled')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('0');

          el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(commits).toEqual(['free text']);

          input.destroy();
          expect(input.current).toBeNull();
        });
      }));
  });

  describe('Host Parity & Form Boundary Invariant', () => {
    it('submits the live text through the author-bound field name, never through the projection', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const form = document.createElement('form');
          document.body.appendChild(form);

          const input = aria('text-input', { value: 'draft' });

          expect(input.attributes.name).toBeUndefined();
          expect((input.attributes as Record<string, unknown>).value).toBeUndefined();
          expect(input.attributes.form).toBeUndefined();
          expect(input.attributes.defaultValue).toBe('draft');

          const el = bind(document.createElement('input'), input);
          el.name = 'notes';
          form.appendChild(el);

          expect(new FormData(form).get('notes')).toBe('draft');

          // Typing is what the field submits, not the compiled snapshot
          el.value = 'final draft';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(input.value).toBe('final draft');
          expect(new FormData(form).get('notes')).toBe('final draft');

          input.destroy();
          document.body.removeChild(form);
          expect(input.current).toBeNull();
        });
      }));

    it('takes the multiline signal from the textarea element instead of compiling one', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const input = aria<HTMLTextAreaElement>(
            'text-input',
            { value: 'one line', multiline: true },
            { native: true }
          );

          // A native host never takes a compiled role, whatever the flags say
          expect(input.attributes.role).toBeUndefined();

          const el = bind(document.createElement('textarea'), input);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.value).toBe('one line');

          // Text stays in sync on a multiline host
          el.value = 'two lines';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(input.value).toBe('two lines');

          input.destroy();
          expect(input.current).toBeNull();
        });
      }));
  });

  describe('Semantic Role Specialization Invariant', () => {
    it('specializes the custom role only for search and carries every other kind as text', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const plain = aria<HTMLDivElement>('text-input', { kind: 'text' }, { native: false });
          const password = aria<HTMLDivElement>('text-input', { kind: 'password' }, { native: false });
          const email = aria<HTMLDivElement>('text-input', { kind: 'email' }, { native: false });
          const search = aria<HTMLDivElement>('text-input', { kind: 'search' }, { native: false });

          expect(plain.attributes.role).toBe('textbox');
          expect(password.attributes.role).toBe('textbox');
          expect(email.attributes.role).toBe('textbox');
          expect(search.attributes.role).toBe('searchbox');

          const searchEl = bind(document.createElement('div'), search);
          expect(searchEl.getAttribute('role')).toBe('searchbox');
          expect(searchEl.getAttribute('tabindex')).toBe('0');

          // Multiline is announced only where the host cannot show it
          const single = aria<HTMLDivElement>('text-input', {}, { native: false });
          const multi = aria<HTMLDivElement>('text-input', { multiline: true }, { native: false });

          expect(single.attributes['aria-multiline']).toBeUndefined();
          expect(multi.attributes['aria-multiline']).toBe('true');

          const multiEl = bind(document.createElement('div'), multi);
          expect(multiEl.getAttribute('aria-multiline')).toBe('true');
          expect(multiEl.getAttribute('role')).toBe('textbox');

          plain.destroy();
          password.destroy();
          email.destroy();
          search.destroy();
          single.destroy();
          multi.destroy();
        });
      }));

    it('maps the same validation state to native properties and ARIA states by host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const states = {
            value: '',
            readonly: true,
            disabled: true,
            required: true,
            invalid: 'grammar' as const,
            label: 'Full name',
          };

          const nativeInput = aria('text-input', states, { native: true });
          const customInput = aria<HTMLDivElement>('text-input', states, { native: false });

          // Accessible name and validity are ARIA on both hosts
          expect(nativeInput.attributes['aria-label']).toBe('Full name');
          expect(customInput.attributes['aria-label']).toBe('Full name');
          expect(nativeInput.attributes['aria-invalid']).toBe('grammar');
          expect(customInput.attributes['aria-invalid']).toBe('grammar');

          const el = bind(document.createElement('input'), nativeInput);
          const div = bind(document.createElement('div'), customInput);

          expect(el.readOnly).toBe(true);
          expect(el.disabled).toBe(true);
          expect(el.required).toBe(true);

          // The native host is not given the custom role even when flags are set
          expect(el.hasAttribute('role')).toBe(false);
          expect(el.hasAttribute('aria-readonly')).toBe(false);
          expect(el.hasAttribute('aria-required')).toBe(false);

          // A custom host has no properties to hold them, so every flag becomes ARIA
          expect(div.getAttribute('aria-readonly')).toBe('true');
          expect(div.getAttribute('aria-disabled')).toBe('true');
          expect(div.getAttribute('aria-required')).toBe('true');
          expect(div.getAttribute('tabindex')).toBe('-1');

          nativeInput.destroy();
          customInput.destroy();
          expect(nativeInput.current).toBeNull();
          expect(customInput.current).toBeNull();
        });
      }));
  });
});
