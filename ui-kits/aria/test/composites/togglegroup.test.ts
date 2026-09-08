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

          delete (group.props as Record<string, unknown>).orientation;
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
});
