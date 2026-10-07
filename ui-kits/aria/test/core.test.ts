import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { Aria } from '../src/core.js';
import type { AriaAttributes } from '../src/types.js';
import { component } from './utils.js';

describe('Core - Units', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('compiles declared attributes into .attributes dictionary for SSR and template spreads', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        widget.refine(() => ({ role: 'status', 'aria-label': 'Ready' }));

        expect(widget.current).toBeNull();
        expect(widget.attributes.role).toBe('status');
        expect(widget.attributes['aria-label']).toBe('Ready');
      });
    }));

  it('normalizes class inputs via classx in .attributes without requiring a DOM element', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        widget.refine(() => ({ class: ['btn', { 'btn-active': true, 'btn-disabled': false }] }));

        expect(widget.attributes.class).toBe('btn btn-active');
      });
    }));

  it('normalizes style objects via stylex in .attributes without requiring a DOM element', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        widget.refine(() => ({ style: { color: 'rgb(255, 0, 0)', display: 'flex' } }));

        expect(widget.attributes.style).toEqual({ color: 'rgb(255, 0, 0)', display: 'flex' });
      });
    }));

  it('blocks refiners from overriding protected keys declared in omittedAttrs', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        class ProtectedAria extends Aria {
          public constructor() {
            super();
            this.omittedAttrs.push('role', 'tabindex');
          }
        }
        const widget = new ProtectedAria();
        widget.refine(() => ({
          role: 'banner' as never,
          tabindex: -1 as never,
          'aria-live': 'polite',
        }));

        expect(widget.attributes.role).toBeUndefined();
        expect(widget.attributes.tabindex).toBeUndefined();
        expect(widget.attributes['aria-live']).toBe('polite');
      });
    }));

  it('translates attributes for target framework conventions via Aria.translate', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const original = Aria.translator;
        Aria.translate((attrs) => ({ ...attrs, className: attrs.class }));

        const widget = new Aria();
        widget.refine(() => ({ class: 'framework-class' }));

        expect(widget.attributes.className).toBe('framework-class');

        Aria.translate(original);
      });
    }));

  it('supports React RefObject access (.current getter and setter)', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        const element = document.createElement('div');

        expect(widget.current).toBeNull();

        widget.current = element;
        expect(widget.current).toBe(element);

        widget.current = null;
        expect(widget.current).toBeNull();
      });
    }));

  it('maps HTML property aliases to standard lowercase DOM attributes upon mount', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        widget.refine(
          () =>
            ({
              className: 'input-field',
              htmlFor: 'field-id',
              tabIndex: 1,
              readOnly: true,
            }) as never
        );

        const element = document.createElement('input');
        widget.ref(element);

        expect(element.getAttribute('class')).toBe('input-field');
        expect(element.getAttribute('for')).toBe('field-id');
        expect(element.getAttribute('tabindex')).toBe('1');
        expect(element.getAttribute('readonly')).toBe('');
      });
    }));

  it('performs atomic state updates via assign()', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        class MultiStateAria extends Aria<HTMLDivElement, { min: number; max: number; now: number }> {
          public constructor(props: { min: number; max: number; now: number }) {
            super(props);
            this.update();
          }

          protected override createAttributes(): AriaAttributes<HTMLDivElement> {
            return {
              'aria-valuemin': this.properties.min,
              'aria-valuemax': this.properties.max,
              'aria-valuenow': this.properties.now,
            };
          }
        }

        const widget = new MultiStateAria({ min: 0, max: 100, now: 0 });
        const element = document.createElement('div');

        widget.ref(element);

        widget.assign({ min: 10, max: 200, now: 50 });
        expect(element.getAttribute('aria-valuemin')).toBe('10');
        expect(element.getAttribute('aria-valuemax')).toBe('200');
        expect(element.getAttribute('aria-valuenow')).toBe('50');
      });
    }));

  it('defers attribute compilation to subclass update() to prevent double update work', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        let createAttrsCallCount = 0;

        class DeferredAria extends Aria {
          protected override createAttributes() {
            createAttrsCallCount++;
            return { role: 'banner' as never };
          }
        }

        // Base Aria initialization does not run update()
        const widget = new DeferredAria();
        expect(createAttrsCallCount).toBe(0);
        expect(widget.attributes.role).toBeUndefined();

        // Subclass triggers update() once its own fields are ready
        class InitializedAria extends DeferredAria {
          public constructor() {
            super();
            this.update();
          }
        }

        const readyWidget = new InitializedAria();
        expect(createAttrsCallCount).toBe(1);
        expect(readyWidget.attributes.role).toBe('banner');
      });
    }));

  it('evaluates isNative based on options.native', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const defaultWidget = new Aria({});
        expect(defaultWidget.isNative).toBe(false);

        const nativeWidget = new Aria({}, { native: true });
        expect(nativeWidget.isNative).toBe(true);

        const customWidget = new Aria({}, { native: false });
        expect(customWidget.isNative).toBe(false);
      });
    }));

  it('attaches consumer event handlers directly to DOM and omits them from .attributes', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const onEnter = vi.fn();
        const widget = new Aria();
        const unrefine = widget.refine(() => ({
          onmouseenter: onEnter,
          role: 'region',
        }));

        // 1. .attributes omits event handlers
        expect(widget.attributes.role).toBe('region');
        expect((widget.attributes as Record<string, unknown>).onmouseenter).toBeUndefined();

        // 2. Attached DOM element receives the event listener directly
        const element = document.createElement('div');
        widget.ref(element);

        element.dispatchEvent(new MouseEvent('mouseenter'));
        expect(onEnter).toHaveBeenCalledTimes(1);

        // 3. Removing the refiner removes the event listener
        unrefine();
        element.dispatchEvent(new MouseEvent('mouseenter'));
        expect(onEnter).toHaveBeenCalledTimes(1);
      });
    }));
});

describe('Core - Integrations', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('diffs and applies normalized attributes, classes, and styles to DOM upon mount', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        widget.refine(() => ({
          role: 'status',
          class: ['card', { 'card-active': true }],
          style: { color: 'rgb(255, 0, 0)', display: 'block' },
        }));

        const element = document.createElement('div');
        widget.ref(element);

        expect(element.getAttribute('role')).toBe('status');
        expect(element.className).toBe('card card-active');
        expect(element.style.color).toBe('rgb(255, 0, 0)');
        expect(element.style.display).toBe('block');
      });
    }));

  it('synchronizes reactive state across property updates and property removals point-to-point', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const state = mutable<{ label?: string; tooltip?: string }>({ label: 'First', tooltip: 'tip-1' });
        const widget = new Aria(state);
        widget.refine((s) => ({
          'aria-label': s.label,
          'aria-describedby': s.tooltip,
        }));

        const element = document.createElement('div');
        widget.ref(element);

        // Initial state
        expect(element.getAttribute('aria-label')).toBe('First');
        expect(element.getAttribute('aria-describedby')).toBe('tip-1');

        // Transition 1: Update property
        state.label = 'Second';
        expect(element.getAttribute('aria-label')).toBe('Second');
        expect(widget.attributes['aria-label']).toBe('Second');

        // Transition 2: Delete property -> removes attribute from DOM
        delete state.tooltip;
        expect(element.getAttribute('aria-describedby')).toBeNull();
        expect(widget.attributes['aria-describedby']).toBeUndefined();

        // Transition 3: Re-add property
        state.tooltip = 'tip-2';
        expect(element.getAttribute('aria-describedby')).toBe('tip-2');
      });
    }));

  it('coordinates direct two-way reactive binding between external props and DOM element', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const externalProps = mutable({ active: false });
        const widget = new Aria(externalProps);
        widget.refine((s) => ({ 'aria-pressed': s.active ? 'true' : 'false' }));

        const element = document.createElement('button');
        widget.ref(element);

        // Transition 1: External component prop changes -> DOM reflects
        externalProps.active = true;
        expect(element.getAttribute('aria-pressed')).toBe('true');
        expect(widget.properties.active).toBe(true);

        // Transition 2: Controller mutates state -> External props reflect & DOM reflects
        widget.properties.active = false;
        expect(externalProps.active).toBe(false);
        expect(element.getAttribute('aria-pressed')).toBe('false');
      });
    }));

  it('handles dynamic styling transitions and property cleanups across state changes', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const state = mutable({ active: false, alert: false, color: 'rgb(255, 0, 0)', visible: true });
        const widget = new Aria(state);
        widget.refine((s) => ({
          class: ['box', { 'box-active': s.active, 'box-alert': s.alert }],
          style: { color: s.color, display: s.visible ? 'block' : 'none' },
        }));

        const element = document.createElement('div');
        widget.ref(element);

        // Initial state
        expect(element.className).toBe('box');
        expect(element.style.display).toBe('block');

        // Transition 1: Toggle active on, visible off
        state.active = true;
        state.visible = false;
        expect(element.className).toBe('box box-active');
        expect(element.style.display).toBe('none');

        // Transition 2: Toggle alert on, visible on
        state.alert = true;
        state.visible = true;
        expect(element.className).toBe('box box-active box-alert');
        expect(element.style.display).toBe('block');
      });
    }));

  it('executes full lifecycle attachment, node switching, and detachment cleanly', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const onDetach = vi.fn();

        class LifecycleAria extends Aria<HTMLDivElement> {
          protected override attach() {
            return onDetach;
          }
        }

        const widget = new LifecycleAria();
        widget.refine(() => ({ role: 'status' }));

        const elementA = document.createElement('div');
        const elementB = document.createElement('div');

        // Mount to Element A
        widget.ref(elementA);
        expect(widget.current).toBe(elementA);
        expect(elementA.getAttribute('role')).toBe('status');

        // Transition: Re-bind to Element B (Element A detaches, Element B attaches)
        widget.ref(elementB);
        expect(onDetach).toHaveBeenCalledTimes(1);
        expect(widget.current).toBe(elementB);
        expect(elementB.getAttribute('role')).toBe('status');

        // Teardown: Explicit destroy
        widget.destroy();
        expect(onDetach).toHaveBeenCalledTimes(2);
        expect(widget.current).toBeNull();
      });
    }));

  it('returns an unregister teardown callback from .refine() to purge dynamic attributes and prevent zombie state', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const widget = new Aria();
        const element = document.createElement('div');
        widget.ref(element);

        const unrefine = widget.refine(() => ({
          'aria-describedby': 'tooltip-1',
        }));

        expect(widget.attributes['aria-describedby']).toBe('tooltip-1');
        expect(element.getAttribute('aria-describedby')).toBe('tooltip-1');

        unrefine();

        expect(widget.attributes['aria-describedby']).toBeUndefined();
        expect(element.getAttribute('aria-describedby')).toBeNull();
      });
    }));

  it('chains ambient parent controller via .scope to enable self-discovery', () =>
    scope.run(() => {
      const parentTree = component();
      parentTree.run(() => {
        const parent = new Aria();
        expect(parent.scope).toBeUndefined();

        const childTree = component();
        childTree.run(() => {
          const child = new Aria();
          expect(child.scope).toBe(parent);

          const grandchildTree = component();
          grandchildTree.run(() => {
            const grandchild = new Aria();
            expect(grandchild.scope).toBe(child);
          });
        });
      });
    }));

  it('flushes registered cleanups on .destroy()', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        class CustomAria extends Aria {
          public registerCustomCleanup(fn: () => void) {
            this.cleanups.add(fn);
          }
        }

        const widget = new CustomAria();
        const cleanupA = vi.fn();
        const cleanupB = vi.fn();

        widget.registerCustomCleanup(cleanupA);
        widget.registerCustomCleanup(cleanupB);

        widget.destroy();

        expect(cleanupA).toHaveBeenCalledTimes(1);
        expect(cleanupB).toHaveBeenCalledTimes(1);
      });
    }));

  it('destroys enclosed controllers when component unmounts via tree.destroy()', () =>
    scope.run(() => {
      const onDetach = vi.fn();

      class LifecycleAria extends Aria<HTMLDivElement> {
        protected override attach() {
          return onDetach;
        }
      }

      const tree = component();
      let widget!: LifecycleAria;

      tree.run(() => {
        widget = new LifecycleAria();
        const element = document.createElement('div');
        widget.ref(element);
      });

      expect(onDetach).not.toHaveBeenCalled();

      // Component unmounts
      tree.destroy();

      expect(onDetach).toHaveBeenCalledTimes(1);
      expect(widget.current).toBeNull();
    }));

  it('deactivates observer and stops reactive updates when destroyed', () =>
    scope.run(() => {
      const tree = component();
      const state = mutable({ count: 1 });
      const refiner = vi.fn((s: typeof state) => ({ 'aria-valuenow': s.count }));

      let widget!: Aria<HTMLElement, typeof state>;
      tree.run(() => {
        widget = new Aria(state);
        widget.refine(refiner);
      });

      expect(refiner).toHaveBeenCalledTimes(1);
      expect(widget.attributes['aria-valuenow']).toBe(1);

      // State mutation before destroy -> triggers update
      state.count = 2;
      expect(refiner).toHaveBeenCalledTimes(2);
      expect(widget.attributes['aria-valuenow']).toBe(2);

      // Component unmounts
      tree.destroy();

      // State mutation after destroy -> reactivity is dead, no further updates
      state.count = 3;
      expect(refiner).toHaveBeenCalledTimes(2);
      expect(widget.attributes['aria-valuenow']).toBe(2);
    }));

  it('manages mixed refines (classes, styles, events, attributes) through full component lifecycle', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const props = mutable({
          active: false,
          disabled: false,
          size: 'sm' as 'sm' | 'lg',
          color: 'rgb(255, 0, 0)',
          hasStyle: true,
          count: 0,
        });

        const widget = new Aria(props);

        // 1. Mixed Refine Registration: classes, styles, CSS vars, ARIA states, and events
        widget.refine((s) => ({
          class: ['btn', `btn-${s.size}`, { 'btn-active': s.active, 'btn-disabled': s.disabled }],
          style: s.hasStyle
            ? { color: s.color || undefined, '--custom-size': s.size === 'lg' ? '20px' : '10px' }
            : undefined,
          'aria-pressed': s.active ? 'true' : 'false',
          'aria-disabled': s.disabled ? 'true' : undefined,
          onclick: () => {
            if (!s.disabled) s.count++;
          },
        }));

        // SSR Phase: deterministic attributes compilation
        expect(widget.current).toBeNull();
        expect(widget.attributes.class).toBe('btn btn-sm');
        expect(widget.attributes.style).toEqual({
          color: 'rgb(255, 0, 0)',
          '--custom-size': '10px',
        });
        expect(widget.attributes['aria-pressed']).toBe('false');
        expect(widget.attributes['aria-disabled']).toBeUndefined();
        expect((widget.attributes as Record<string, unknown>).onclick).toBeUndefined();

        // 2. Mount Phase: framework element binding & DOM synchronization
        const el = document.createElement('button');
        widget.ref(el);

        expect(widget.current).toBe(el);
        expect(el.getAttribute('class')).toBe('btn btn-sm');
        expect(el.style.color).toBe('rgb(255, 0, 0)');
        expect(el.style.getPropertyValue('--custom-size')).toBe('10px');
        expect(el.getAttribute('aria-pressed')).toBe('false');
        expect(el.hasAttribute('aria-disabled')).toBe(false);

        // 3. Interaction Phase: event dispatched on live DOM
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(props.count).toBe(1);

        // 4. Dynamic Update Phase: add/remove classes and styles across reactive state mutations
        props.active = true;
        props.size = 'lg';
        expect(el.getAttribute('class')).toBe('btn btn-lg btn-active');
        expect(el.style.getPropertyValue('--custom-size')).toBe('20px');
        expect(el.getAttribute('aria-pressed')).toBe('true');

        // Dynamic style property removal
        props.color = '';
        expect(el.style.color).toBe('');
        expect(el.style.getPropertyValue('--custom-size')).toBe('20px');

        // Dynamic complete style attribute removal
        props.hasStyle = false;
        expect(el.hasAttribute('style')).toBe(false);

        // Dynamic class & disabled addition
        props.disabled = true;
        expect(el.getAttribute('class')).toBe('btn btn-lg btn-active btn-disabled');
        expect(el.getAttribute('aria-disabled')).toBe('true');

        // Event listener respects updated state
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(props.count).toBe(1);

        // 5. Dynamic secondary overlay refiner registration and unrefine teardown
        const unrefineBadge = widget.refine((s) => ({
          'aria-describedby': s.active ? 'badge-id' : undefined,
        }));
        expect(el.getAttribute('aria-describedby')).toBe('badge-id');

        unrefineBadge();
        expect(el.hasAttribute('aria-describedby')).toBe(false);
        expect(el.getAttribute('class')).toBe('btn btn-lg btn-active btn-disabled');

        // 6. Teardown / Disposal Phase
        tree.destroy();
        expect(widget.current).toBeNull();

        // Mutations post-destruction cause zero side-effects
        props.count = 99;
        props.active = false;
        expect(el.getAttribute('class')).toBe('btn btn-lg btn-active btn-disabled');
      });
    }));

  it('passes current compiled attributes as the 2nd argument to refine callbacks', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        class CustomButton extends Aria {
          constructor() {
            super();
            this.update();
          }

          protected override createAttributes() {
            return {
              role: 'button',
              tabindex: 0,
              class: 'base-btn',
            };
          }
        }

        const widget = new CustomButton();
        let receivedAttrs: Record<string, unknown> | undefined;

        widget.refine((_props, attrs) => {
          receivedAttrs = { ...attrs };
          return {
            'aria-label': `Role is ${attrs.role}`,
          };
        });

        expect(receivedAttrs).toBeDefined();
        expect(receivedAttrs?.role).toBe('button');
        expect(receivedAttrs?.tabindex).toBe(0);
        expect(receivedAttrs?.class).toBe('base-btn');
        expect(widget.attributes['aria-label']).toBe('Role is button');
      });
    }));

  it('registers actionable controller on itself and ambient parent scope', () =>
    scope.run(() => {
      class ActionableWidget extends Aria {
        public constructor() {
          super();
          this.markActionable();
        }
      }

      const parentTree = component();
      parentTree.run(() => {
        const parent = new Aria();
        expect(parent.actionable).toBeUndefined();

        const childTree = component();
        let child!: ActionableWidget;
        childTree.run(() => {
          child = new ActionableWidget();
          expect(child.isActionable).toBe(true);
          expect(child.actionable).toBe(child);
          expect(parent.actionable).toBe(child);
        });

        child.destroy();
        expect(parent.actionable).toBeUndefined();
      });
    }));

  it('applies last-claim-wins when multiple actionable children mount within the same scope', () =>
    scope.run(() => {
      class ActionableWidget extends Aria {
        public constructor() {
          super();
          this.markActionable();
        }
      }

      const parentTree = component();
      parentTree.run(() => {
        const parent = new Aria();

        const child1Tree = component();
        let child1!: ActionableWidget;
        child1Tree.run(() => {
          child1 = new ActionableWidget();
        });
        expect(parent.actionable).toBe(child1);

        const child2Tree = component();
        let child2!: ActionableWidget;
        child2Tree.run(() => {
          child2 = new ActionableWidget();
        });
        expect(parent.actionable).toBe(child2);

        child2.destroy();
        expect(parent.actionable).toBeUndefined();

        child1.destroy();
      });
    }));
});
