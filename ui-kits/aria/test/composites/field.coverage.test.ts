import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type FieldProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
}

describe('Field - Edge Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('generates a namespace when constructed with no props at all', () =>
    scope.run(() => {
      component().run(() => {
        const field = aria('field');

        expect(field.attributes.id).toMatch(/^field-/);

        field.destroy();
      });
    }));

  it('keeps the root role-less on a fieldset with multiple controls', () =>
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
        expect(labelEl.hasAttribute('for')).toBe(false);
        expect(controlEl.hasAttribute('aria-describedby')).toBe(false);
        expect(controlEl.hasAttribute('aria-labelledby')).toBe(false);
        expect(descriptionEl.hasAttribute('aria-live')).toBe(false);
        expect(errorEl.hasAttribute('aria-live')).toBe(false);

        expect(control.type).toBe('text');
        expect(control.value).toBe('');
        expect(control.invalid).toBe(false);
        expect(control.disabled).toBe(false);
        expect(control.required).toBe(false);
        expect(error.visible).toBe(false);
        expect(error.message).toBeUndefined();

        controlEl.dispatchEvent(new Event('input', { bubbles: true }));
        controlEl.dispatchEvent(new FocusEvent('blur'));

        expect(errorEl.hasAttribute('aria-live')).toBe(false);

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

  it('announces a touched invalid field on a custom control through aria-errormessage', () =>
    scope.run(() => {
      component().run(() => {
        const field = aria('field', { id: 'custom-invalid', invalid: true, touched: true });
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
        expect(control.el.getAttribute('aria-errormessage')).toBe('custom-invalid-error');
        expect(control.el.getAttribute('aria-describedby')).toBe('custom-invalid-desc');
        expect(error.el.id).toBe('custom-invalid-error');
        expect(error.el.hidden).toBe(false);

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

        expect(control.el.hasAttribute('aria-required')).toBe(false);
        expect(control.el.hasAttribute('aria-disabled')).toBe(false);

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

  it('keeps every message a list returning validate produces', async () =>
    scope.run(async () => {
      await component().run(async () => {
        const props = mutable<FieldProps>({ id: 'signup' });
        const field = aria('field', props, {
          validate: () => ['Too short', 'Needs a digit'],
        });
        const fieldEl = bind(document.createElement('div'), field);
        document.body.appendChild(fieldEl);

        const control = component().run(() => {
          const part = aria('field-control');
          const el = bind(document.createElement('input'), part);
          fieldEl.appendChild(el);
          return { part, el };
        });

        await type(control.el as HTMLInputElement, 'abc');

        expect(props.invalid).toBe(true);
        expect(props.invalidMessages).toEqual(['Too short', 'Needs a digit']);

        field.destroy();
        control.part.destroy();
        fieldEl.remove();
      });
    }));

  it('drops the label and description references when the author opts out', () =>
    scope.run(() => {
      component().run(() => {
        const field = aria('field', { id: 'optout' }, { labelled: false, described: false });
        const fieldEl = bind(document.createElement('div'), field);
        document.body.appendChild(fieldEl);

        const control = component().run(() => {
          const part = aria('field-control');
          const el = bind(document.createElement('input'), part);
          fieldEl.appendChild(el);
          return { part, el };
        });

        expect(control.el.id).toBe('optout-control');
        expect(control.el.hasAttribute('aria-labelledby')).toBe(false);
        expect(control.el.hasAttribute('aria-describedby')).toBe(false);

        field.destroy();
        control.part.destroy();
        fieldEl.remove();
      });
    }));

  it('reads the error visibility and message from the field state', async () =>
    scope.run(async () => {
      await component().run(async () => {
        const props = mutable<FieldProps>({ id: 'card', invalidMessages: 'Card declined' });
        const field = aria('field', props);
        const fieldEl = bind(document.createElement('div'), field);
        document.body.appendChild(fieldEl);

        const error = component().run(() => {
          const part = aria('field-error');
          const el = bind(document.createElement('p'), part);
          fieldEl.appendChild(el);
          return { part, el };
        });

        expect(error.part.message).toBe('Card declined');
        expect(error.part.visible).toBe(false);
        expect(error.el.hidden).toBe(true);

        props.touched = true;
        props.invalid = true;
        await flush();

        expect(error.part.visible).toBe(true);
        expect(error.el.hidden).toBe(false);

        field.destroy();
        error.part.destroy();
        fieldEl.remove();
      });
    }));
});
