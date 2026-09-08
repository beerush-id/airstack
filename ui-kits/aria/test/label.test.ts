import { describe, expect, it, vi } from 'vitest';
import { bindLabel } from '../src/utils/label.js';

describe('Label - bindLabel', () => {
  it('returns undefined when element is not within a label', () => {
    const div = document.createElement('div');
    expect(bindLabel(div)).toBeUndefined();
  });

  it('binds click handler to enclosing label and triggers click on custom element', () => {
    const label = document.createElement('label');
    const customControl = document.createElement('span');
    const labelText = document.createElement('span');
    labelText.textContent = 'Toggle Switch';

    label.appendChild(customControl);
    label.appendChild(labelText);
    document.body.appendChild(label);

    const clickSpy = vi.fn();
    customControl.addEventListener('click', clickSpy);

    const unbind = bindLabel(customControl);
    expect(typeof unbind).toBe('function');

    // Click on label text
    labelText.click();
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Click directly on customControl - should not trigger duplicate click
    customControl.click();
    expect(clickSpy).toHaveBeenCalledTimes(2);

    // Detach listener
    unbind!();
    labelText.click();
    expect(clickSpy).toHaveBeenCalledTimes(2);

    label.remove();
  });

  it('suppresses click when target element is disabled or aria-disabled', () => {
    const label = document.createElement('label');
    const customControl = document.createElement('div');
    customControl.setAttribute('aria-disabled', 'true');
    const labelText = document.createElement('span');

    label.appendChild(customControl);
    label.appendChild(labelText);
    document.body.appendChild(label);

    const clickSpy = vi.fn();
    customControl.addEventListener('click', clickSpy);

    const unbind = bindLabel(customControl);

    labelText.click();
    expect(clickSpy).not.toHaveBeenCalled();

    unbind!();
    label.remove();
  });
});
