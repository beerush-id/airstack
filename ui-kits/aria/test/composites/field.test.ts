import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type FieldProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildField(props: Partial<FieldProps>, controlHost: 'native' | 'custom' = 'native') {
  const field = aria('field', props as FieldProps);
  const fieldEl = bind(document.createElement('div'), field);
  document.body.appendChild(fieldEl);

  const label = component().run(() => {
    const part = aria('field-label');
    return { part, el: bind(document.createElement('label'), part) };
  });

  const control = component().run(() => {
    // The field-control overload takes no options, so the host element is the only signal
    const part = aria('field-control');
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

  fieldEl.insertBefore(label.el, fieldEl.firstChild);

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

  describe('Ambient Form Context & ID Propagation Invariant', () => {
    it('derives every part address from one ambient field id', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<FieldProps>({ id: 'email' });
          const { control, description, error, cleanup } = buildField(props);

          expect(control.el.id).toBe('email-control');
          expect(description.el.id).toBe('email-desc');
          expect(error.el.id).toBe('email-error');

          expect(control.el.getAttribute('aria-describedby')).toBe('email-desc');

          cleanup();
        });
      }));

    it('names each field with a generated namespace when the author declares none', () =>
      scope.run(() => {
        component().run(() => {
          const { field, control, description, cleanup } = buildField({});

          expect(typeof field.attributes.id).toBe('string');
          expect(String(field.attributes.id)).toMatch(/^field-/);

          // The derived addresses follow the generated namespace, not a literal
          expect(control.el.id).toBe(`${field.attributes.id}-control`);
          expect(description.el.id).toBe(`${field.attributes.id}-desc`);
          expect(control.el.getAttribute('aria-describedby')).toBe(description.el.id);

          cleanup();
        });
      }));

    it('resolves every referenced id against a live element', () =>
      scope.run(() => {
        component().run(() => {
          const { control, description, error, cleanup } = buildField({ id: 'signup', invalid: true });

          const referenced = (control.el.getAttribute('aria-describedby') ?? '').split(' ');
          expect(referenced).toHaveLength(2);

          for (const id of referenced) {
            expect(document.getElementById(id)).not.toBeNull();
          }

          expect(referenced).toContain(description.el.id);
          expect(referenced).toContain(error.el.id);

          cleanup();
        });
      }));
  });

  describe('Associated Label & Description Invariant', () => {
    it('binds a native label to the control with for, without a redundant labelledby', () =>
      scope.run(() => {
        component().run(() => {
          const { label, control, cleanup } = buildField({ id: 'username' });

          expect(label.el.htmlFor).toBe('username-control');
          expect(label.el.hasAttribute('role')).toBe(false);
          expect(control.el.hasAttribute('aria-labelledby')).toBe(false);

          cleanup();
        });
      }));

    it('gives a custom label an address for the control to point at', () =>
      scope.run(() => {
        component().run(() => {
          const field = aria('field', { id: 'search' });
          const fieldEl = bind(document.createElement('div'), field);
          document.body.appendChild(fieldEl);

          const label = component().run(() => {
            const part = aria('field-label');
            const el = bind(document.createElement('span'), part);
            fieldEl.appendChild(el);
            return { part, el };
          });

          const control = component().run(() => {
            const part = aria('field-control');
            const el = bind(document.createElement('input'), part);
            fieldEl.appendChild(el);
            return { part, el };
          });

          expect(label.el.id).toBeTruthy();
          expect(control.el.getAttribute('aria-labelledby')).toBe(label.el.id);
          expect(label.el.hasAttribute('for')).toBe(false);

          field.destroy();
          label.part.destroy();
          control.part.destroy();
          fieldEl.remove();
        });
      }));

    it('keeps helper text permanently referenced and the error referenced only while invalid', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<FieldProps>({ id: 'promo', invalid: false });
          const { control, description, error, cleanup } = buildField(props);

          expect(control.el.getAttribute('aria-describedby')).toBe(description.el.id);
          expect(description.el.getAttribute('aria-live')).toBeNull();
          expect(error.el.getAttribute('aria-live')).toBe('polite');

          props.invalid = true;
          expect(control.el.getAttribute('aria-describedby')).toBe(`${description.el.id} ${error.el.id}`);
          expect(control.el.getAttribute('aria-invalid')).toBe('true');

          // Withdrawing the failure keeps the helper and drops the announcement
          props.invalid = false;
          expect(control.el.getAttribute('aria-describedby')).toBe(description.el.id);

          cleanup();
        });
      }));
  });

  describe('Constraint Reflection & State Projection Invariant', () => {
    it('reflects constraints through native properties on a native control', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<FieldProps>({ required: false, disabled: false });
          const { control, cleanup } = buildField(props, 'native');

          const input = control.el as HTMLInputElement;
          expect(input.required).toBe(false);
          expect(input.disabled).toBe(false);
          expect(input.hasAttribute('aria-required')).toBe(false);
          expect(input.hasAttribute('aria-disabled')).toBe(false);

          props.required = true;
          props.disabled = true;
          expect(input.required).toBe(true);
          expect(input.disabled).toBe(true);

          cleanup();
        });
      }));

    it('reflects the same constraints through ARIA states on a custom control', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<FieldProps>({ required: true, disabled: false });
          const { control, cleanup } = buildField(props, 'custom');

          expect(control.el.getAttribute('aria-required')).toBe('true');
          expect(control.el.hasAttribute('aria-disabled')).toBe(false);

          props.disabled = true;
          expect(control.el.getAttribute('aria-disabled')).toBe('true');

          props.disabled = false;
          props.required = false;
          expect(control.el.getAttribute('aria-required')).toBe('false');
          expect(control.el.getAttribute('aria-disabled')).toBe('false');

          cleanup();
        });
      }));

    it('takes on the grouping role only when the field holds more than one control', () =>
      scope.run(() => {
        component().run(() => {
          const single = buildField({ id: 'note' });
          expect(single.fieldEl.getAttribute('role')).toBeNull();
          expect(single.field.attributes.role).toBeUndefined();
          single.cleanup();

          const grouping = aria('field', { id: 'range' });
          const groupingEl = bind(document.createElement('div'), grouping);
          document.body.appendChild(groupingEl);

          const lower = component().run(() => {
            const part = aria('field-control');
            groupingEl.appendChild(bind(document.createElement('input'), part));
            return part;
          });

          const upper = component().run(() => {
            const part = aria('field-control');
            groupingEl.appendChild(bind(document.createElement('input'), part));
            return part;
          });

          expect(grouping.attributes.role).toBe('group');
          expect(groupingEl.getAttribute('role')).toBe('group');

          grouping.destroy();
          lower.destroy();
          upper.destroy();
          groupingEl.remove();
        });
      }));

    it('stops propagating state to a control after the field is destroyed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<FieldProps>({ id: 'token', invalid: false, required: true });
          const { field, control, cleanup } = buildField(props);

          expect((control.el as HTMLInputElement).required).toBe(true);

          field.destroy();

          props.invalid = true;
          props.required = false;
          expect(control.el.hasAttribute('aria-invalid')).toBe(false);
          expect((control.el as HTMLInputElement).required).toBe(true);
          expect(control.el.getAttribute('aria-describedby')).toBe(`${props.id}-desc`);

          cleanup();
        });
      }));
  });
});
