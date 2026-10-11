import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria } from '../src/index.js';
import { currentAria } from '../src/context.js';
import { bind, component } from './utils.js';

describe('Aria Core - Refiners & Rest Props', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('applies refiner overrides with their handlers and removes both on teardown', () =>
    scope.run(() => {
      const props = mutable({ disabled: false });
      const button = aria('button', props);
      const el = bind(document.createElement('button'), button);
      document.body.appendChild(el);

      const off = button.refine(() => ({
        'data-tone': props.disabled ? 'off' : 'on',
        onclick: () => undefined,
      }));

      expect(el.getAttribute('data-tone')).toBe('on');

      props.disabled = true;
      expect(el.getAttribute('data-tone')).toBe('off');

      props.disabled = false;
      expect(el.getAttribute('data-tone')).toBe('on');

      off();

      expect(el.hasAttribute('data-tone')).toBe(false);

      button.destroy();
      el.remove();
    }));

  it('keeps a refiner that returns nothing inert and skips its refresh on destroy', () =>
    scope.run(() => {
      const button = aria('button');
      const el = bind(document.createElement('button'), button);
      document.body.appendChild(el);

      const off = button.refine(() => undefined);

      expect(el.hasAttribute('data-tone')).toBe(false);

      off(true);

      expect(el.hasAttribute('data-tone')).toBe(false);

      button.destroy();
      el.remove();
    }));

  it('omits controller-owned keys from restProps on both prop shapes', () =>
    scope.run(() => {
      const reactive = aria('toggle', mutable({ pressed: true, title: 'Reactive' }));
      const fromReactive = reactive.restProps() as Record<string, unknown>;

      expect(fromReactive.title).toBe('Reactive');
      expect('pressed' in fromReactive).toBe(false);
      expect(fromReactive['aria-pressed']).toBe('true');

      reactive.destroy();

      const plain = aria('toggle', { pressed: true, title: 'Plain' });
      const fromPlain = plain.restProps() as Record<string, unknown>;

      expect(fromPlain.title).toBe('Plain');
      expect('pressed' in fromPlain).toBe(false);
      expect(fromPlain['aria-pressed']).toBe('true');

      plain.destroy();
    }));

  it('re-runs every registered refiner on a full update', () =>
    scope.run(() => {
      const props = mutable({ disabled: false });
      const button = aria('button', props);
      const el = bind(document.createElement('button'), button);
      document.body.appendChild(el);

      button.refine(() => ({ 'data-tone': props.disabled ? 'off' : 'on' }));
      button.refine(() => ({ 'data-size': 'lg' }));

      expect(el.getAttribute('data-tone')).toBe('on');
      expect(el.getAttribute('data-size')).toBe('lg');

      button.ref(document.createElement('button'));

      expect(el.getAttribute('data-tone')).toBe('on');

      button.destroy();
      el.remove();
    }));

  it('rejects an unknown role at the factory boundary', () => {
    expect(() => aria('nope' as never)).toThrow('Unsupported aria role: nope');
  });

  it('hands back a teardown from ref and detaches on a null ref', () =>
    scope.run(() => {
      const button = aria('button');
      const el = document.createElement('button');
      document.body.appendChild(el);

      const unbind = button.ref(el);

      expect(typeof unbind).toBe('function');
      expect(button.current).toBe(el);
      expect(() => unbind()).not.toThrow();

      button.ref(null);

      expect(button.current).toBeNull();

      button.destroy();
      el.remove();
    }));

  it('resolves currentAria.within against the current controller and its scope chain', () =>
    scope.run(() => {
      component().run(() => {
        const group = aria('radio-group', { name: 'size' });
        const member = aria('radio', { value: 'm' });
        const stranger = aria('button');

        currentAria.set(member as never);

        expect(currentAria.within(member as never)).toBe(true);
        expect(currentAria.within(group as never)).toBe(true);
        expect(currentAria.within(stranger as never)).toBe(false);

        currentAria.set(undefined);

        expect(currentAria.within(group as never)).toBe(false);

        group.destroy();
        member.destroy();
        stranger.destroy();
      });
    }));
});
