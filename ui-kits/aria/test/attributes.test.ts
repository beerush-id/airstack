import { describe, expect, it } from 'vitest';
import { applyAttributes, applyStyles } from '../src/utils/attributes.js';

describe('applyAttributes', () => {
  it('ignores a missing or non-element target', () => {
    expect(() => applyAttributes(null as never, { id: 'x' })).not.toThrow();
    expect(() => applyAttributes({} as never, { id: 'x' })).not.toThrow();
  });

  it('clears the indeterminate property when it leaves the attribute set', () => {
    const input = document.createElement('input');
    input.indeterminate = true;

    applyAttributes(input, {}, { indeterminate: true } as never);

    expect(input.indeterminate).toBe(false);
  });

  it('skips an attribute whose value has not changed', () => {
    const el = document.createElement('div');
    el.setAttribute('aria-label', 'Name');

    applyAttributes(el, { 'aria-label': 'Name' } as never, { 'aria-label': 'Name' } as never);

    expect(el.getAttribute('aria-label')).toBe('Name');
  });

  it('sets a class from class or className and removes it when the value goes empty', () => {
    const el = document.createElement('div');

    applyAttributes(el, { className: 'a b' } as never);
    expect(el.getAttribute('class')).toBe('a b');

    applyAttributes(el, { class: '' } as never, { className: 'a b' } as never);
    expect(el.hasAttribute('class')).toBe(false);
  });

  it('writes an empty string for a null value on an input', () => {
    const input = document.createElement('input');
    input.value = 'stale';

    applyAttributes(input, { value: null } as never);

    expect(input.value).toBe('');
  });

  it('renders true as a bare attribute and drops false, null, and undefined', () => {
    const el = document.createElement('div');

    applyAttributes(el, { disabled: true, hidden: false, role: null, title: undefined } as never);

    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('title')).toBe(false);
  });
});

describe('applyStyles', () => {
  it('removes the style attribute when the style value is dropped', () => {
    const el = document.createElement('div');
    el.setAttribute('style', 'color: red');

    applyStyles(el, undefined);

    expect(el.hasAttribute('style')).toBe(false);
  });

  it('leaves an element without a style surface untouched', () => {
    const el = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');

    expect(() => applyStyles(el as never, { color: 'red' })).not.toThrow();
    expect('style' in el).toBe(false);
  });

  it('writes custom properties and plain properties from one object', () => {
    const el = document.createElement('div');

    applyStyles(el, { '--aria-offset': '40%', color: 'red' });

    expect(el.style.getPropertyValue('--aria-offset')).toBe('40%');
    expect(el.style.color).toBe('red');
  });
});
