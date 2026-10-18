import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, ReorderAria, ReorderHandleAria, ReorderItemAria, type ReorderProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Reorder - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('covers ReorderAria getters, setters, defaults, and method guards', () =>
    scope.run(() => {
      component().run(() => {
        const reorder = new ReorderAria();
        expect(reorder.id).toMatch(/^reorder-/);
        expect(reorder.value).toEqual([]);
        expect(reorder.preview).toBeUndefined();
        expect(reorder.active).toBeUndefined();
        expect(reorder.orientation).toBe('vertical');

        reorder.assign({ orientation: undefined });
        expect(reorder.orientation).toBe('vertical');

        reorder.value = ['a', 'b'];
        expect(reorder.value).toEqual(['a', 'b']);

        reorder.pickup('missing');
        expect(reorder.active).toBeUndefined();

        reorder.assign({ disabled: true });
        reorder.pickup('a');
        expect(reorder.active).toBeUndefined();

        reorder.assign({ disabled: false });
        reorder.move(1);
        expect(reorder.moveByPointer(0, 0)).toBe(false);
        reorder.drop();
        reorder.cancel();

        reorder.pickup('a');
        expect(reorder.active).toBe('a');
        expect(reorder.preview).toEqual(['a', 'b']);
        expect(reorder.moveByPointer(0, 0)).toBe(false);

        reorder.move('home');
        expect(reorder.preview).toEqual(['a', 'b']);

        reorder.assign({ active: 'ghost' });
        reorder.move(1);
        expect(reorder.moveByPointer(0, 0)).toBe(false);
        expect(reorder.preview).toEqual(['a', 'b']);

        reorder.destroy();
      });
    }));

  it('covers pointer click pickup and drop, horizontal pointer drag, custom non-native handle host, and standalone fallbacks', () =>
    scope.run(() => {
      component().run(() => {
        const orphanItem = new ReorderItemAria();
        expect(orphanItem.index).toBe(-1);
        expect(orphanItem.active).toBe(false);
        expect(orphanItem.disabled).toBe(false);

        const defaultHandle = new ReorderHandleAria();
        expect(defaultHandle.attributes.type).toBe('button');
        defaultHandle.destroy();

        const orphanHandle = new ReorderHandleAria({ disabled: false }, { native: false });
        expect(orphanHandle.active).toBe(false);
        expect(orphanHandle.disabled).toBe(false);
        expect(orphanHandle.attributes.role).toBe('button');
        expect(orphanHandle.attributes.tabindex).toBe(0);
        expect(orphanHandle.attributes.type).toBeUndefined();

        const orphanEl = bind(document.createElement('div'), orphanHandle);
        orphanEl.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, cancelable: true }));
        orphanEl.click();
        orphanEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

        orphanHandle.assign({ disabled: true });
        expect(orphanHandle.attributes.tabindex).toBe(-1);

        orphanHandle.destroy();
        orphanItem.destroy();
      });

      component().run(() => {
        const props = mutable<ReorderProps>({ value: ['x', 'y'], orientation: 'horizontal' });
        const reorder = aria('reorder', props);
        const listEl = bind(document.createElement('ul'), reorder);

        const itemX = aria('reorder-item', { value: 'x' });
        const itemXEl = bind(document.createElement('li'), itemX);
        expect(itemX.index).toBe(0);

        const handleX = aria('reorder-handle', { label: 'Move X' });
        const handleXEl = bind(document.createElement('button'), handleX);
        itemXEl.appendChild(handleXEl);
        listEl.appendChild(itemXEl);

        const itemY = aria('reorder-item', { value: 'y' });
        const itemYEl = bind(document.createElement('li'), itemY);
        listEl.appendChild(itemYEl);

        const unmountedItem = aria('reorder-item', { value: 'z' });

        document.body.appendChild(listEl);

        itemXEl.getBoundingClientRect = () =>
          ({ left: 0, right: 80, top: 0, bottom: 40, width: 80, height: 40, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        itemYEl.getBoundingClientRect = () =>
          ({ left: 80, right: 160, top: 0, bottom: 40, width: 80, height: 40, x: 80, y: 0, toJSON: () => ({}) }) as DOMRect;

        handleXEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        expect(props.active).toBeUndefined();

        handleXEl.dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true, cancelable: true }));
        expect(props.active).toBeUndefined();

        const preventedClick = new MouseEvent('click', { bubbles: true, cancelable: true });
        preventedClick.preventDefault();
        handleXEl.dispatchEvent(preventedClick);
        expect(props.active).toBeUndefined();

        const preventedKey = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        preventedKey.preventDefault();
        handleXEl.dispatchEvent(preventedKey);
        expect(props.active).toBeUndefined();

        handleXEl.dispatchEvent(
          new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10, bubbles: true, cancelable: true })
        );
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 11, clientY: 10, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: 11, clientY: 10, bubbles: true }));
        handleXEl.click();
        expect(props.active).toBe('x');

        handleXEl.dispatchEvent(
          new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10, bubbles: true, cancelable: true })
        );
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 10, bubbles: true }));
        handleXEl.click();
        expect(props.active).toBeNull();

        handleXEl.dispatchEvent(
          new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10, bubbles: true, cancelable: true })
        );
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 130, clientY: 10, bubbles: true }));
        expect(props.preview).toEqual(['y', 'x']);
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 10, bubbles: true }));
        expect(props.preview).toEqual(['y', 'x']);
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 10, bubbles: true }));
        expect(props.preview).toEqual(['x', 'y']);
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: 20, clientY: 10, bubbles: true }));
        handleXEl.click();
        expect(props.active).toBeNull();

        handleXEl.click();
        expect(props.active).toBe('x');
        expect(itemX.active).toBe(true);
        expect(handleX.active).toBe(true);
        expect(itemX.index).toBe(0);

        handleXEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        expect(props.preview).toEqual(['y', 'x']);
        expect(itemX.index).toBe(1);

        handleXEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
        expect(props.preview).toEqual(['y', 'x']);

        handleXEl.click();
        expect(props.active).toBeNull();
        expect(props.value).toEqual(['y', 'x']);

        unmountedItem.destroy();
        handleX.destroy();
        itemX.destroy();
        itemY.destroy();
        reorder.destroy();
        listEl.remove();
      });
    }));
});
