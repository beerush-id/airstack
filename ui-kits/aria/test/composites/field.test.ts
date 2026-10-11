import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type FieldOptions, type FieldProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
}

function blurOut(element: HTMLElement) {
  element.dispatchEvent(new FocusEvent('blur'));
}

function buildField(
  props: Partial<FieldProps>,
  options?: FieldOptions,
  controlHost: 'native' | 'custom' = 'native',
) {
  const field = aria('field', props as FieldProps, options);
  const fieldEl = bind(document.createElement('div'), field);
  document.body.appendChild(fieldEl);

  const label = component().run(() => {
    const part = controlHost === 'native' ? aria('field-label') : aria('field-label', {}, { native: false });
    const el = bind(document.createElement(controlHost === 'native' ? 'label' : 'span'), part);
    fieldEl.appendChild(el);
    return { part, el };
  });

  const control = component().run(() => {
    const part = controlHost === 'native' ? aria('field-control') : aria('field-control', {}, { native: false });
    const el = bind(document.createElement(controlHost === 'native' ? 'input' : 'div'), part);
    fieldEl.appendChild(el);
    return { part, el };
  });

  const description = component().run(() => {
    const part = aria('field-description');
    const el = bind(document.createElement('p'), part);
    fieldEl.appendChild(el);
    return { part, el };
  });

  const error = component().run(() => {
    const part = aria('field-error');
    const el = bind(document.createElement('p'), part);
    fieldEl.appendChild(el);
    return { part, el };
  });

  const controllers = [field, label.part, control.part, description.part, error.part];

  const cleanup = () => {
    for (const controller of controllers) {
      controller.destroy();
    }

    fieldEl.remove();
  };

  return { field, fieldEl, label, control, description, error, cleanup };
}

describe('Field - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Wiring', () => {
    it('derives every part address from one ambient field id', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<FieldProps>({ id: 'email' });
          const { label, control, description, error, cleanup } = buildField(props);

          expect(label.el.id).toBe('email-label');
          expect(control.el.id).toBe('email-control');
          expect(description.el.id).toBe('email-desc');
          expect(error.el.id).toBe('email-error');
          expect(control.el.getAttribute('aria-describedby')).toBe('email-desc');

          cleanup();
        });
      }));

    it('names each part from a generated namespace when the author declares none', () =>
      scope.run(() => {
        component().run(() => {
          const { fieldEl, control, description, cleanup } = buildField({});

          expect(fieldEl.id).toMatch(/^field-/);
          expect(control.el.id).toBe(`${fieldEl.id}-control`);
          expect(description.el.id).toBe(`${fieldEl.id}-desc`);
          expect(control.el.getAttribute('aria-describedby')).toBe(description.el.id);

          cleanup();
        });
      }));

    it('binds a native label to the control with for and names the control from it', () =>
      scope.run(() => {
        component().run(() => {
          const { label, control, cleanup } = buildField({ id: 'username' });

          expect((label.el as HTMLLabelElement).htmlFor).toBe('username-control');
          expect(label.el.hasAttribute('role')).toBe(false);
          expect(control.el.getAttribute('aria-labelledby')).toBe('username-label');

          cleanup();
        });
      }));

    it('gives a custom label an address for the control to point at', () =>
      scope.run(() => {
        component().run(() => {
          const { label, control, cleanup } = buildField({ id: 'search' }, undefined, 'custom');

          expect(label.el.id).toBe('search-label');
          expect(control.el.getAttribute('aria-labelledby')).toBe(label.el.id);
          expect(label.el.hasAttribute('for')).toBe(false);

          cleanup();
        });
      }));

    it('keeps helper text referenced for the life of the field and leaves the failure to aria-errormessage', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<FieldProps>({ id: 'promo' });
          const { control, description, error, cleanup } = buildField(props);

          expect(control.el.getAttribute('aria-describedby')).toBe(description.el.id);
          expect(description.el.getAttribute('aria-live')).toBeNull();
          expect(error.el.getAttribute('aria-live')).toBe('polite');
          expect(error.el.hidden).toBe(true);
          expect(control.el.hasAttribute('aria-invalid')).toBe(false);

          cleanup();
        });
      }));

    it('addresses every control from the field id without a role on the root', () =>
      scope.run(() => {
        component().run(() => {
          const { fieldEl, cleanup } = buildField({ id: 'note' });

          expect(fieldEl.id).toBe('note');
          expect(fieldEl.hasAttribute('role')).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Input', () => {
    it('renders the authored type, placeholder, and value onto the control', () =>
      scope.run(() => {
        component().run(() => {
          const { control, cleanup } = buildField({
            id: 'mail',
            type: 'email',
            placeholder: 'you@example.com',
            value: 'ada@example.com',
          });

          const input = control.el as HTMLInputElement;
          expect(input.type).toBe('email');
          expect(input.placeholder).toBe('you@example.com');
          expect(input.value).toBe('ada@example.com');

          cleanup();
        });
      }));

    it('takes the typed value into the field and reports it to oninput', async () =>
      scope.run(async () => {
        await component().run(async () => {
          const seen: unknown[] = [];
          const props = mutable<FieldProps>({
            id: 'handle',
            oninput: (event) => {
              seen.push(event);
            },
          });
          const { control, cleanup } = buildField(props);
          const input = control.el as HTMLInputElement;

          await type(input, 'ada');

          expect(props.value).toBe('ada');
          expect(seen).toHaveLength(1);

          cleanup();
        });
      }));

    it('follows a value written from the outside back onto the control', async () =>
      scope.run(async () => {
        await component().run(async () => {
          const props = mutable<FieldProps>({ id: 'city', value: 'Bandung' });
          const { control, cleanup } = buildField(props);
          const input = control.el as HTMLInputElement;

          expect(input.value).toBe('Bandung');

          props.value = 'Jakarta';
          await flush();

          expect(input.value).toBe('Jakarta');

          cleanup();
        });
      }));

    it('disables the native control while the field is disabled', async () =>
      scope.run(async () => {
        await component().run(async () => {
          const props = mutable<FieldProps>({ id: 'locked', disabled: true });
          const { control, cleanup } = buildField(props);
          const input = control.el as HTMLInputElement;

          expect(input.disabled).toBe(true);

          props.disabled = false;
          await flush();

          expect(input.disabled).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Validation', () => {
    const shortOf = (min: number) => (value?: string | number) =>
      String(value ?? '').length < min ? `At least ${min} characters` : undefined;

    it('holds the failure back until the developer leaves the field, then wires it like a native input', async () =>
      scope.run(async () => {
        await component().run(async () => {
          const props = mutable<FieldProps>({ id: 'signin', type: 'email', value: 'de@do' });
          const { control, description, error, cleanup } = buildField(props);
          const input = control.el as HTMLInputElement;

          expect(input.value).toBe('de@do');
          expect(input.type).toBe('email');
          expect(control.el.hasAttribute('aria-invalid')).toBe(false);
          expect(error.el.hidden).toBe(true);

          await type(input, 'd');

          expect(props.invalid).toBe(true);
          expect(control.el.hasAttribute('aria-invalid')).toBe(false);
          expect(error.el.hidden).toBe(true);

          blurOut(input);
          await flush();

          expect(props.touched).toBe(true);
          expect(control.el.getAttribute('aria-invalid')).toBe('true');
          expect(control.el.getAttribute('aria-errormessage')).toBe(error.el.id);
          expect(control.el.getAttribute('aria-describedby')).toBe(description.el.id);
          expect(error.el.hidden).toBe(false);

          await type(input, 'de@do');

          expect(props.invalid).toBe(false);
          expect(control.el.hasAttribute('aria-invalid')).toBe(false);
          expect(control.el.hasAttribute('aria-errormessage')).toBe(false);
          expect(error.el.hidden).toBe(true);

          cleanup();
        });
      }));

    it('exposes the field state and its setters to the developer', async () =>
      scope.run(async () => {
        await component().run(async () => {
          const props = mutable<FieldProps>({
            id: 'profile',
            type: 'email',
            placeholder: 'you@example.com',
            value: 'ada@example.com',
            required: true,
            disabled: true,
          });
          const { field, cleanup } = buildField(props);

          expect(field.id).toBe('profile');
          expect(field.type).toBe('email');
          expect(field.value).toBe('ada@example.com');
          expect(field.placeholder).toBe('you@example.com');
          expect(field.required).toBe(true);
          expect(field.disabled).toBe(true);
          expect(field.invalid).toBe(false);
          expect(field.touched).toBe(false);
          expect(field.canValidate).toBe(false);
          expect(field.validate('anything')).toBeUndefined();
          expect(field.invalidMessages).toBeUndefined();

          field.touched = true;
          field.invalidMessages = 'Server rejected it';
          await flush();

          expect(props.touched).toBe(true);
          expect(props.invalidMessages).toBe('Server rejected it');

          cleanup();
        });
      }));

    it('takes an authored validate rule over the built-in one', async () =>
      scope.run(async () => {
        await component().run(async () => {
          const props = mutable<FieldProps>({ id: 'password' });
          const { control, cleanup } = buildField(props, { validate: shortOf(8) });
          const input = control.el as HTMLInputElement;

          await type(input, 'short');

          expect(props.invalid).toBe(true);
          expect(props.invalidMessages).toBe('At least 8 characters');

          await type(input, 'longenough');

          expect(props.invalid).toBe(false);
          expect(props.invalidMessages).toBeFalsy();
          expect(control.el.hasAttribute('aria-invalid')).toBe(false);

          cleanup();
        });
      }));

    it('reflects the requirement on the native control without an ARIA mirror', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<FieldProps>({ id: 'address', required: true });
          const { control, cleanup } = buildField(props);
          const input = control.el as HTMLInputElement;

          expect(input.required).toBe(true);
          expect(input.hasAttribute('aria-required')).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Custom host parity', () => {
    it('reflects constraints through ARIA states instead of native properties', async () =>
      scope.run(async () => {
        await component().run(async () => {
          const props = mutable<FieldProps>({ id: 'rating', required: true });
          const { control, cleanup } = buildField(props, undefined, 'custom');

          expect(control.el.getAttribute('aria-required')).toBe('true');
          expect(control.el.getAttribute('aria-disabled')).toBe('false');

          props.disabled = true;
          await flush();

          expect(control.el.getAttribute('aria-disabled')).toBe('true');

          cleanup();
        });
      }));
  });

  describe('Teardown', () => {
    it('leaves the DOM frozen once every part is destroyed', async () =>
      scope.run(async () => {
        await component().run(async () => {
          const props = mutable<FieldProps>({ id: 'token', required: true });
          const { control, cleanup } = buildField(props);
          const input = control.el as HTMLInputElement;

          expect(input.required).toBe(true);

          cleanup();

          props.required = false;
          props.invalidMessages = 'Late failure';
          await flush();

          expect(input.required).toBe(true);
          expect(control.el.hasAttribute('aria-invalid')).toBe(false);
          expect(control.el.getAttribute('aria-describedby')).toBe('token-desc');
        });
      }));
  });
});
