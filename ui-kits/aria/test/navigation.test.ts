import { describe, expect, it, vi } from 'vitest';
import { handleRovingKey } from '../src/utils/navigation.js';

describe('Navigation - handleRovingKey', () => {
  it('navigates next and previous with wrapping in vertical orientation', () => {
    const container = document.createElement('div');
    const item1 = document.createElement('button');
    const item2 = document.createElement('button');
    const item3 = document.createElement('button');

    item1.className = 'item';
    item2.className = 'item';
    item3.className = 'item';

    container.appendChild(item1);
    container.appendChild(item2);
    container.appendChild(item3);
    document.body.appendChild(container);

    const clickSpy = vi.fn();
    item2.addEventListener('click', clickSpy);

    // Initial focus on item1
    item1.focus();

    // ArrowDown -> item2
    const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    const handled = handleRovingKey(container, downEvent, {
      selector: '.item',
      orientation: 'vertical',
    });

    expect(handled).toBe(true);
    expect(downEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(item2);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // ArrowDown from item3 -> wraps to item1
    item3.focus();
    const wrapDown = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    handleRovingKey(container, wrapDown, { selector: '.item', orientation: 'vertical' });
    expect(document.activeElement).toBe(item1);

    // ArrowUp from item1 -> wraps to item3
    item1.focus();
    const wrapUp = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
    handleRovingKey(container, wrapUp, { selector: '.item', orientation: 'vertical' });
    expect(document.activeElement).toBe(item3);

    container.remove();
  });

  it('navigates next and previous with wrapping in horizontal orientation', () => {
    const container = document.createElement('div');
    const item1 = document.createElement('button');
    const item2 = document.createElement('button');

    item1.className = 'tab';
    item2.className = 'tab';

    container.appendChild(item1);
    container.appendChild(item2);
    document.body.appendChild(container);

    item1.focus();

    // ArrowRight -> item2
    const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    const handled = handleRovingKey(container, rightEvent, {
      selector: '.tab',
      orientation: 'horizontal',
    });

    expect(handled).toBe(true);
    expect(rightEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(item2);

    // ArrowLeft -> item1
    const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
    handleRovingKey(container, leftEvent, { selector: '.tab', orientation: 'horizontal' });
    expect(document.activeElement).toBe(item1);

    container.remove();
  });

  it('navigates to Home and End positions', () => {
    const container = document.createElement('div');
    const item1 = document.createElement('button');
    const item2 = document.createElement('button');
    const item3 = document.createElement('button');

    item1.className = 'radio';
    item2.className = 'radio';
    item3.className = 'radio';

    container.appendChild(item1);
    container.appendChild(item2);
    container.appendChild(item3);
    document.body.appendChild(container);

    item2.focus();

    // Home -> item1
    const homeEvent = new KeyboardEvent('keydown', { key: 'Home', cancelable: true });
    handleRovingKey(container, homeEvent, { selector: '.radio' });
    expect(document.activeElement).toBe(item1);

    // End -> item3
    const endEvent = new KeyboardEvent('keydown', { key: 'End', cancelable: true });
    handleRovingKey(container, endEvent, { selector: '.radio' });
    expect(document.activeElement).toBe(item3);

    container.remove();
  });

  it('supports manual mode without invoking click()', () => {
    const container = document.createElement('div');
    const item1 = document.createElement('button');
    const item2 = document.createElement('button');

    item1.className = 'item';
    item2.className = 'item';

    container.appendChild(item1);
    container.appendChild(item2);
    document.body.appendChild(container);

    const clickSpy = vi.fn();
    item2.addEventListener('click', clickSpy);

    item1.focus();

    const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    handleRovingKey(container, downEvent, {
      selector: '.item',
      manual: true,
    });

    expect(document.activeElement).toBe(item2);
    expect(clickSpy).not.toHaveBeenCalled();

    container.remove();
  });

  it('focuses first or last item when no item is initially focused', () => {
    const container = document.createElement('div');
    const item1 = document.createElement('button');
    const item2 = document.createElement('button');
    item1.className = 'item';
    item2.className = 'item';
    container.appendChild(item1);
    container.appendChild(item2);
    document.body.appendChild(container);

    // Explicitly blur
    (document.activeElement as HTMLElement)?.blur?.();

    // ArrowDown with nothing focused -> first item (index 0)
    const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    handleRovingKey(container, downEvent, { selector: '.item' });
    expect(document.activeElement).toBe(item1);

    (document.activeElement as HTMLElement)?.blur?.();

    // ArrowUp with nothing focused -> last item (index 1)
    const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
    handleRovingKey(container, upEvent, { selector: '.item' });
    expect(document.activeElement).toBe(item2);

    (document.activeElement as HTMLElement)?.blur?.();

    // ArrowRight with nothing focused in horizontal mode -> first item
    const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    handleRovingKey(container, rightEvent, { selector: '.item', orientation: 'horizontal' });
    expect(document.activeElement).toBe(item1);

    (document.activeElement as HTMLElement)?.blur?.();

    // ArrowLeft with nothing focused in horizontal mode -> last item
    const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
    handleRovingKey(container, leftEvent, { selector: '.item', orientation: 'horizontal' });
    expect(document.activeElement).toBe(item2);

    container.remove();
  });

  it('falls back to document when container lacks getRootNode', () => {
    const container = document.createElement('div');
    const item = document.createElement('button');
    item.className = 'item';
    container.appendChild(item);
    document.body.appendChild(container);

    // Mock container without getRootNode
    Object.defineProperty(container, 'getRootNode', { value: undefined });

    const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    expect(handleRovingKey(container, downEvent, { selector: '.item' })).toBe(true);
    expect(document.activeElement).toBe(item);

    container.remove();
  });

  it('returns false for unhandled keys or empty containers', () => {
    expect(handleRovingKey(null, new KeyboardEvent('keydown', { key: 'ArrowDown' }), { selector: '.item' })).toBe(
      false
    );

    const container = document.createElement('div');
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    expect(handleRovingKey(container, tabEvent, { selector: '.item' })).toBe(false);

    const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    expect(handleRovingKey(container, downEvent, { selector: '.item' })).toBe(false);
  });

  it('handles navigation when activeElement is null', () => {
    const container = document.createElement('div');
    const item = document.createElement('button');
    item.className = 'item';
    container.appendChild(item);
    document.body.appendChild(container);

    const spy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null);
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    expect(handleRovingKey(container, event, { selector: '.item', orientation: 'horizontal' })).toBe(true);
    spy.mockRestore();

    container.remove();
  });
});
