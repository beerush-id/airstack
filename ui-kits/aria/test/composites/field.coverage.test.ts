import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Field - Edge Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('generates a namespace when constructed with no props at all', () =>
    scope.run(() => {
      component().run(() => {
        const field = aria('field');

        expect(String(field.attributes.id)).toMatch(/^field-/);

        field.destroy();
      });
    }));

  it('omits the grouping role on a fieldset with multiple controls', () =>
    scope.run(() => {
      component().run(() => {
        const field = aria('field', { id: 'fieldset-group' }, { native: true });
        const fieldEl = bind(document.createElement('fieldset'), field);
        document.body.appendChild(fieldEl);

        const first = component().run(() => {
          const part = aria('field-control');
          fieldEl.appendChild(bind(document.createElement('input'), part));
          return part;
        });

        const second = component().run(() => {
          const part = aria('field-control');
          fieldEl.appendChild(bind(document.createElement('input'), part));
          return part;
        });

        expect(fieldEl.hasAttribute('role')).toBe(false);

        field.destroy();
        first.destroy();
        second.destroy();
        fieldEl.remove();
      });
    }));

  it('renders standalone parts inertly without a field instead of throwing', () =>
    scope.run(() => {
      component().run(() => {
        const label = aria('field-label', {}, { native: false });
        const control = aria('field-control', {}, { native: false });
        const description = aria('field-description');
        const error = aria('field-error');

        const labelEl = bind(document.createElement('span'), label);
        const controlEl = bind(document.createElement('div'), control);
        const descriptionEl = bind(document.createElement('p'), description);
        const errorEl = bind(document.createElement('p'), error);

        expect(labelEl.hasAttribute('role')).toBe(false);
        expect(controlEl.hasAttribute('aria-describedby')).toBe(false);
        expect(errorEl.getAttribute('aria-live')).toBe('polite');

        label.destroy();
        control.destroy();
        description.destroy();
        error.destroy();
        labelEl.remove();
        controlEl.remove();
        descriptionEl.remove();
        errorEl.remove();
      });
    }));

  it('announces invalid on a custom control while appending the error to describedby', () =>
    scope.run(() => {
      component().run(() => {
        const field = aria('field', { id: 'custom-invalid', invalid: true });
        const fieldEl = bind(document.createElement('div'), field);
        document.body.appendChild(fieldEl);

        const error = component().run(() => {
          const part = aria('field-error');
          const el = bind(document.createElement('p'), part);
          fieldEl.appendChild(el);
          return { part, el };
        });

        const control = component().run(() => {
          const part = aria('field-control', {}, { native: false });
          const el = bind(document.createElement('div'), part);
          fieldEl.appendChild(el);
          return { part, el };
        });

        expect(control.el.getAttribute('aria-invalid')).toBe('true');
        expect(control.el.getAttribute('aria-describedby')).toBe('custom-invalid-desc custom-invalid-error');
        expect(error.el.id).toBe('custom-invalid-error');

        field.destroy();
        error.part.destroy();
        control.part.destroy();
        fieldEl.remove();
      });
    }));

  it('treats an undeclared control as native even on a custom host', () =>
    scope.run(() => {
      component().run(() => {
        const field = aria('field', { id: 'undeclared', required: true });
        const fieldEl = bind(document.createElement('div'), field);
        document.body.appendChild(fieldEl);

        const control = component().run(() => {
          const part = aria('field-control');
          const el = bind(document.createElement('div'), part);
          fieldEl.appendChild(el);
          return { part, el };
        });

        expect((control.el as HTMLInputElement).required).toBe(true);
        expect(control.el.hasAttribute('aria-required')).toBe(false);

        field.destroy();
        control.part.destroy();
        fieldEl.remove();
      });
    }));

  it('lets an explicit custom declaration win over a native host', () =>
    scope.run(() => {
      component().run(() => {
        const field = aria('field', { id: 'override', required: true });
        const fieldEl = bind(document.createElement('div'), field);
        document.body.appendChild(fieldEl);

        const control = component().run(() => {
          const part = aria('field-control', {}, { native: false });
          const el = bind(document.createElement('input'), part);
          fieldEl.appendChild(el);
          return { part, el };
        });

        expect(control.el.getAttribute('aria-required')).toBe('true');
        expect((control.el as HTMLInputElement).required).toBe(false);

        field.destroy();
        control.part.destroy();
        fieldEl.remove();
      });
    }));

  it('drops the grouping role when a control is destroyed', () =>
    scope.run(() => {
      component().run(() => {
        const field = aria('field', { id: 'shrinking' });
        const fieldEl = bind(document.createElement('div'), field);
        document.body.appendChild(fieldEl);

        const first = component().run(() => {
          const part = aria('field-control');
          fieldEl.appendChild(bind(document.createElement('input'), part));
          return part;
        });

        const second = component().run(() => {
          const part = aria('field-control');
          fieldEl.appendChild(bind(document.createElement('input'), part));
          return part;
        });

        expect(fieldEl.getAttribute('role')).toBe('group');

        second.destroy();
        expect(fieldEl.getAttribute('role')).toBeNull();

        field.destroy();
        first.destroy();
        fieldEl.remove();
      });
    }));
});
