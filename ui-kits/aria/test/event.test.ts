import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventMap } from '../src/event.js';

class TestEventMap extends EventMap {
  public triggerNative(type: string, ...args: unknown[]): void {
    const entry = this.handlers.get(type);
    entry?.handler(...args);
  }

  public callAttachHandlers(): void {
    this.attachHandlers();
  }

  public callDetachHandlers(): void {
    this.detachHandlers();
  }

  public callAttachHandler(type: string): void {
    this.attachHandler(type);
  }

  public callDetachHandler(type: string): void {
    this.detachHandler(type);
  }

  public deleteListeners(type: string): void {
    this.listeners.delete(type);
  }
}

describe('EventMap', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement('div');
  });

  describe('initialization and element lifecycle', () => {
    it('initializes without an element and reports element as undefined', () => {
      const eventMap = new EventMap();
      expect(eventMap.element).toBeUndefined();
    });

    it('initializes with an element and returns it', () => {
      const eventMap = new EventMap(element);
      expect(eventMap.element).toBe(element);
    });

    it('ignores setting element to the identical instance', () => {
      const eventMap = new EventMap(element);
      const spyDetach = vi.spyOn(element, 'removeEventListener');
      eventMap.element = element;
      expect(spyDetach).not.toHaveBeenCalled();
    });

    it('queues handlers added before an element is attached and binds them on assignment', () => {
      const eventMap = new EventMap();
      const handler = vi.fn();

      eventMap.add('click', handler);
      expect(eventMap.element).toBeUndefined();

      eventMap.element = element;
      element.dispatchEvent(new MouseEvent('click'));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('detaches handlers and does not reattach when element is set to undefined', () => {
      const eventMap = new EventMap(element);
      const handler = vi.fn();
      const spyRemove = vi.spyOn(element, 'removeEventListener');

      eventMap.add('click', handler);
      eventMap.element = undefined;

      expect(eventMap.element).toBeUndefined();
      expect(spyRemove).toHaveBeenCalledWith('click', expect.any(Function));

      element.dispatchEvent(new MouseEvent('click'));
      expect(handler).not.toHaveBeenCalled();
    });

    it('handles setting element to undefined when already undefined', () => {
      const eventMap = new EventMap();
      expect(() => {
        eventMap.element = undefined;
      }).not.toThrow();
      expect(eventMap.element).toBeUndefined();
    });

    it('detaches from old element and attaches to new element', () => {
      const newElement = document.createElement('div');
      const spyOldRemove = vi.spyOn(element, 'removeEventListener');
      const spyNewAdd = vi.spyOn(newElement, 'addEventListener');

      const eventMap = new EventMap(element);
      const handler = vi.fn();
      eventMap.add('focus', handler);

      eventMap.element = newElement;

      expect(spyOldRemove).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(spyNewAdd).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(eventMap.element).toBe(newElement);

      element.dispatchEvent(new FocusEvent('focus'));
      expect(handler).not.toHaveBeenCalled();

      newElement.dispatchEvent(new FocusEvent('focus'));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('event registration and forwarding', () => {
    it('forwards event arguments to registered listeners', () => {
      const eventMap = new EventMap(element);
      const handler = vi.fn();

      eventMap.add('click', handler);

      const event = new MouseEvent('click');
      element.dispatchEvent(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('dispatches to multiple listeners for the same event type', () => {
      const eventMap = new EventMap(element);
      const first = vi.fn();
      const second = vi.fn();

      eventMap.add('custom', first);
      eventMap.add('custom', second);

      const event = new CustomEvent('custom', { detail: { value: 42 } });
      element.dispatchEvent(event);

      expect(first).toHaveBeenCalledTimes(1);
      expect(first).toHaveBeenCalledWith(event);
      expect(second).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledWith(event);
    });

    it('normalizes event names stripping "on" and "on:" prefixes', () => {
      const eventMap = new EventMap(element);
      const clickHandler = vi.fn();
      const keyHandler = vi.fn();

      eventMap.add('onClick', clickHandler);
      eventMap.add('on:keydown', keyHandler);

      element.dispatchEvent(new MouseEvent('click'));
      element.dispatchEvent(new KeyboardEvent('keydown'));

      expect(clickHandler).toHaveBeenCalledTimes(1);
      expect(keyHandler).toHaveBeenCalledTimes(1);

      // Verify remove works with normalized name as well
      eventMap.remove('click', clickHandler);
      element.dispatchEvent(new MouseEvent('click'));
      expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    it('returns a dispose function that unregisters the callback', () => {
      const eventMap = new EventMap(element);
      const handler = vi.fn();

      const dispose = eventMap.add('click', handler);

      element.dispatchEvent(new MouseEvent('click'));
      expect(handler).toHaveBeenCalledTimes(1);

      dispose();

      element.dispatchEvent(new MouseEvent('click'));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('listener removal and cleanup', () => {
    it('removes a specific listener while keeping other listeners active', () => {
      const eventMap = new EventMap(element);
      const first = vi.fn();
      const second = vi.fn();

      eventMap.add('click', first);
      eventMap.add('click', second);

      eventMap.remove('click', first);

      element.dispatchEvent(new MouseEvent('click'));

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('ignores removing an unregistered handler or unknown event type', () => {
      const eventMap = new EventMap(element);
      const handler = vi.fn();

      expect(() => eventMap.remove('nonexistent')).not.toThrow();

      eventMap.add('click', handler);
      expect(() => eventMap.remove('click', vi.fn())).not.toThrow();

      element.dispatchEvent(new MouseEvent('click'));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('detaches the native listener when the last listener is removed', () => {
      const spyRemove = vi.spyOn(element, 'removeEventListener');
      const eventMap = new EventMap(element);
      const handler = vi.fn();

      eventMap.add('click', handler);
      eventMap.remove('click', handler);

      expect(spyRemove).toHaveBeenCalledWith('click', expect.any(Function));

      element.dispatchEvent(new MouseEvent('click'));
      expect(handler).not.toHaveBeenCalled();
    });

    it('detaches native listener when removing all listeners of an event type', () => {
      const spyRemove = vi.spyOn(element, 'removeEventListener');
      const eventMap = new EventMap(element);
      const first = vi.fn();
      const second = vi.fn();

      eventMap.add('keydown', first);
      eventMap.add('keydown', second);

      eventMap.remove('keydown');

      expect(spyRemove).toHaveBeenCalledWith('keydown', expect.any(Function));

      element.dispatchEvent(new KeyboardEvent('keydown'));
      expect(first).not.toHaveBeenCalled();
      expect(second).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle teardown', () => {
    it('removes all active listeners and unbinds element when destroyed', () => {
      const spyRemove = vi.spyOn(element, 'removeEventListener');
      const eventMap = new EventMap(element);
      const clickHandler = vi.fn();
      const hoverHandler = vi.fn();

      eventMap.add('click', clickHandler);
      eventMap.add('mouseenter', hoverHandler);

      eventMap.destroy();

      expect(eventMap.element).toBeUndefined();
      expect(spyRemove).toHaveBeenCalledWith('click', expect.any(Function));
      expect(spyRemove).toHaveBeenCalledWith('mouseenter', expect.any(Function));

      element.dispatchEvent(new MouseEvent('click'));
      element.dispatchEvent(new MouseEvent('mouseenter'));

      expect(clickHandler).not.toHaveBeenCalled();
      expect(hoverHandler).not.toHaveBeenCalled();
    });

    it('safely destroys an instance that had no element attached', () => {
      const eventMap = new EventMap();
      eventMap.add('click', vi.fn());
      expect(() => eventMap.destroy()).not.toThrow();
    });
  });

  describe('dispatch isolation', () => {
    it('safely iterates when a listener removes itself during execution', () => {
      const eventMap = new EventMap(element);
      const second = vi.fn();

      const selfRemoving = vi.fn(() => {
        eventMap.remove('click', selfRemoving);
      });

      eventMap.add('click', selfRemoving);
      eventMap.add('click', second);

      element.dispatchEvent(new MouseEvent('click'));

      expect(selfRemoving).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);

      element.dispatchEvent(new MouseEvent('click'));

      expect(selfRemoving).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases and defensive branches', () => {
    it('safely handles attaching and detaching handlers when element is undefined', () => {
      const eventMap = new TestEventMap();
      expect(() => eventMap.callAttachHandlers()).not.toThrow();
      expect(() => eventMap.callDetachHandlers()).not.toThrow();
      expect(() => eventMap.callAttachHandler('click')).not.toThrow();
      expect(() => eventMap.callDetachHandler('click')).not.toThrow();
    });

    it('safely handles non-existent or unattached handlers when element is defined', () => {
      const eventMap = new TestEventMap(element);
      // Non-existent handler
      expect(() => eventMap.callAttachHandler('unknown')).not.toThrow();
      expect(() => eventMap.callDetachHandler('unknown')).not.toThrow();

      // Handler exists but has no active listeners
      eventMap.add('click', vi.fn());
      eventMap.remove('click');
      expect(() => eventMap.callAttachHandler('click')).not.toThrow();
      expect(() => eventMap.callDetachHandler('click')).not.toThrow();
    });

    it('safely exits native handler if listeners set is missing during execution', () => {
      const eventMap = new TestEventMap(element);
      const handler = vi.fn();

      eventMap.add('custom', handler);
      eventMap.deleteListeners('custom');

      expect(() => {
        eventMap.triggerNative('custom', new CustomEvent('custom'));
      }).not.toThrow();

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
