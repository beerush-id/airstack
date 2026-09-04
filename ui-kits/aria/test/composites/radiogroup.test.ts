import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type RadioGroupProps, radioGroupCtx } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('RadioGroup - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('renders role="radiogroup" and default vertical orientation attributes', () =>
    scope.run(() => {
      component().run(() => {
        const group = aria('radiogroup');
        expect(group.attributes.role).toBe('radiogroup');
        expect(group.attributes['aria-orientation']).toBe('vertical');

        const horizontalGroup = aria('radiogroup', { orientation: 'horizontal' });
        expect(horizontalGroup.attributes['aria-orientation']).toBe('horizontal');
      });
    }));

  it('coordinates child radios and navigates arrow keys with roving tabindex', () =>
    scope.run(() => {
      component().run(() => {
        const props = mutable<RadioGroupProps>({ value: 'opt-1' });
        const group = aria('radiogroup', props);
        const groupEl = bind(document.createElement('div'), group);
        document.body.appendChild(groupEl);

        const r1 = component().run(() => radioGroupCtx.get()!.radio({ value: 'opt-1' }));
        const r2 = component().run(() => radioGroupCtx.get()!.radio({ value: 'opt-2' }));
        const r3 = component().run(() => radioGroupCtx.get()!.radio({ value: 'opt-3' }));

        const input1 = bind(document.createElement('input'), r1);
        const input2 = bind(document.createElement('input'), r2);
        const input3 = bind(document.createElement('input'), r3);

        groupEl.appendChild(input1);
        groupEl.appendChild(input2);
        groupEl.appendChild(input3);

        expect(r1.checked).toBe(true);
        expect(r2.checked).toBe(false);
        expect(r3.checked).toBe(false);
        expect(input1.checked).toBe(true);
        expect(input2.checked).toBe(false);
        expect(input3.checked).toBe(false);

        input1.focus();

        // ArrowDown navigates and selects r2
        const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
        groupEl.dispatchEvent(downEvent);

        expect(props.value).toBe('opt-2');
        expect(r2.checked).toBe(true);
        expect(r1.checked).toBe(false);
        expect(input2.checked).toBe(true);
        expect(input1.checked).toBe(false);
        expect(document.activeElement).toBe(input2);

        // ArrowUp navigates back to r1
        const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
        groupEl.dispatchEvent(upEvent);

        expect(props.value).toBe('opt-1');
        expect(r1.checked).toBe(true);
        expect(input1.checked).toBe(true);
        expect(document.activeElement).toBe(input1);

        groupEl.remove();
      });
    }));

  it('ignores keyboard navigation when radiogroup is disabled', () =>
    scope.run(() => {
      component().run(() => {
        const group = aria('radiogroup', { disabled: true, value: 'opt-1' });
        const groupEl = bind(document.createElement('div'), group);
        document.body.appendChild(groupEl);

        const r1 = component().run(() => radioGroupCtx.get()!.radio({ value: 'opt-1' }));
        const r2 = component().run(() => radioGroupCtx.get()!.radio({ value: 'opt-2' }));

        const input1 = bind(document.createElement('input'), r1);
        const input2 = bind(document.createElement('input'), r2);

        groupEl.appendChild(input1);
        groupEl.appendChild(input2);

        input1.focus();

        const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
        groupEl.dispatchEvent(downEvent);

        expect(group.props.value).toBe('opt-1');
        expect(document.activeElement).toBe(input1);

        groupEl.remove();
      });
    }));
});
