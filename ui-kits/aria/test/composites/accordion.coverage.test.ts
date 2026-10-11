import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { accordionCtx, aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Accordion - Edge Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('applies no roving tabindex to native grouped triggers', () =>
    scope.run(() => {
      component().run(() => {
        const group = aria('accordion');
        const container = bind(document.createElement('div'), group);

        const off = component().run(() => accordionCtx.get()!.button({ name: 'off', disabled: true }));
        const first = component().run(() => accordionCtx.get()!.button({ name: 'first' }));
        const second = component().run(() => accordionCtx.get()!.button({ name: 'second' }));

        const elOff = bind(document.createElement('button'), off);
        const elFirst = bind(document.createElement('button'), first);
        const elSecond = bind(document.createElement('button'), second);
        container.append(elOff, elFirst, elSecond);
        document.body.appendChild(container);

        expect(elOff.getAttribute('tabindex')).toBeNull();
        expect(elFirst.getAttribute('tabindex')).toBeNull();
        expect(elSecond.getAttribute('tabindex')).toBeNull();

        document.body.removeChild(container);
      });
    }));

  it('passes explicit vertical manual settings through to roving', () =>
    scope.run(() => {
      component().run(() => {
        const group = aria('accordion', { orientation: 'vertical', manual: true });
        const container = bind(document.createElement('div'), group);

        const one = component().run(() => accordionCtx.get()!.button({ name: 'one' }));
        const two = component().run(() => accordionCtx.get()!.button({ name: 'two' }));

        const elOne = bind(document.createElement('button'), one);
        const elTwo = bind(document.createElement('button'), two);
        container.append(elOne, elTwo);
        document.body.appendChild(container);

        elOne.focus();
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(document.activeElement).toBe(elTwo);

        document.body.removeChild(container);
      });
    }));

  it('omits group value from the root rest props', () =>
    scope.run(() => {
      component().run(() => {
        const group = aria('accordion', { id: 'omit-value', value: 'a' });

        expect(group.ownKeys).toContain('value');
        expect('value' in group.restProps()).toBe(false);
      });
    }));

  it('omits the pairing name from panel rest props', () =>
    scope.run(() => {
      component().run(() => {
        const group = aria('accordion', { id: 'omit-name', value: 'a' });
        const panel = group.panel({ name: 'a' });

        expect(panel.ownKeys).toContain('name');
        expect('name' in panel.restProps()).toBe(false);
      });
    }));

  it('keeps custom grouped triggers focusable while enabled', () =>
    scope.run(() => {
      component().run(() => {
        const group = aria('accordion', { id: 'custom-group', value: 'one' });
        const container = bind(document.createElement('div'), group);

        const one = component().run(() => accordionCtx.get()!.button({ name: 'one' }, { native: false }));
        const two = component().run(() => accordionCtx.get()!.button({ name: 'two' }, { native: false }));

        const elOne = bind(document.createElement('div'), one);
        const elTwo = bind(document.createElement('div'), two);
        container.append(elOne, elTwo);
        document.body.appendChild(container);

        expect(elOne.getAttribute('role')).toBe('button');
        expect(elOne.getAttribute('tabindex')).toBe('0');
        expect(elTwo.getAttribute('tabindex')).toBe('0');

        document.body.removeChild(container);
      });
    }));
});
