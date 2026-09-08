import { anchor, createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { Aria, ariaScope } from '../src/core.js';
import { aria } from '../src/index.js';
import { component } from './utils.js';

describe('Core - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('no-ops when ref() is invoked repeatedly with the identical element reference', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const onAttach = vi.fn();

        class TrackedAria extends Aria<HTMLDivElement> {
          protected override attach() {
            onAttach();
          }
        }

        const widget = new TrackedAria();
        const element = document.createElement('div');

        widget.ref(element);
        expect(onAttach).toHaveBeenCalledTimes(1);

        // Repeated bind with the exact same element instance
        widget.ref(element);
        expect(onAttach).toHaveBeenCalledTimes(1);
      });
    }));

  it('detaches cleanly and clears element reference when ref(null) is explicitly called', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const onDetach = vi.fn();

        class DetachableAria extends Aria<HTMLDivElement> {
          protected override attach() {
            return onDetach;
          }
        }

        const widget = new DetachableAria();
        const element = document.createElement('div');

        widget.ref(element);
        expect(widget.current).toBe(element);

        // Explicit unmount via ref(null)
        widget.ref(null);
        expect(onDetach).toHaveBeenCalledTimes(1);
        expect(widget.current).toBeNull();
      });
    }));

  it('executes detachment when the callback returned from ref() is invoked', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const onDetach = vi.fn();

        class TeardownAria extends Aria<HTMLDivElement> {
          protected override attach() {
            return onDetach;
          }
        }

        const widget = new TeardownAria();
        const element = document.createElement('div');

        const unbind = widget.ref(element);
        expect(onDetach).not.toHaveBeenCalled();

        // Invoke teardown callback directly
        unbind?.();
        expect(onDetach).toHaveBeenCalledTimes(1);
      });
    }));

  it('safely handles refiners returning void or undefined without corrupting attributes', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const state = mutable({ active: true });
        const widget = new Aria(state);

        // Registered refiners: conditional refiner tracking s.active and returning undefined when false
        widget.refine((s) => (s.active ? { role: 'status' } : (undefined as never)));
        widget.refine(() => undefined as never);

        expect(widget.attributes.role).toBe('status');

        // State mutation triggers observer: executes refiners loop with both truthy and undefined overrides
        state.active = false;
        expect(widget.attributes.role).toBeUndefined();
      });
    }));

  it('preserves layered refiner precedence and restores underlying attribute on unrefine', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();

        const unrefineBase = widget.refine(() => ({ 'aria-label': 'Base Label' }));
        expect(widget.attributes['aria-label']).toBe('Base Label');

        // Layered override
        const unrefineOverride = widget.refine(() => ({ 'aria-label': 'Overridden Label' }));
        expect(widget.attributes['aria-label']).toBe('Overridden Label');

        // Remove override -> base label is restored
        unrefineOverride();
        expect(widget.attributes['aria-label']).toBe('Base Label');

        // Remove base
        unrefineBase();
        expect(widget.attributes['aria-label']).toBeUndefined();
      });
    }));

  it('reuses existing reactive anchor state when passed in constructor props', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const reactiveState = mutable({ active: false });
        expect(anchor.has(reactiveState)).toBe(true);

        const widget = new Aria(reactiveState);
        expect(widget.props).toBe(reactiveState);
      });
    }));

  it('prevents horizontal context bleed between sibling components', () =>
    scope.run(() => {
      const treeA = component();
      let widgetA!: Aria;
      treeA.run(() => {
        widgetA = new Aria();
        expect(widgetA.scope).toBeUndefined();
      });

      // Sibling component B starts after component A finished
      const treeB = component();
      treeB.run(() => {
        const widgetB = new Aria();
        expect(widgetB.scope).toBeUndefined();
      });
    }));

  it('restores parent scope after child component finishes without upward bleed', () =>
    scope.run(() => {
      const parentTree = component();
      parentTree.run(() => {
        const parent = new Aria();
        expect(parent.scope).toBeUndefined();

        const child1Tree = component();
        child1Tree.run(() => {
          const child1 = new Aria();
          expect(child1.scope).toBe(parent);
        });

        // After child1 finishes, parent context should be restored
        expect(ariaScope.get()).toBe(parent);

        // A second child in parent should discover parent, not sibling child1
        const child2Tree = component();
        child2Tree.run(() => {
          const child2 = new Aria();
          expect(child2.scope).toBe(parent);
        });
      });
    }));

  it('prevents component scope from leaking into outer application scope', () =>
    scope.run(() => {
      expect(ariaScope.get()).toBeUndefined();

      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        expect(widget.scope).toBeUndefined();
        expect(ariaScope.get()).toBe(widget);
      });

      // Outside component tree, outer scope remains clean
      expect(ariaScope.get()).toBeUndefined();
    }));

  it('no-ops when ref(null) is called on an already unmounted controller', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        expect(widget.current).toBeNull();
        widget.ref(null);
        expect(widget.current).toBeNull();
      });
    }));

  it('handles initial refine callback returning undefined', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        widget.refine(() => undefined as never);
        expect(widget.attributes).toEqual({});
      });
    }));

  it('applies and clears CSS custom properties and falsy class via attribute synchronization', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const state = mutable<{ cls?: string; style?: Record<string, unknown> }>({
          cls: 'active',
          style: { '--custom-prop': '10px', color: 'red' },
        });
        const widget = new Aria(state);
        widget.refine((s) => ({
          class: s.cls,
          style: s.style as never,
        }));

        const el = document.createElement('div');
        widget.ref(el);

        expect(el.className).toBe('active');
        expect(el.style.getPropertyValue('--custom-prop')).toBe('10px');

        // Update to falsy class and empty style -> clears attributes
        state.cls = '';
        state.style = {};
        expect(el.hasAttribute('class')).toBe(false);
        expect(el.style.getPropertyValue('--custom-prop')).toBe('');
      });
    }));

  it('replaces previous event listener when handler reference updates', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        const state = mutable({ fn: handler1 });

        const widget = new Aria(state);
        widget.refine((s) => ({
          onclick: s.fn,
        }));

        const el = document.createElement('div');
        widget.ref(el);

        el.dispatchEvent(new MouseEvent('click'));
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).not.toHaveBeenCalled();

        // Update handler reference
        state.fn = handler2;
        el.dispatchEvent(new MouseEvent('click'));
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
      });
    }));

  it('retains event listener without re-binding when handler reference remains unchanged', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const handler = vi.fn();
        const state = mutable({ count: 0 });

        const widget = new Aria(state);
        widget.refine((s) => ({
          onclick: handler,
          'data-count': s.count,
        }));

        const el = document.createElement('div');
        widget.ref(el);

        state.count = 1;
        el.dispatchEvent(new MouseEvent('click'));
        expect(handler).toHaveBeenCalledTimes(1);
      });
    }));

  it('composes multiple refiner event handlers into a single chained listener', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const first = vi.fn();
        const second = vi.fn();
        const widget = new Aria();
        widget.refine(() => ({ onclick: first }));
        widget.refine(() => ({ onclick: second }));

        const el = document.createElement('div');
        widget.ref(el);

        el.dispatchEvent(new MouseEvent('click'));
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
      });
    }));

  it('removes style attribute when style is removed from attributes dictionary', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const state = mutable<{ showStyle: boolean }>({ showStyle: true });
        const widget = new Aria(state);
        widget.refine((s) => (s.showStyle ? { style: { color: 'blue' } } : {}));

        const el = document.createElement('div');
        widget.ref(el);
        expect(el.hasAttribute('style')).toBe(true);

        state.showStyle = false;
        expect(el.hasAttribute('style')).toBe(false);
      });
    }));

  it('clears style attribute when style property transitions to null through reactive state', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const state = mutable<{ style?: unknown }>({ style: { color: 'red' } });
        const widget = new Aria(state);
        widget.refine((s) => ({ style: s.style as never }));

        const el = document.createElement('div');
        widget.ref(el);
        expect(el.hasAttribute('style')).toBe(true);

        // Through the pipe: state transitions style to null
        state.style = null;
        expect(el.hasAttribute('style')).toBe(false);
      });
    }));

  it('safely no-ops attribute synchronization when bound to a non-Element target', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        widget.refine(() => ({ role: 'region' }));
        expect(() => widget.ref({} as never)).not.toThrow();
      });
    }));

  it('safely skips style application when target element lacks a style declaration property', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        widget.refine(() => ({ style: { color: 'blue' } }));
        const el = Object.create(Element.prototype);
        expect(() => widget.ref(el)).not.toThrow();
      });
    }));

  it('safely ignores non-function values supplied under event handler keys', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const state = mutable<{ clickHandler: unknown }>({ clickHandler: 'invalid' });
        const widget = new Aria(state);
        widget.refine((s) => ({ onclick: s.clickHandler as never }));

        const el = document.createElement('div');
        widget.ref(el);

        state.clickHandler = 123;
        expect(() => el.dispatchEvent(new MouseEvent('click'))).not.toThrow();
      });
    }));

  it('clears HTMLInputElement indeterminate property when attribute is removed', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const state = mutable<{ indeterminate?: boolean }>({ indeterminate: true });
        const widget = new Aria(state);
        widget.refine((s) => (s.indeterminate ? { indeterminate: true as never } : {}));

        const input = document.createElement('input');
        widget.ref(input);
        expect(input.indeterminate).toBe(true);

        delete state.indeterminate;
        expect(input.indeterminate).toBe(false);
      });
    }));

  it('throws an error for unsupported aria roles in aria() factory', () => {
    expect(() => aria('unsupported-role' as never)).toThrowError('Unsupported aria role: unsupported-role');
  });

  it('exposes ownKeys combining attributes and omittedAttrs', () => {
    const widget = new Aria();
    expect(widget.ownKeys).toBeInstanceOf(Array);
  });
});
