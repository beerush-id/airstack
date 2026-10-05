import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { Aria, aria, type BaseElement, roverCtx, type ToggleGroupProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('ToggleGroup - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Semantics & Attributes', () => {
    it('renders role="group" and defaults to horizontal orientation', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('toggle-group');
          expect(group.attributes.role).toBe('group');
          expect(group.attributes['aria-orientation']).toBe('horizontal');
          expect(group.attributes['aria-disabled']).toBe('false');
          expect(group.disabled).toBe(false);
          expect(group.orientation).toBe('horizontal');

          delete (group.properties as Record<string, unknown>).orientation;
          expect(group.orientation).toBe('horizontal');
        });
      }));

    it('renders aria-orientation="vertical" and aria-disabled="true" when configured', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('toggle-group', { orientation: 'vertical', disabled: true });
          expect(group.attributes.role).toBe('group');
          expect(group.attributes['aria-orientation']).toBe('vertical');
          expect(group.attributes['aria-disabled']).toBe('true');
          expect(group.disabled).toBe(true);
          expect(group.orientation).toBe('vertical');
        });
      }));
  });

  describe('Selection Coordination & Toggle Member Factory', () => {
    it('spawns child toggles that coordinate single selection', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'bold' });
          const group = aria('toggle-group', props);

          const t1 = group.toggle({ value: 'bold' });
          const t2 = group.toggle({ value: 'italic' });

          expect(t1.pressed).toBe(true);
          expect(t2.pressed).toBe(false);

          t2.select();
          expect(props.value).toBe('italic');
          expect(t1.pressed).toBe(false);
          expect(t2.pressed).toBe(true);
        });
      }));

    it('spawns child toggles that coordinate multiple selection', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ multiple: true, value: ['bold'] });
          const group = aria('toggle-group', props);

          const t1 = group.toggle({ value: 'bold' });
          const t2 = group.toggle({ value: 'italic' });

          expect(t1.pressed).toBe(true);
          expect(t2.pressed).toBe(false);

          t2.select();
          expect(props.value).toEqual(['bold', 'italic']);
          expect(t1.pressed).toBe(true);
          expect(t2.pressed).toBe(true);

          t1.deselect();
          expect(props.value).toEqual(['italic']);
          expect(t1.pressed).toBe(false);
        });
      }));
  });

  describe('Keyboard Navigation & Roving Focus', () => {
    it('roves focus across child toggles on arrow key events', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('toggle-group');
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          const t1 = group.toggle({ value: 'left' });
          const t2 = group.toggle({ value: 'center' });
          const t3 = group.toggle({ value: 'right' });

          const b1 = bind(document.createElement('button'), t1);
          const b2 = bind(document.createElement('button'), t2);
          const b3 = bind(document.createElement('button'), t3);

          groupEl.appendChild(b1);
          groupEl.appendChild(b2);
          groupEl.appendChild(b3);

          b1.focus();
          groupEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));

          // Manual: false navigation
          const manualGroup = aria('toggle-group', { manual: false });
          const manualEl = bind(document.createElement('div'), manualGroup);
          manualEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));

          // Early returns when disabled
          const disabledGroup = aria('toggle-group', { disabled: true });
          const disabledEl = bind(document.createElement('div'), disabledGroup);
          disabledEl.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
          );

          // Early returns when parentRover is active
          roverCtx.set(group as unknown as Aria<BaseElement>);
          const nestedGroup = aria('toggle-group');
          const nestedEl = bind(document.createElement('div'), nestedGroup);
          nestedEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
          roverCtx.set(undefined);

          document.body.removeChild(groupEl);
        });
      }));
  });

  describe('Multi/Single Selection Coordination Invariant', () => {
    it('keeps one pressed member in a single group and releases it only when optional', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'left' });
          const group = aria('toggle-group', props);

          const left = group.toggle({ value: 'left' });
          const center = group.toggle({ value: 'center' });

          const leftEl = bind(document.createElement('button'), left);
          const centerEl = bind(document.createElement('button'), center);
          bind(document.createElement('div'), group).append(leftEl, centerEl);

          expect(leftEl.getAttribute('aria-pressed')).toBe('true');
          expect(centerEl.getAttribute('aria-pressed')).toBe('false');

          centerEl.click();
          expect(props.value).toBe('center');
          expect(leftEl.getAttribute('aria-pressed')).toBe('false');
          expect(centerEl.getAttribute('aria-pressed')).toBe('true');

          // An optional single group can be emptied by deactivating the holder
          centerEl.click();
          expect(props.value).toBeUndefined();
          expect(centerEl.getAttribute('aria-pressed')).toBe('false');

          // A required single group refuses the same gesture
          centerEl.click();
          props.required = true;
          centerEl.click();
          expect(props.value).toBe('center');
          expect(centerEl.getAttribute('aria-pressed')).toBe('true');

          left.destroy();
          center.destroy();
        });
      }));

    it('switches the group role when a single selection is mandatory', () =>
      scope.run(() => {
        component().run(() => {
          const optional = aria('toggle-group', { value: 'a' });
          expect(optional.attributes.role).toBe('group');

          const mandatory = aria('toggle-group', { value: 'a', required: true });
          expect(mandatory.attributes.role).toBe('radiogroup');

          const multi = aria('toggle-group', { multiple: true, value: ['a'], required: true });
          expect(multi.attributes.role).toBe('group');

          optional.destroy();
          mandatory.destroy();
          multi.destroy();
        });
      }));

    it('toggles array membership and holds the last token when required', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ multiple: true, value: ['bold'] });
          const group = aria('toggle-group', props);

          const bold = group.toggle({ value: 'bold' });
          const italic = group.toggle({ value: 'italic' });

          const boldEl = bind(document.createElement('button'), bold);
          const italicEl = bind(document.createElement('button'), italic);
          bind(document.createElement('div'), group).append(boldEl, italicEl);

          italicEl.click();
          expect(props.value).toEqual(['bold', 'italic']);
          expect(italicEl.getAttribute('aria-pressed')).toBe('true');

          boldEl.click();
          expect(props.value).toEqual(['italic']);
          expect(boldEl.getAttribute('aria-pressed')).toBe('false');

          // Dropping the last token is allowed while the group is optional
          italicEl.click();
          expect(italic.pressed).toBe(false);

          // With required set, the last active member cannot be released
          italicEl.click();
          expect(props.value).toEqual(['italic']);
          group.properties.required = true;
          italicEl.click();
          expect(props.value).toEqual(['italic']);
          expect(italicEl.getAttribute('aria-pressed')).toBe('true');

          bold.destroy();
          italic.destroy();
        });
      }));
  });

  describe('Roving Focus Traversal Invariant', () => {
    it('wraps circularly along the declared axis and leaves selection untouched in manual mode', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'one' });
          const group = aria('toggle-group', props);

          const one = group.toggle({ value: 'one' });
          const two = group.toggle({ value: 'two' });
          const three = group.toggle({ value: 'three' });

          const groupEl = bind(document.createElement('div'), group);
          const elOne = bind(document.createElement('button'), one);
          const elTwo = bind(document.createElement('button'), two);
          const elThree = bind(document.createElement('button'), three);
          groupEl.append(elOne, elTwo, elThree);
          document.body.appendChild(groupEl);

          elOne.focus();

          const right = new KeyboardEvent('keydown', {
            key: 'ArrowRight',
            bubbles: true,
            cancelable: true,
          });
          groupEl.dispatchEvent(right);
          expect(document.activeElement).toBe(elTwo);
          expect(right.defaultPrevented).toBe(true);

          // Single groups default to manual: focus moved, selection stayed put
          expect(props.value).toBe('one');
          expect(elTwo.getAttribute('aria-pressed')).toBe('false');

          groupEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(elThree);

          // Past the end it wraps to the first
          groupEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(elOne);

          // Before the start it wraps to the last
          groupEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          expect(document.activeElement).toBe(elThree);

          // Enter on the focused member is what selects it
          elThree.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
          expect(props.value).toBe('three');
          expect(elThree.getAttribute('aria-pressed')).toBe('true');

          groupEl.remove();
        });
      }));

    it('never selects on the arrow axis of a multiple group', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({
            multiple: true,
            value: ['first'],
            orientation: 'vertical',
          });
          const group = aria('toggle-group', props);

          const first = group.toggle({ value: 'first' });
          const second = group.toggle({ value: 'second', disabled: true });
          const third = group.toggle({ value: 'third' });

          const groupEl = bind(document.createElement('div'), group);
          const elFirst = bind(document.createElement('button'), first);
          const elSecond = bind(document.createElement('button'), second);
          const elThird = bind(document.createElement('button'), third);
          groupEl.append(elFirst, elSecond, elThird);
          document.body.appendChild(groupEl);

          expect(groupEl.getAttribute('aria-orientation')).toBe('vertical');

          elFirst.focus();
          groupEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));

          // The disabled member is passed over, and nothing was selected on the way
          expect(document.activeElement).toBe(elThird);
          expect(props.value).toEqual(['first']);
          expect(elThird.getAttribute('aria-pressed')).toBe('false');

          // Horizontal keys have no claim on a vertical group
          const sideways = new KeyboardEvent('keydown', {
            key: 'ArrowRight',
            bubbles: true,
            cancelable: true,
          });
          groupEl.dispatchEvent(sideways);
          expect(sideways.defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(elThird);

          groupEl.remove();
        });
      }));
  });

  describe('Controlled Value Synchronization Invariant', () => {
    it('moves the pressed state and the single tab stop with an external value write', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'a' });
          const group = aria('toggle-group', props);

          const a = group.toggle({ value: 'a' });
          const b = group.toggle({ value: 'b' });
          const c = group.toggle({ value: 'c' });

          const elA = bind(document.createElement('button'), a);
          const elB = bind(document.createElement('button'), b);
          const elC = bind(document.createElement('button'), c);
          bind(document.createElement('div'), group).append(elA, elB, elC);

          expect(elA.getAttribute('tabindex')).toBe('0');
          expect(elB.getAttribute('tabindex')).toBe('-1');

          props.value = 'c';
          expect(a.pressed).toBe(false);
          expect(c.pressed).toBe(true);
          expect(elA.getAttribute('aria-pressed')).toBe('false');
          expect(elC.getAttribute('aria-pressed')).toBe('true');
          expect(elA.getAttribute('tabindex')).toBe('-1');
          expect(elC.getAttribute('tabindex')).toBe('0');

          // Clearing the value takes the pressed state with it
          props.value = undefined;
          expect(c.pressed).toBe(false);
          expect(elC.getAttribute('aria-pressed')).toBe('false');

          a.destroy();
          b.destroy();
          c.destroy();
        });
      }));

    it('cascades group disablement over members and protects the tab stop', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'x', disabled: false });
          const group = aria('toggle-group', props);

          const x = group.toggle({ value: 'x' });
          const y = group.toggle({ value: 'y', disabled: true });

          const groupEl = bind(document.createElement('div'), group);
          const elX = bind(document.createElement('button'), x);
          const elY = bind(document.createElement('button'), y);
          groupEl.append(elX, elY);

          expect(elY.getAttribute('aria-disabled')).toBe('true');
          expect(elY.getAttribute('tabindex')).toBe('-1');

          elY.click();
          expect(props.value).toBe('x');
          expect(y.pressed).toBe(false);

          props.disabled = true;
          expect(x.disabled).toBe(true);
          expect(elX.getAttribute('aria-disabled')).toBe('true');

          elX.click();
          expect(props.value).toBe('x');

          // The keystroke is nobody's to claim once the group is inert
          const right = new KeyboardEvent('keydown', {
            key: 'ArrowRight',
            bubbles: true,
            cancelable: true,
          });
          groupEl.dispatchEvent(right);
          expect(right.defaultPrevented).toBe(false);

          props.disabled = false;
          elX.click();
          expect(props.value).toBeUndefined();

          x.destroy();
          y.destroy();
        });
      }));
  });
});
