import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { currentAria } from '../src/context.js';
import { Aria } from '../src/core.js';
import type { AriaAttributes, AriaProps } from '../src/types.js';
import { bind, component } from './utils.js';

describe('Core Events - Units & Integrations', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Lifecycle & Element Binding', () => {
    it('omits event handlers from .attributes while binding them directly to DOM upon mount', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const handleClick = vi.fn();
          const widget = new Aria();
          widget.refine(() => ({
            role: 'button',
            onclick: handleClick,
          }));

          // SSR / template spread phase: attributes must not contain onclick
          expect(widget.attributes.role).toBe('button');
          expect((widget.attributes as Record<string, unknown>).onclick).toBeUndefined();

          // Framework element mount
          const element = document.createElement('button');
          bind(element, widget);

          element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          expect(handleClick).toHaveBeenCalledTimes(1);
        });
      }));

    it('transfers active event listeners seamlessly across element re-binding and silences old elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const handleClick = vi.fn();
          const widget = new Aria();
          widget.refine(() => ({ onclick: handleClick }));

          const elementA = document.createElement('button');
          const elementB = document.createElement('button');

          // Mount to Element A
          widget.ref(elementA);
          elementA.dispatchEvent(new MouseEvent('click'));
          expect(handleClick).toHaveBeenCalledTimes(1);

          // Node transfer: Re-bind to Element B
          widget.ref(elementB);

          // Element A is completely detached and must not respond to clicks
          elementA.dispatchEvent(new MouseEvent('click'));
          expect(handleClick).toHaveBeenCalledTimes(1);

          // Element B receives the click
          elementB.dispatchEvent(new MouseEvent('click'));
          expect(handleClick).toHaveBeenCalledTimes(2);
        });
      }));

    it('silences events on unmount (ref(null)) and restores them upon subsequent remount', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const handleClick = vi.fn();
          const widget = new Aria();
          widget.refine(() => ({ onclick: handleClick }));

          const element = document.createElement('button');
          widget.ref(element);

          element.dispatchEvent(new MouseEvent('click'));
          expect(handleClick).toHaveBeenCalledTimes(1);

          // Unmount element
          widget.ref(null);
          expect(widget.current).toBeNull();

          element.dispatchEvent(new MouseEvent('click'));
          expect(handleClick).toHaveBeenCalledTimes(1);

          // Remount to fresh DOM node
          const remounted = document.createElement('button');
          widget.ref(remounted);

          remounted.dispatchEvent(new MouseEvent('click'));
          expect(handleClick).toHaveBeenCalledTimes(2);
        });
      }));

    it('destroys all event subscriptions when virtual component tree unmounts', () =>
      scope.run(() => {
        const tree = component();
        const handleClick = vi.fn();
        const element = document.createElement('button');

        tree.run(() => {
          const widget = new Aria();
          widget.refine(() => ({ onclick: handleClick }));
          widget.ref(element);

          element.dispatchEvent(new MouseEvent('click'));
          expect(handleClick).toHaveBeenCalledTimes(1);
        });

        // Virtual component tree teardown
        tree.destroy();

        element.dispatchEvent(new MouseEvent('click'));
        expect(handleClick).toHaveBeenCalledTimes(1);
      }));

    it('tracks ambient focus and blur across controller instances', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const first = new Aria();
          const second = new Aria();

          const el1 = document.createElement('button');
          const el2 = document.createElement('button');

          first.ref(el1);
          second.ref(el2);

          // Focus first element
          el1.dispatchEvent(new FocusEvent('focus'));
          expect(currentAria.get()).toBe(first);

          // Direct focus handoff to second element
          el2.dispatchEvent(new FocusEvent('focus'));
          expect(currentAria.get()).toBe(second);

          // Stale blur on first element must not clear active second controller
          el1.dispatchEvent(new FocusEvent('blur'));
          expect(currentAria.get()).toBe(second);

          // Blur second element clears ambient focus
          el2.dispatchEvent(new FocusEvent('blur'));
          expect(currentAria.get()).toBeUndefined();
        });
      }));
  });

  describe('Event Composition & Coexistence', () => {
    it('composes own attributes and multiple refiners on the same event type without collisions', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const ownAction = vi.fn();
          const pluginAction = vi.fn();
          const analyticsAction = vi.fn();

          class ActionButton extends Aria<HTMLButtonElement> {
            public constructor() {
              super();
              this.update();
            }

            protected override createAttributes(): AriaAttributes<HTMLButtonElement> {
              return {
                role: 'button',
                onclick: ownAction,
              };
            }
          }

          const button = new ActionButton();

          // Layer plugin 1
          button.refine(() => ({ onclick: pluginAction }));

          // Layer plugin 2
          button.refine(() => ({ onclick: analyticsAction }));

          const element = document.createElement('button');
          button.ref(element);

          element.dispatchEvent(new MouseEvent('click'));

          // All three subscribers must execute without overwriting each other
          expect(ownAction).toHaveBeenCalledTimes(1);
          expect(pluginAction).toHaveBeenCalledTimes(1);
          expect(analyticsAction).toHaveBeenCalledTimes(1);
        });
      }));

    it('allows clean unregistration of a single refiner without affecting own events or other refiners', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const ownAction = vi.fn();
          const featureA = vi.fn();
          const featureB = vi.fn();

          class ActionButton extends Aria<HTMLButtonElement> {
            public constructor() {
              super();
              this.update();
            }

            protected override createAttributes(): AriaAttributes<HTMLButtonElement> {
              return { onclick: ownAction };
            }
          }

          const button = new ActionButton();

          const unregisterA = button.refine(() => ({ onclick: featureA }));
          button.refine(() => ({ onclick: featureB }));

          const element = document.createElement('button');
          button.ref(element);

          // Initial click: all three fire
          element.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(1);
          expect(featureA).toHaveBeenCalledTimes(1);
          expect(featureB).toHaveBeenCalledTimes(1);

          // Detach feature A
          unregisterA();

          // Second click: feature A is dead, own action and feature B continue
          element.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(2);
          expect(featureA).toHaveBeenCalledTimes(1);
          expect(featureB).toHaveBeenCalledTimes(2);
        });
      }));

    it('supports direct subscription via widget.events.add() returning an unregister dispose callback', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const widget = new Aria();
          const element = document.createElement('button');
          widget.ref(element);

          const directHandler = vi.fn();
          const unbind = widget.events.add('click', directHandler);

          element.dispatchEvent(new MouseEvent('click'));
          expect(directHandler).toHaveBeenCalledTimes(1);

          // Call returned dispose function to unbind
          unbind();

          element.dispatchEvent(new MouseEvent('click'));
          expect(directHandler).toHaveBeenCalledTimes(1);
        });
      }));

    it('normalizes event names across "onclick", "on:click", and "click" to the same native dispatch', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const widget = new Aria();
          const element = document.createElement('button');
          widget.ref(element);

          const h1 = vi.fn();
          const h2 = vi.fn();
          const h3 = vi.fn();

          const unbind1 = widget.events.add('onclick', h1);
          const unbind2 = widget.events.add('on:click', h2);
          const unbind3 = widget.events.add('click', h3);

          element.dispatchEvent(new MouseEvent('click'));
          expect(h1).toHaveBeenCalledTimes(1);
          expect(h2).toHaveBeenCalledTimes(1);
          expect(h3).toHaveBeenCalledTimes(1);

          // Unbinding with normalized name
          unbind1();
          unbind2();
          unbind3();

          element.dispatchEvent(new MouseEvent('click'));
          expect(h1).toHaveBeenCalledTimes(1);
          expect(h2).toHaveBeenCalledTimes(1);
          expect(h3).toHaveBeenCalledTimes(1);
        });
      }));
  });

  describe('Reactive Dynamics & State Transitions', () => {
    it('updates refiner event handler when reactive state changes and drops previous handler', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const state = mutable({ active: false });
          const inactiveClick = vi.fn();
          const activeClick = vi.fn();

          const widget = new Aria(state);
          widget.refine((s) => ({
            onclick: s.active ? activeClick : inactiveClick,
          }));

          const element = document.createElement('button');
          widget.ref(element);

          // State = inactive
          element.dispatchEvent(new MouseEvent('click'));
          expect(inactiveClick).toHaveBeenCalledTimes(1);
          expect(activeClick).not.toHaveBeenCalled();

          // Transition: Mutate state -> active
          state.active = true;

          // Event dispatches to new handler, old handler does not fire
          element.dispatchEvent(new MouseEvent('click'));
          expect(inactiveClick).toHaveBeenCalledTimes(1);
          expect(activeClick).toHaveBeenCalledTimes(1);
        });
      }));

    it('dynamically introduces a new event type on state change and binds to the live DOM node', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const state = mutable({ editable: false });
          const onKey = vi.fn();

          const widget = new Aria(state);
          widget.refine((s) => (s.editable ? { onkeydown: onKey } : {}));

          const element = document.createElement('div');
          widget.ref(element);

          element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
          expect(onKey).not.toHaveBeenCalled();

          // Enable editable state
          state.editable = true;

          element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
          expect(onKey).toHaveBeenCalledTimes(1);
        });
      }));

    it('dynamically drops an event type on state change and detaches from the live DOM node', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const state = mutable({ listening: true });
          const onMove = vi.fn();

          const widget = new Aria(state);
          widget.refine((s) => (s.listening ? { onpointermove: onMove } : {}));

          const element = document.createElement('div');
          widget.ref(element);

          element.dispatchEvent(new PointerEvent('pointermove'));
          expect(onMove).toHaveBeenCalledTimes(1);

          // Turn off listening
          state.listening = false;

          element.dispatchEvent(new PointerEvent('pointermove'));
          expect(onMove).toHaveBeenCalledTimes(1);
        });
      }));
  });

  describe('DOM Behaviors & Defensive Edge Cases', () => {
    it('forwards native Event objects, supports preventDefault, and preserves event bubbling', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const widget = new Aria();
          let capturedEvent: MouseEvent | undefined;

          widget.refine(() => ({
            onclick: (e: MouseEvent) => {
              capturedEvent = e;
              e.preventDefault();
            },
          }));

          const element = document.createElement('button');
          widget.ref(element);

          const event = new MouseEvent('click', { bubbles: true, cancelable: true });
          element.dispatchEvent(event);

          expect(capturedEvent).toBe(event);
          expect(event.defaultPrevented).toBe(true);
        });
      }));

    it('forwards CustomEvent payloads accurately to all subscribers', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const widget = new Aria();
          const onCustom = vi.fn();

          widget.events.add('item-select', onCustom);

          const element = document.createElement('div');
          widget.ref(element);

          const customEvent = new CustomEvent('item-select', { detail: { itemId: 42, label: 'Selected' } });
          element.dispatchEvent(customEvent);

          expect(onCustom).toHaveBeenCalledWith(customEvent);
          expect((onCustom.mock.calls[0][0] as CustomEvent).detail).toEqual({ itemId: 42, label: 'Selected' });
        });
      }));

    it('safely handles a refiner unregistering itself inside its own event callback', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const widget = new Aria();
          const siblingClick = vi.fn();

          let unregisterSelf: (() => void) | undefined;
          const onceClick = vi.fn(() => {
            unregisterSelf?.();
          });

          unregisterSelf = widget.refine(() => ({ onclick: onceClick }));
          widget.refine(() => ({ onclick: siblingClick }));

          const element = document.createElement('button');
          widget.ref(element);

          // First click: both fire, self-unregister occurs
          element.dispatchEvent(new MouseEvent('click'));
          expect(onceClick).toHaveBeenCalledTimes(1);
          expect(siblingClick).toHaveBeenCalledTimes(1);

          // Second click: onceClick is dead, siblingClick still receives events
          element.dispatchEvent(new MouseEvent('click'));
          expect(onceClick).toHaveBeenCalledTimes(1);
          expect(siblingClick).toHaveBeenCalledTimes(2);
        });
      }));
  });

  describe('Mixed Event Paths & Controller.on() Interoperability', () => {
    it('composes own attributes, refiners, and .on() listeners concurrently on the same event type', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const ownAction = vi.fn();
          const refinerAction = vi.fn();
          const onAction = vi.fn();

          class ActionButton extends Aria<HTMLButtonElement> {
            public constructor() {
              super();
              this.update();
            }

            protected override createAttributes(): AriaAttributes<HTMLButtonElement> {
              return { onclick: ownAction };
            }
          }

          const button = new ActionButton();
          const unrefine = button.refine(() => ({ onclick: refinerAction }));
          const releaseOn = button.on('click', onAction);

          const element = document.createElement('button');
          button.ref(element);

          // All three paths fire on dispatch
          element.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(1);
          expect(refinerAction).toHaveBeenCalledTimes(1);
          expect(onAction).toHaveBeenCalledTimes(1);

          // Release only the .on() subscription
          releaseOn();

          element.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(2);
          expect(refinerAction).toHaveBeenCalledTimes(2);
          expect(onAction).toHaveBeenCalledTimes(1);

          // Release the refiner
          unrefine();

          element.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(3);
          expect(refinerAction).toHaveBeenCalledTimes(2);
          expect(onAction).toHaveBeenCalledTimes(1);
        });
      }));

    it('preserves pre-mount .on() subscriptions across node attachment, swap, unmount, and remount', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const ownAction = vi.fn();
          const refinerAction = vi.fn();
          const onAction = vi.fn();

          class ActionButton extends Aria<HTMLButtonElement> {
            public constructor() {
              super();
              this.update();
            }

            protected override createAttributes(): AriaAttributes<HTMLButtonElement> {
              return { onclick: ownAction };
            }
          }

          const button = new ActionButton();
          button.refine(() => ({ onclick: refinerAction }));

          // Register .on() BEFORE element attachment
          button.on('click', onAction);

          const elA = document.createElement('button');
          const elB = document.createElement('button');
          const elC = document.createElement('button');

          // 1. Initial Mount to Element A
          button.ref(elA);
          elA.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(1);
          expect(refinerAction).toHaveBeenCalledTimes(1);
          expect(onAction).toHaveBeenCalledTimes(1);

          // 2. Element Swap to Element B
          button.ref(elB);

          // Stale Element A must no longer fire any handlers
          elA.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(1);
          expect(refinerAction).toHaveBeenCalledTimes(1);
          expect(onAction).toHaveBeenCalledTimes(1);

          // Live Element B receives all mixed events
          elB.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(2);
          expect(refinerAction).toHaveBeenCalledTimes(2);
          expect(onAction).toHaveBeenCalledTimes(2);

          // 3. Unmount (ref(null))
          button.ref(null);
          elB.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(2);
          expect(refinerAction).toHaveBeenCalledTimes(2);
          expect(onAction).toHaveBeenCalledTimes(2);

          // 4. Remount to Element C
          button.ref(elC);
          elC.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(3);
          expect(refinerAction).toHaveBeenCalledTimes(3);
          expect(onAction).toHaveBeenCalledTimes(3);
        });
      }));

    it('prevents event duplication or dropping when reactive state updates trigger internal re-synchronization', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const state = mutable({ count: 0, label: 'initial' });
          const ownAction = vi.fn();
          const refinerAction = vi.fn();
          const onAction = vi.fn();

          class CounterWidget extends Aria<HTMLButtonElement, typeof state> {
            public constructor() {
              super(state);
              this.update();
            }

            protected override createAttributes(): AriaAttributes<HTMLButtonElement> {
              return {
                'aria-label': this.properties.label,
                onclick: ownAction,
              };
            }
          }

          const widget = new CounterWidget();
          widget.refine(() => ({ onclick: refinerAction }));
          widget.on('click', onAction);

          const element = document.createElement('button');
          widget.ref(element);

          element.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(1);
          expect(refinerAction).toHaveBeenCalledTimes(1);
          expect(onAction).toHaveBeenCalledTimes(1);

          // Mutate state multiple times, causing observer updates
          state.count = 1;
          state.label = 'updated';
          state.count = 2;

          // Dispatch click: every mixed handler should fire exactly once more (no duplicate listeners attached)
          element.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(2);
          expect(refinerAction).toHaveBeenCalledTimes(2);
          expect(onAction).toHaveBeenCalledTimes(2);
        });
      }));

    it('supports self-releasing .on() callbacks without disrupting active sibling handlers', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const ownAction = vi.fn();
          const refinerAction = vi.fn();

          class ActionButton extends Aria<HTMLButtonElement> {
            public constructor() {
              super();
              this.update();
            }

            protected override createAttributes(): AriaAttributes<HTMLButtonElement> {
              return { onclick: ownAction };
            }
          }

          const button = new ActionButton();
          button.refine(() => ({ onclick: refinerAction }));

          let releaseOnce: (() => void) | undefined;
          const onceAction = vi.fn(() => {
            releaseOnce?.();
          });
          releaseOnce = button.on('click', onceAction);

          const element = document.createElement('button');
          button.ref(element);

          // First click: all three fire, onceAction releases itself
          element.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(1);
          expect(refinerAction).toHaveBeenCalledTimes(1);
          expect(onceAction).toHaveBeenCalledTimes(1);

          // Second click: onceAction is released, own and refiner actions continue
          element.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(2);
          expect(refinerAction).toHaveBeenCalledTimes(2);
          expect(onceAction).toHaveBeenCalledTimes(1);
        });
      }));

    it('isolates multiple .on() subscriptions allowing selective disposal while preserving refiners', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const button = new Aria<HTMLButtonElement>();
          const refinerAction = vi.fn();
          button.refine(() => ({ onclick: refinerAction }));

          const handler1 = vi.fn();
          const handler2 = vi.fn();
          const handler3 = vi.fn();

          const release1 = button.on('click', handler1);
          const release2 = button.on('click', handler2);
          const release3 = button.on('click', handler3);

          const element = document.createElement('button');
          button.ref(element);

          element.dispatchEvent(new MouseEvent('click'));
          expect(refinerAction).toHaveBeenCalledTimes(1);
          expect(handler1).toHaveBeenCalledTimes(1);
          expect(handler2).toHaveBeenCalledTimes(1);
          expect(handler3).toHaveBeenCalledTimes(1);

          // Release only handler2
          release2();

          element.dispatchEvent(new MouseEvent('click'));
          expect(refinerAction).toHaveBeenCalledTimes(2);
          expect(handler1).toHaveBeenCalledTimes(2);
          expect(handler2).toHaveBeenCalledTimes(1);
          expect(handler3).toHaveBeenCalledTimes(2);

          // Release handler1 and handler3
          release1();
          release3();

          element.dispatchEvent(new MouseEvent('click'));
          expect(refinerAction).toHaveBeenCalledTimes(3);
          expect(handler1).toHaveBeenCalledTimes(2);
          expect(handler2).toHaveBeenCalledTimes(1);
          expect(handler3).toHaveBeenCalledTimes(2);
        });
      }));

    it('tears down all mixed event handlers upon widget destruction and safely ignores post-destruction releases', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const ownAction = vi.fn();
          const refinerAction = vi.fn();
          const onAction = vi.fn();

          class ActionButton extends Aria<HTMLButtonElement> {
            public constructor() {
              super();
              this.update();
            }

            protected override createAttributes(): AriaAttributes<HTMLButtonElement> {
              return { onclick: ownAction };
            }
          }

          const button = new ActionButton();
          button.refine(() => ({ onclick: refinerAction }));
          const releaseOn = button.on('click', onAction);

          const element = document.createElement('button');
          button.ref(element);

          element.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(1);
          expect(refinerAction).toHaveBeenCalledTimes(1);
          expect(onAction).toHaveBeenCalledTimes(1);

          // Destroy widget
          button.destroy();

          // No handlers should fire after destruction
          element.dispatchEvent(new MouseEvent('click'));
          expect(ownAction).toHaveBeenCalledTimes(1);
          expect(refinerAction).toHaveBeenCalledTimes(1);
          expect(onAction).toHaveBeenCalledTimes(1);

          // Post-destruction release call must be safe and not throw
          expect(() => releaseOn()).not.toThrow();
        });
      }));

    it('handles distinct event types across mixed paths without cross-event interference', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const ownClick = vi.fn();
          const refinerKey = vi.fn();
          const onFocus = vi.fn();

          class MultiEventWidget extends Aria<HTMLButtonElement> {
            public constructor() {
              super();
              this.update();
            }

            protected override createAttributes(): AriaAttributes<HTMLButtonElement> {
              return { onclick: ownClick };
            }
          }

          const widget = new MultiEventWidget();
          widget.refine(() => ({ onkeydown: refinerKey }));
          const releaseFocus = widget.on('focus', onFocus);

          const element = document.createElement('button');
          widget.ref(element);

          // Dispatch keydown: only refiner fires
          element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          expect(ownClick).not.toHaveBeenCalled();
          expect(refinerKey).toHaveBeenCalledTimes(1);
          expect(onFocus).not.toHaveBeenCalled();

          // Dispatch click: only ownClick fires
          element.dispatchEvent(new MouseEvent('click'));
          expect(ownClick).toHaveBeenCalledTimes(1);
          expect(refinerKey).toHaveBeenCalledTimes(1);
          expect(onFocus).not.toHaveBeenCalled();

          // Dispatch focus: only onFocus fires
          element.dispatchEvent(new FocusEvent('focus'));
          expect(ownClick).toHaveBeenCalledTimes(1);
          expect(refinerKey).toHaveBeenCalledTimes(1);
          expect(onFocus).toHaveBeenCalledTimes(1);

          // Release focus: subsequent focus event does not fire onFocus
          releaseFocus();
          element.dispatchEvent(new FocusEvent('focus'));
          expect(onFocus).toHaveBeenCalledTimes(1);
        });
      }));
  });
});
