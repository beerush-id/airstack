import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { type Aria as AriaBase, aria, type BaseElement, roverCtx, type ToggleGroupProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('ToggleGroup - Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Identity & Refiner Shielding Invariant', () => {
    it('honors a declared id and namespaces its members, falling back to a generated one', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('toggle-group', { id: 'formats', value: 'bold' });
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);
          const bold = aria('toggle', { value: 'bold' });
          const boldEl = bind(document.createElement('button'), bold);
          groupEl.appendChild(boldEl);

          expect(groupEl.getAttribute('id')).toBe('formats');
          expect(boldEl.getAttribute('id')).toBe('formats-button-bold');
          bold.destroy();
          group.destroy();
          groupEl.remove();
        });

        component().run(() => {
          const generated = aria('toggle-group', { value: 'a' });
          expect(generated.attributes.id).toMatch(/^togglegroup-\d+$/);
          generated.destroy();
        });
      }));

    it('refuses a refiner that tries to override the group state or its namespace', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('toggle-group', { id: 'sizes', value: 'sm', disabled: false });
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          group.refine(() => ({ 'aria-disabled': 'true', id: 'hijacked' }));

          expect(group.attributes.role).toBe('group');
          expect(group.attributes['aria-disabled']).toBe('false');
          expect(groupEl.getAttribute('role')).toBe('group');
          expect(groupEl.getAttribute('aria-disabled')).toBe('false');
          expect(groupEl.getAttribute('id')).toBe('sizes');

          group.destroy();
          groupEl.remove();
        });
      }));

    it('keeps the value plane and consumed inputs out of the projection', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('toggle-group', {
            multiple: true,
            value: ['a'],
            onchange: () => undefined,
          });

          expect(group.attributes.value).toBeUndefined();
          expect(group.attributes.multiple).toBeUndefined();
          expect(group.attributes.onchange).toBeUndefined();
          expect(group.attributes.onkeydown).toBeUndefined();
          group.destroy();
        });
      }));

    it('compiles an untouched group when the author passes no props at all', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('toggle-group');

          expect(group.attributes.role).toBe('group');
          expect(group.attributes['aria-disabled']).toBe('false');
          expect(group.attributes.value).toBeUndefined();
          expect(group.attributes['aria-orientation']).toBeUndefined();
          expect(group.disabled).toBe(false);

          group.destroy();
        });
      }));
  });

  describe('Server-Side Projection Invariant', () => {
    it('projects the whole group before a single element exists', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: undefined });
          const group = aria('toggle-group', props);
          const one = aria('toggle', { value: 'one' });
          const two = aria('toggle', { value: 'two' });

          expect(group.attributes.role).toBe('group');
          expect(group.attributes['aria-disabled']).toBe('false');
          expect(one.attributes['aria-pressed']).toBe('false');
          expect(one.attributes.tabindex).toBe(-1);
          expect(two.attributes.tabindex).toBe(-1);

          props.value = 'two';
          expect(two.attributes['aria-pressed']).toBe('true');
          expect(two.attributes.tabindex).toBe(0);
          expect(one.attributes.tabindex).toBe(-1);

          one.destroy();
          two.destroy();
          group.destroy();
        });
      }));
  });

  describe('Tab Stop Resolution Invariant', () => {
    it('holds no member stop while a multiple group has an empty set and seats the token it gains', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ multiple: true, value: [] });
          const group = aria('toggle-group', props);
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          const a = aria<HTMLDivElement>('toggle', { value: 'a', disabled: true }, { native: false });
          const b = aria<HTMLDivElement>('toggle', { value: 'b' }, { native: false });
          const aEl = bind(document.createElement('div'), a);
          const bEl = bind(document.createElement('div'), b);
          groupEl.append(aEl, bEl);

          expect(aEl.getAttribute('tabindex')).toBe('-1');
          expect(bEl.getAttribute('tabindex')).toBe('-1');

          b.toggle();
          expect(props.value).toEqual(['b']);
          expect(bEl.getAttribute('tabindex')).toBe('0');
          expect(aEl.getAttribute('tabindex')).toBe('-1');

          b.toggle();
          expect(props.value).toEqual([]);
          expect(bEl.getAttribute('tabindex')).toBe('-1');

          a.destroy();
          b.destroy();
          group.destroy();
          groupEl.remove();
        });
      }));

    it('derives the member stop from group state alone even when its element sits outside the container', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: undefined });
          const group = aria('toggle-group', props);
          const stray = aria<HTMLDivElement>('toggle', { value: 'x' }, { native: false });
          const strayEl = bind(document.createElement('div'), stray);
          document.body.appendChild(strayEl);

          expect(strayEl.getAttribute('tabindex')).toBe('-1');
          expect(stray.pressed).toBe(false);

          strayEl.click();
          expect(props.value).toBe('x');
          expect(strayEl.getAttribute('tabindex')).toBe('0');

          stray.destroy();
          group.destroy();
          strayEl.remove();
        });
      }));

    it('shields the member tab stop from a consumer refiner', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('toggle-group', { value: 'on' });
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);
          const on = aria<HTMLDivElement>('toggle', { value: 'on' }, { native: false });
          const onEl = bind(document.createElement('div'), on);
          groupEl.appendChild(onEl);

          on.refine(() => ({ tabindex: -1 }));
          expect(onEl.getAttribute('tabindex')).toBe('0');

          on.destroy();
          group.destroy();
          groupEl.remove();
        });
      }));
  });

  describe('Traversal Yield Invariant', () => {
    it('surrenders arrow travel to an enclosing rover', () =>
      scope.run(() => {
        roverCtx.set({} as AriaBase<BaseElement>);

        component().run(() => {
          const group = aria('toggle-group', { value: 'a' });
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          const a = aria('toggle', { value: 'a' });
          const b = aria('toggle', { value: 'b' });
          const aEl = bind(document.createElement('button'), a);
          const bEl = bind(document.createElement('button'), b);
          groupEl.append(aEl, bEl);

          aEl.focus();
          for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']) {
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            groupEl.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          expect(document.activeElement).toBe(aEl);

          a.destroy();
          b.destroy();
          group.destroy();
          groupEl.remove();
        });

        roverCtx.set(undefined);
      }));

    it('claims no key when the group holds no navigable member', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('toggle-group', { value: undefined });
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          for (const key of ['ArrowRight', 'Home', 'End', 'Tab']) {
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            groupEl.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          group.destroy();
          groupEl.remove();
        });
      }));
  });

  describe('Teardown Invariant', () => {
    it('stops roving once the container is destroyed', () =>
      scope.run(() => {
        component().run(() => {
          let announced = 0;
          const group = aria('toggle-group', { value: 'a', onchange: () => announced++ });
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          const a = aria('toggle', { value: 'a' });
          const b = aria('toggle', { value: 'b' });
          const aEl = bind(document.createElement('button'), a);
          const bEl = bind(document.createElement('button'), b);
          groupEl.append(aEl, bEl);

          aEl.focus();
          bEl.click();
          expect(announced).toBe(1);
          expect(b.pressed).toBe(true);

          group.destroy();

          const right = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
          groupEl.dispatchEvent(right);
          expect(right.defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(aEl);

          bEl.click();
          expect(b.pressed).toBe(false);
          expect(announced).toBe(1);

          a.destroy();
          b.destroy();
          groupEl.remove();
        });
      }));
  });

  describe('Member Factory Invariant', () => {
    it('spawns coordinated members and keeps a valueless member local to itself', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'b', disabled: false });
          const group = aria('toggle-group', props);
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          const bound = group.toggle({ value: 'b' });
          const plain = group.toggle({}, { native: false });
          const boundEl = bind(document.createElement('button'), bound);
          const plainEl = bind(document.createElement('div'), plain);
          groupEl.append(boundEl, plainEl);

          expect(boundEl.getAttribute('aria-pressed')).toBe('true');
          expect(boundEl.getAttribute('tabindex')).toBe('0');
          expect(boundEl.getAttribute('role')).toBeNull();

          expect(plainEl.getAttribute('role')).toBe('button');
          expect(plainEl.getAttribute('tabindex')).toBe('0');

          plainEl.click();
          expect(plain.pressed).toBe(true);
          expect(props.value).toBe('b');

          props.disabled = true;
          expect(plain.disabled).toBe(true);
          expect(plainEl.getAttribute('tabindex')).toBe('-1');

          plainEl.click();
          expect(plain.pressed).toBe(true);

          props.disabled = false;
          boundEl.click();
          expect(props.value).toBeUndefined();

          bound.destroy();
          plain.destroy();
          group.destroy();
          groupEl.remove();
        });

        component().run(() => {
          const group = aria('toggle-group', { value: 'x' });
          const bare = group.toggle();

          expect(bare.pressed).toBe(false);
          expect(bare.attributes['aria-pressed']).toBe('false');

          bare.destroy();
          group.destroy();
        });
      }));
  });
});
