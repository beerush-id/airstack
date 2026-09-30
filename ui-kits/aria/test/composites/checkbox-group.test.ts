import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type CheckboxGroupItemAria, type CheckboxGroupProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

type Item = { value: string; item: CheckboxGroupItemAria; el: HTMLElement };

function buildGroup(
  props: Partial<CheckboxGroupProps>,
  values: string[],
  host: 'native' | 'custom' = 'native',
) {
  const group = aria('checkbox-group', { label: 'Notifications', ...props } as CheckboxGroupProps);
  const groupEl = bind(document.createElement(host === 'native' ? 'fieldset' : 'div'), group);
  document.body.appendChild(groupEl);

  const items: Item[] = values.map((value) => {
    const item =
      host === 'native'
        ? aria('checkbox-group-item', { value })
        : aria<HTMLDivElement>('checkbox-group-item', { value }, { native: false });

    const el = bind(document.createElement(host === 'native' ? 'input' : 'div'), item);
    groupEl.appendChild(el);
    return { value, item, el };
  });

  const cleanup = () => {
    for (const { item } of items) {
      item.destroy();
    }

    group.destroy();
    groupEl.remove();
  };

  return { group, groupEl, items, cleanup };
}

function checked(el: HTMLElement): boolean {
  return (el as HTMLInputElement).checked;
}

describe('CheckboxGroup - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Multi-State Coordination & Set Registry Invariant', () => {
    it('toggles membership in the shared set and re-derives every item from an external write', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CheckboxGroupProps>({ value: ['email'] });
          const { items, cleanup } = buildGroup(props, ['email', 'sms', 'push']);

          const [email, sms, push] = items;
          expect(email.item.checked).toBe(true);
          expect(sms.item.checked).toBe(false);
          expect(checked(email.el)).toBe(true);

          // Activating an item adds its token and leaves the others alone
          sms.el.click();
          expect(props.value).toEqual(['email', 'sms']);
          expect(checked(sms.el)).toBe(true);

          // Activating it again removes only its own token
          sms.el.click();
          expect(props.value).toEqual(['email']);
          expect(checked(email.el)).toBe(true);

          // An external registry write reaches every member at once
          props.value = ['push'];
          expect(checked(email.el)).toBe(false);
          expect(checked(sms.el)).toBe(false);
          expect(checked(push.el)).toBe(true);

          // A member click on a token the group already holds releases it
          push.el.click();
          expect(props.value).toEqual([]);
          expect(checked(push.el)).toBe(false);

          cleanup();
        });
      }));

    it('announces the whole set through a bubbling change event on the container', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CheckboxGroupProps>({ value: [] });
          const { groupEl, items, cleanup } = buildGroup(props, ['a', 'b']);

          const commits: Array<{ detail: unknown; bubbles: boolean; kind: string }> = [];
          groupEl.addEventListener('change', (event) =>
            commits.push({
              detail: (event as CustomEvent).detail,
              bubbles: event.bubbles,
              kind: event.constructor.name,
            }),
          );

          items[0].el.click();
          items[1].el.click();
          items[0].el.click();

          expect(commits.map((entry) => entry.detail)).toEqual([['a'], ['a', 'b'], ['b']]);
          expect(commits[0].bubbles).toBe(true);
          expect(commits[0].kind).toBe('CustomEvent');

          // An external write is not an announcement: nobody acted
          props.value = ['a', 'b'];
          expect(commits).toHaveLength(3);

          cleanup();
        });
      }));

    it('carries the same set through aria-checked on a custom host', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CheckboxGroupProps>({ value: ['one'] });
          const { items, cleanup } = buildGroup(props, ['one', 'two'], 'custom');

          expect(items[0].el.getAttribute('role')).toBe('checkbox');
          expect(items[0].el.getAttribute('aria-checked')).toBe('true');
          expect(items[1].el.getAttribute('aria-checked')).toBe('false');

          items[1].el.click();
          expect(props.value).toEqual(['one', 'two']);
          expect(items[1].el.getAttribute('aria-checked')).toBe('true');

          cleanup();
        });
      }));
  });

  describe('Independent Focus Navigation Invariant', () => {
    it('keeps every enabled member on its own tab stop and claims no arrow key', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CheckboxGroupProps>({ value: ['one'] });
          const { groupEl, items, cleanup } = buildGroup(props, ['one', 'two', 'three'], 'custom');

          // Independent stops, not a roving single stop
          for (const { el } of items) {
            expect(el.getAttribute('tabindex')).toBe('0');
          }

          items[0].el.focus();
          expect(document.activeElement).toBe(items[0].el);

          // The group owns no arrow traversal, so nothing moves and nothing toggles
          for (const key of ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End']) {
            const event = new KeyboardEvent('keydown', {
              key,
              bubbles: true,
              cancelable: true,
            });
            groupEl.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          expect(document.activeElement).toBe(items[0].el);
          expect(props.value).toEqual(['one']);

          // Reaching the next member is the browser's tab order, not a rover
          items[1].el.focus();
          expect(document.activeElement).toBe(items[1].el);

          cleanup();
        });
      }));

    it('removes each tab stop when the group is disabled and hands them back on release', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CheckboxGroupProps>({ value: [], disabled: false });
          const { groupEl, items, cleanup } = buildGroup(props, ['one', 'two'], 'custom');

          items[0].item.assign({ disabled: true });
          expect(items[0].el.getAttribute('aria-disabled')).toBe('true');
          expect(items[1].el.getAttribute('tabindex')).toBe('0');

          items[0].el.click();
          expect(props.value).toEqual([]);

          props.disabled = true;
          expect(groupEl.getAttribute('aria-disabled')).toBe('true');
          for (const { el } of items) {
            expect(el.getAttribute('aria-disabled')).toBe('true');
            expect(el.getAttribute('tabindex')).toBe('-1');
          }

          items[1].el.click();
          expect(props.value).toEqual([]);

          props.disabled = false;
          expect(items[1].el.getAttribute('tabindex')).toBe('0');

          items[1].item.assign({ disabled: false });
          items[1].el.click();
          expect(props.value).toEqual(['two']);

          cleanup();
        });
      }));
  });

  describe('Form Boundary & Group Association Invariant', () => {
    it('leaves the grouping role to a native fieldset and compiles it for a div', () =>
      scope.run(() => {
        component().run(() => {
          const native = buildGroup({ value: [] }, ['a']);
          expect(native.groupEl.getAttribute('role')).toBeNull();
          expect(native.group.attributes.role).toBeUndefined();
          expect(native.groupEl.getAttribute('aria-label')).toBe('Notifications');
          native.cleanup();

          const custom = aria('checkbox-group', { value: [] });
          const customEl = bind(document.createElement('div'), custom);
          document.body.appendChild(customEl);

          expect(customEl.getAttribute('role')).toBe('group');
          expect(customEl.getAttribute('aria-label')).toBeNull();

          custom.destroy();
          customEl.remove();
        });
      }));

    it('submits every checked value under the field name the author binds', () =>
      scope.run(() => {
        component().run(() => {
          const form = document.createElement('form');
          document.body.appendChild(form);

          const props = mutable<CheckboxGroupProps>({ value: ['digest'] });
          const { groupEl, items, cleanup } = buildGroup(props, ['digest', 'alerts']);

          form.appendChild(groupEl);

          for (const { value, item, el } of items) {
            // The projection carries no form identity, so the template author binds it
            expect(item.attributes.name).toBeUndefined();
            expect(item.attributes.value).toBeUndefined();

            (el as HTMLInputElement).name = 'topics';
            (el as HTMLInputElement).value = value;
          }

          expect(new FormData(form).getAll('topics')).toEqual(['digest']);

          items[1].el.click();
          expect(new FormData(form).getAll('topics')).toEqual(['digest', 'alerts']);

          items[0].el.click();
          expect(new FormData(form).getAll('topics')).toEqual(['alerts']);

          cleanup();
          form.remove();
        });
      }));
  });
});
