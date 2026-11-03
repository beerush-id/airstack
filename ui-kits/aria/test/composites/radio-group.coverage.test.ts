import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, RadioGroupAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('RadioGroup - Coverage & Boundary Tests', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Instantiation & ID Generation', () => {
    it('generates a deterministic unique ID when not provided', () =>
      scope.run(() => {
        component().run(() => {
          const group1 = aria('radio-group');
          const group2 = aria('radio-group');

          expect(group1).toBeInstanceOf(RadioGroupAria);
          expect(group1.properties.id).toBeDefined();
          expect(group1.properties.id).toMatch(/^radiogroup-/);
          expect(group2.properties.id).toMatch(/^radiogroup-/);
          expect(group1.properties.id).not.toBe(group2.properties.id);
        });
      }));

    it('preserves an explicitly passed ID', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('radio-group', { id: 'custom-radio-group' });
          expect(group.properties.id).toBe('custom-radio-group');
          expect(group.attributes.id).toBe('custom-radio-group');
        });
      }));
  });

  describe('Factory Method Defaults', () => {
    it('handles group.radio() invocation with no arguments', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('radio-group');
          const r = group.radio();
          expect(r).toBeDefined();
          expect(r.isNative).toBe(true);
        });
      }));
  });

  describe('Keyboard Edge Cases & Key Ignorance', () => {
    it('ignores non-navigation keys on the radiogroup container', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('radio-group');
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          const r1 = group.radio({ value: '1' }, { native: false });
          const r1El = bind(document.createElement('div'), r1);
          groupEl.appendChild(r1El);

          const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
          groupEl.dispatchEvent(tabEvent);
          expect(tabEvent.defaultPrevented).toBe(false);

          groupEl.remove();
        });
      }));

    it('gracefully handles roving keys when no candidate radio elements exist', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('radio-group');
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
          groupEl.dispatchEvent(arrowEvent);
          expect(arrowEvent.defaultPrevented).toBe(false);

          groupEl.remove();
        });
      }));
  });

  describe('Validation State Variations', () => {
    it('handles spelling and grammar invalid indicators', () =>
      scope.run(() => {
        component().run(() => {
          const spellingGroup = aria('radio-group', { invalid: 'spelling' });
          expect(spellingGroup.attributes['aria-invalid']).toBe('spelling');

          const grammarGroup = aria('radio-group', { invalid: 'grammar' });
          expect(grammarGroup.attributes['aria-invalid']).toBe('grammar');

          const trueGroup = aria('radio-group', { invalid: true });
          expect(trueGroup.attributes['aria-invalid']).toBe('true');

          const falseGroup = aria('radio-group', { invalid: false });
          expect(falseGroup.attributes['aria-invalid']).toBe('false');
        });
      }));
  });
});
