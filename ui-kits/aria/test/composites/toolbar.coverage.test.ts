import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Toolbar - Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('emits an explicit aria-disabled baseline and no aria-label when unnamed', () =>
    scope.run(() => {
      component().run(() => {
        const toolbar = aria('toolbar');

        expect(toolbar.attributes['aria-disabled']).toBe('false');
        expect(toolbar.attributes['aria-label']).toBeUndefined();
      });
    }));

  it('recompiles aria-orientation when the prop changes', () =>
    scope.run(() => {
      component().run(() => {
        const props = mutable<{ orientation?: 'horizontal' | 'vertical' }>({});
        const toolbar = aria('toolbar', props);

        expect(toolbar.attributes['aria-orientation']).toBe('horizontal');

        props.orientation = 'vertical';
        expect(toolbar.attributes['aria-orientation']).toBe('vertical');
      });
    }));

  it('leaves Enter and Space to the focused control', () =>
    scope.run(() => {
      component().run(() => {
        const toolbar = aria('toolbar');
        const toolbarEl = bind(document.createElement('div'), toolbar);
        document.body.append(toolbarEl);

        const first = bind(document.createElement('button'), aria('button'));
        const second = bind(document.createElement('button'), aria('button'));
        toolbarEl.append(first, second);

        first.focus();

        for (const key of ['Enter', ' ']) {
          const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
          toolbarEl.dispatchEvent(event);

          expect(event.defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(first);
        }

        toolbarEl.remove();
      });
    }));

  it('leaves keys it does not own untouched', () =>
    scope.run(() => {
      component().run(() => {
        const toolbar = aria('toolbar');
        const toolbarEl = bind(document.createElement('div'), toolbar);
        document.body.append(toolbarEl);

        const first = bind(document.createElement('button'), aria('button'));
        toolbarEl.append(first);
        first.focus();

        for (const key of ['a', 'Tab', 'Escape', 'ArrowUp']) {
          const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
          toolbarEl.dispatchEvent(event);

          expect(event.defaultPrevented).toBe(false);
        }

        expect(document.activeElement).toBe(first);

        toolbarEl.remove();
      });
    }));

  it('roves nothing and throws nothing when it holds no control', () =>
    scope.run(() => {
      component().run(() => {
        const toolbar = aria('toolbar');
        const toolbarEl = bind(document.createElement('div'), toolbar);
        document.body.append(toolbarEl);

        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
        toolbarEl.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);

        toolbarEl.remove();
      });
    }));

  it('releases the roving handler on destroy', () =>
    scope.run(() => {
      component().run(() => {
        const toolbar = aria('toolbar');
        const toolbarEl = bind(document.createElement('div'), toolbar);
        document.body.append(toolbarEl);

        const first = bind(document.createElement('button'), aria('button'));
        const second = bind(document.createElement('button'), aria('button'));
        toolbarEl.append(first, second);

        first.focus();
        toolbar.destroy();

        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
        toolbarEl.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(first);

        toolbarEl.remove();
      });
    }));
});
