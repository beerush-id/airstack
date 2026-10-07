import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, CheckboxAria, CheckboxGroupAria, checkboxGroupCtx } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('CheckboxGroup - Coverage & Boundary Tests', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Instantiation & ID Generation', () => {
    it('generates a deterministic unique ID when not provided', () =>
      scope.run(() => {
        component().run(() => {
          const group1 = aria('checkbox-group');
          const group2 = aria('checkbox-group');

          expect(group1).toBeInstanceOf(CheckboxGroupAria);
          expect(group1.properties.id).toBeDefined();
          expect(group1.properties.id).toMatch(/^checkbox-group-/);
          expect(group2.properties.id).toMatch(/^checkbox-group-/);
          expect(group1.properties.id).not.toBe(group2.properties.id);
          expect(group1.value).toEqual([]);
        });
      }));
  });

  describe('Properties, Value Accessors & Factory Methods', () => {
    it('preserves an explicitly passed ID, value, and exposes .checkbox() factory', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('checkbox-group', { id: 'custom-cg', value: ['alpha'], disabled: true });
          expect(group.properties.id).toBe('custom-cg');
          expect(group.value).toEqual(['alpha']);
          expect(group.disabled).toBe(true);
          expect(checkboxGroupCtx.get()).toBe(group);

          group.value = ['beta'];
          expect(group.value).toEqual(['beta']);

          delete (group.properties as Record<string, unknown>).value;
          expect(group.value).toEqual([]);

          const cb1 = group.checkbox({ value: 'opt-1' });
          const cb2 = group.checkbox({ value: 'opt-2' }, { native: false });

          expect(cb1).toBeInstanceOf(CheckboxAria);
          expect(cb2).toBeInstanceOf(CheckboxAria);
          expect(cb1.isNative).toBe(true);
          expect(cb2.isNative).toBe(false);
        });
      }));
  });

  describe('Attributes Compilation & DOM Attachment', () => {
    it('compiles attributes on non-fieldset host with label and disabled state', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('checkbox-group', { label: 'Group Label', disabled: true });
          const div = bind(document.createElement('div'), group);
          document.body.appendChild(div);

          expect(group.attributes.role).toBe('group');
          expect(group.attributes['aria-label']).toBe('Group Label');
          expect(group.attributes['aria-disabled']).toBe('true');
          expect(div.getAttribute('role')).toBe('group');
          expect(div.getAttribute('aria-label')).toBe('Group Label');
          expect(div.getAttribute('aria-disabled')).toBe('true');

          group.destroy();
          div.remove();
        });
      }));

    it('omits role="group" and removes role attribute on fieldset host', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('checkbox-group');
          const fieldset = document.createElement('fieldset');
          fieldset.setAttribute('role', 'group');

          bind(fieldset, group);
          document.body.appendChild(fieldset);

          expect(group.attributes.role).toBeUndefined();
          expect(fieldset.getAttribute('role')).toBeNull();

          group.destroy();
          fieldset.remove();
        });
      }));
  });
});
