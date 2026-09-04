import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { type AccordionGroupProps, accordionCtx, aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Accordion - User Expectations & A11y Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Semantic DOM Hierarchy & Pair Linking', () => {
    it('generates deterministic accessibility attributes and coordinates active states in a group', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<AccordionGroupProps>({ id: 'faq', value: 'shipping' });
          const group = aria('accordion-group', props);
          const container = bind(document.createElement('div'), group);

          const { item: itemShipping, panel: panelShipping } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'shipping' }),
            panel: accordionCtx.get()!.panel({ name: 'shipping' }),
          }));

          const { item: itemBilling, panel: panelBilling } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'billing' }),
            panel: accordionCtx.get()!.panel({ name: 'billing' }),
          }));

          const btnShipping = bind(document.createElement('button'), itemShipping);
          const regionShipping = bind(document.createElement('div'), panelShipping);
          const btnBilling = bind(document.createElement('button'), itemBilling);
          const regionBilling = bind(document.createElement('div'), panelBilling);

          container.appendChild(btnShipping);
          container.appendChild(regionShipping);
          container.appendChild(btnBilling);
          container.appendChild(regionBilling);

          // Structural root: carries ID namespace
          expect(group.attributes.id).toBe('faq');

          // Active item: button type, expanded true, points to paired region
          expect(itemShipping.attributes.id).toBe('faq-accordion-shipping');
          expect(itemShipping.attributes.type).toBe('button');
          expect(itemShipping.attributes['aria-expanded']).toBe('true');
          expect(itemShipping.attributes['aria-controls']).toBe('faq-region-shipping');
          expect(btnShipping.getAttribute('aria-expanded')).toBe('true');

          // Inactive item: button type, expanded false, points to paired region
          expect(itemBilling.attributes.id).toBe('faq-accordion-billing');
          expect(itemBilling.attributes.type).toBe('button');
          expect(itemBilling.attributes['aria-expanded']).toBe('false');
          expect(itemBilling.attributes['aria-controls']).toBe('faq-region-billing');
          expect(btnBilling.getAttribute('aria-expanded')).toBe('false');

          // Active panel: role region, visible, labelled by active trigger
          expect(panelShipping.attributes.role).toBe('region');
          expect(panelShipping.attributes.id).toBe('faq-region-shipping');
          expect(panelShipping.attributes['aria-labelledby']).toBe('faq-accordion-shipping');
          expect(panelShipping.attributes.hidden).toBe(false);
          expect(regionShipping.hidden).toBe(false);

          // Inactive panel: role region, hidden, labelled by inactive trigger
          expect(panelBilling.attributes.role).toBe('region');
          expect(panelBilling.attributes.id).toBe('faq-region-billing');
          expect(panelBilling.attributes['aria-labelledby']).toBe('faq-accordion-billing');
          expect(panelBilling.attributes.hidden).toBe(true);
          expect(regionBilling.hidden).toBe(true);
        });
      }));

    it('derives automatic fallback namespace when group id is omitted', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group', { value: 'first' });

          const { item, panel } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'first' }),
            panel: accordionCtx.get()!.panel({ name: 'first' }),
          }));

          expect(group.attributes.id).toBe(group.id);
          expect(item.attributes.id).toBe(`${group.id}-accordion-first`);
          expect(item.attributes['aria-controls']).toBe(`${group.id}-region-first`);
          expect(panel.attributes.id).toBe(`${group.id}-region-first`);
          expect(panel.attributes['aria-labelledby']).toBe(`${group.id}-accordion-first`);
        });
      }));

    it('allows explicit id on item and panel to take precedence', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group', { id: 'support' });

          const { item, panel } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'help', id: 'custom-trigger-id' }),
            panel: accordionCtx.get()!.panel({ name: 'help', id: 'custom-panel-id' }),
          }));

          expect(item.attributes.id).toBe('custom-trigger-id');
          expect(panel.attributes.id).toBe('custom-panel-id');
        });
      }));
  });

  describe('Default Instantiation', () => {
    it('instantiates group with vertical orientation and auto id by default', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group');
          expect(group.orientation).toBe('vertical');
          expect(group.attributes.id).toBe(group.id);

          // Orientation getter falls back to vertical if prop is explicitly set to undefined
          group.props.orientation = undefined;
          expect(group.orientation).toBe('vertical');
        });
      }));

    it('instantiates standalone accordion trigger collapsed with toggle enabled by default', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('accordion');
          expect(item.expanded).toBe(false);
          expect(item.isToggle).toBe(true);
          expect(item.attributes['aria-expanded']).toBe('false');
        });
      }));

    it('instantiates standalone accordion panel hidden by default', () =>
      scope.run(() => {
        component().run(() => {
          const panel = aria('accordion-panel');
          expect(panel.expanded).toBe(false);
          expect(panel.attributes.hidden).toBe(true);
        });
      }));
  });

  describe('Standalone Disclosure Mode (Without Group)', () => {
    it('operates as an independent collapsible disclosure widget with toggle enabled', () =>
      scope.run(() => {
        component().run(() => {
          const trigger = aria('accordion', { name: 'disclaimer' });
          const panel = aria('accordion-panel', { name: 'disclaimer' });

          const btn = bind(document.createElement('button'), trigger);
          const region = bind(document.createElement('div'), panel);

          expect(trigger.attributes.id).toBe('accordion-disclaimer');
          expect(trigger.attributes['aria-controls']).toBe('region-disclaimer');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(btn.getAttribute('aria-expanded')).toBe('false');
          expect(panel.attributes.id).toBe('region-disclaimer');
          expect(panel.attributes['aria-labelledby']).toBe('accordion-disclaimer');
          expect(panel.attributes.hidden).toBe(true);
          expect(region.hidden).toBe(true);

          // Clicking trigger expands
          btn.click();
          expect(trigger.expanded).toBe(true);
          expect(trigger.attributes['aria-expanded']).toBe('true');
          expect(btn.getAttribute('aria-expanded')).toBe('true');

          // Clicking again collapses
          btn.click();
          expect(trigger.expanded).toBe(false);
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(btn.getAttribute('aria-expanded')).toBe('false');

          // Programmatic setter
          trigger.expanded = true;
          expect(trigger.expanded).toBe(true);
        });
      }));

    it('allows disabling toggle on standalone trigger with explicit toggle: false', () =>
      scope.run(() => {
        component().run(() => {
          const nonToggle = aria('accordion', { name: 'fixed' }, { toggle: false });
          expect(nonToggle.isToggle).toBe(false);

          const btn = bind(document.createElement('button'), nonToggle);
          btn.click();
          expect(nonToggle.expanded).toBe(true);

          // Clicking again does not collapse because toggle is false
          btn.click();
          expect(nonToggle.expanded).toBe(true);
        });
      }));

    it('supports standalone panel with explicit expanded prop', () =>
      scope.run(() => {
        component().run(() => {
          const activePanel = aria('accordion-panel', { name: 'active', expanded: true });
          const region = bind(document.createElement('div'), activePanel);

          expect(activePanel.expanded).toBe(true);
          expect(activePanel.attributes.hidden).toBe(false);
          expect(region.hidden).toBe(false);
        });
      }));

    it('resolves standalone panel key with value or auto id fallback', () =>
      scope.run(() => {
        component().run(() => {
          const valPanel = aria('accordion-panel', { value: 'by-val' });
          expect(valPanel.key).toBe('by-val');

          const autoPanel = aria('accordion-panel');
          expect(autoPanel.key).toBe(autoPanel.id);
        });
      }));

    it('supports non-native element polyfilling role="button", tabindex, and keyboard activation', () =>
      scope.run(() => {
        component().run(() => {
          const customTrigger = aria('accordion', { name: 'custom' }, { native: false });
          expect(customTrigger.attributes.role).toBe('button');
          expect(customTrigger.attributes.type).toBeUndefined();
          expect(customTrigger.attributes.tabindex).toBe(0);

          const el = bind(document.createElement('div'), customTrigger);
          let clicked = false;
          el.onclick = () => {
            clicked = true;
          };

          // Space key activates non-native trigger
          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
          expect(clicked).toBe(true);
        });
      }));

    it('sets tabindex="-1" on disabled non-native trigger', () =>
      scope.run(() => {
        component().run(() => {
          const disabledCustom = aria('accordion', { name: 'off', disabled: true }, { native: false });
          expect(disabledCustom.attributes.tabindex).toBe(-1);
        });
      }));

    it('manages independent states when multiple standalone accordions exist', () =>
      scope.run(() => {
        component().run(() => {
          const first = aria('accordion', { name: 'first' });
          const second = aria('accordion', { name: 'second' });

          const btn1 = bind(document.createElement('button'), first);
          const btn2 = bind(document.createElement('button'), second);

          btn1.click();
          expect(first.expanded).toBe(true);
          expect(second.expanded).toBe(false);

          btn2.click();
          expect(first.expanded).toBe(true);
          expect(second.expanded).toBe(true);
        });
      }));
  });

  describe('Grouped Coordination & Selection Modes', () => {
    it('enforces mutually-exclusive expansion by default (one section must stay open)', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group');
          const container = bind(document.createElement('div'), group);

          const { item: secA, panel: panelA } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'a' }),
            panel: accordionCtx.get()!.panel({ name: 'a' }),
          }));

          const { item: secB, panel: panelB } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'b' }),
            panel: accordionCtx.get()!.panel({ name: 'b' }),
          }));

          const elA = bind(document.createElement('button'), secA);
          const regionA = bind(document.createElement('div'), panelA);
          const elB = bind(document.createElement('button'), secB);
          const regionB = bind(document.createElement('div'), panelB);

          container.appendChild(elA);
          container.appendChild(regionA);
          container.appendChild(elB);
          container.appendChild(regionB);

          // Initial self-claiming: Section A claims initial active selection
          expect(group.props.value).toBe('a');
          expect(secA.expanded).toBe(true);
          expect(panelA.expanded).toBe(true);
          expect(elA.getAttribute('aria-expanded')).toBe('true');
          expect(regionA.hidden).toBe(false);

          expect(secB.expanded).toBe(false);
          expect(panelB.expanded).toBe(false);
          expect(elB.getAttribute('aria-expanded')).toBe('false');
          expect(regionB.hidden).toBe(true);

          // Switching to B: opens B and collapses A in both model and DOM
          elB.click();
          expect(group.props.value).toBe('b');
          expect(secA.expanded).toBe(false);
          expect(panelA.expanded).toBe(false);
          expect(elA.getAttribute('aria-expanded')).toBe('false');
          expect(regionA.hidden).toBe(true);

          expect(secB.expanded).toBe(true);
          expect(panelB.expanded).toBe(true);
          expect(elB.getAttribute('aria-expanded')).toBe('true');
          expect(regionB.hidden).toBe(false);

          // Clicking active section B does NOT collapse it (one must stay open)
          elB.click();
          expect(group.props.value).toBe('b');
          expect(secB.expanded).toBe(true);
          expect(panelB.expanded).toBe(true);
          expect(elB.getAttribute('aria-expanded')).toBe('true');
          expect(regionB.hidden).toBe(false);
        });
      }));

    it('allows collapsing all sections when group explicitly sets toggle: true', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group', { toggle: true, value: 'item1' });
          const container = bind(document.createElement('div'), group);

          const { item: item1, panel: panel1 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'item1' }),
            panel: accordionCtx.get()!.panel({ name: 'item1' }),
          }));

          const { item: item2, panel: panel2 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'item2' }),
            panel: accordionCtx.get()!.panel({ name: 'item2' }),
          }));

          const el1 = bind(document.createElement('button'), item1);
          const region1 = bind(document.createElement('div'), panel1);
          const el2 = bind(document.createElement('button'), item2);
          const region2 = bind(document.createElement('div'), panel2);

          container.appendChild(el1);
          container.appendChild(region1);
          container.appendChild(el2);
          container.appendChild(region2);

          expect(item1.expanded).toBe(true);
          expect(region1.hidden).toBe(false);

          // Clicking active section collapses it back to undefined and hides panel
          el1.click();
          expect(item1.expanded).toBe(false);
          expect(panel1.expanded).toBe(false);
          expect(region1.hidden).toBe(true);
          expect(group.props.value).toBeUndefined();

          // Clicking item2 opens item2 and shows panel
          el2.click();
          expect(item2.expanded).toBe(true);
          expect(panel2.expanded).toBe(true);
          expect(region2.hidden).toBe(false);
          expect(group.props.value).toBe('item2');
        });
      }));

    it('honors child item with selected prop to claim initial group selection', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group');

          const { item: first, panel: p1 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'first' }),
            panel: accordionCtx.get()!.panel({ name: 'first' }),
          }));

          const { item: second, panel: p2 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'second', selected: true }),
            panel: accordionCtx.get()!.panel({ name: 'second' }),
          }));

          const r1 = bind(document.createElement('div'), p1);
          const r2 = bind(document.createElement('div'), p2);

          expect(group.props.value).toBe('second');
          expect(first.expanded).toBe(false);
          expect(second.expanded).toBe(true);
          expect(r1.hidden).toBe(true);
          expect(r2.hidden).toBe(false);
        });
      }));

    it('coordinates array collection membership for multi-expansion', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group', { value: ['sec1'] });

          const { item: sec1, panel: p1 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'sec1' }),
            panel: accordionCtx.get()!.panel({ name: 'sec1' }),
          }));

          const { item: sec2, panel: p2 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'sec2' }),
            panel: accordionCtx.get()!.panel({ name: 'sec2' }),
          }));

          const el1 = bind(document.createElement('button'), sec1);
          const r1 = bind(document.createElement('div'), p1);
          const el2 = bind(document.createElement('button'), sec2);
          const r2 = bind(document.createElement('div'), p2);

          expect(sec1.expanded).toBe(true);
          expect(r1.hidden).toBe(false);
          expect(sec2.expanded).toBe(false);
          expect(r2.hidden).toBe(true);

          // Expanding sec2 adds it to array without closing sec1
          el2.click();
          expect(sec1.expanded).toBe(true);
          expect(r1.hidden).toBe(false);
          expect(sec2.expanded).toBe(true);
          expect(r2.hidden).toBe(false);
          expect(group.props.value).toEqual(['sec1', 'sec2']);

          // Collapsing sec1 removes it from array and hides its panel
          el1.click();
          expect(sec1.expanded).toBe(false);
          expect(r1.hidden).toBe(true);
          expect(sec2.expanded).toBe(true);
          expect(r2.hidden).toBe(false);
          expect(group.props.value).toEqual(['sec2']);
        });
      }));

    it('coordinates dictionary boolean flags mode', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group', { value: { optA: true, optB: false } });

          const { item: optA, panel: pA } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'optA' }),
            panel: accordionCtx.get()!.panel({ name: 'optA' }),
          }));

          const { item: optB, panel: pB } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'optB' }),
            panel: accordionCtx.get()!.panel({ name: 'optB' }),
          }));

          const elB = bind(document.createElement('button'), optB);
          const rA = bind(document.createElement('div'), pA);
          const rB = bind(document.createElement('div'), pB);

          expect(optA.expanded).toBe(true);
          expect(rA.hidden).toBe(false);
          expect(optB.expanded).toBe(false);
          expect(rB.hidden).toBe(true);

          elB.click();
          expect(optB.expanded).toBe(true);
          expect(rB.hidden).toBe(false);
          expect((group.props.value as Record<string, boolean>).optB).toBe(true);
        });
      }));

    it('cascades disabled state from group and blocks interaction', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group', { disabled: true, value: 'item1' });

          const { item: item1 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'item1' }),
          }));

          const { item: item2, panel: p2 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'item2' }),
            panel: accordionCtx.get()!.panel({ name: 'item2' }),
          }));

          const el1 = bind(document.createElement('button'), item1);
          const el2 = bind(document.createElement('button'), item2);
          const r2 = bind(document.createElement('div'), p2);

          expect(item1.disabled).toBe(true);
          expect(item2.disabled).toBe(true);
          expect(el1.getAttribute('aria-disabled')).toBe('true');
          expect(el2.getAttribute('aria-disabled')).toBe('true');

          el2.click();
          expect(item2.expanded).toBe(false);
          expect(r2.hidden).toBe(true);
          expect(group.props.value).toBe('item1');
        });
      }));
  });

  describe('Keyboard Navigation (Roving Focus)', () => {
    it('navigates vertically with ArrowDown and ArrowUp wrapping around items', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group', { orientation: 'vertical' });
          const container = bind(document.createElement('div'), group);

          const { item: b1, panel: p1 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'b1' }),
            panel: accordionCtx.get()!.panel({ name: 'b1' }),
          }));

          const { item: b2, panel: p2 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'b2' }),
            panel: accordionCtx.get()!.panel({ name: 'b2' }),
          }));

          const { item: b3, panel: p3 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'b3' }),
            panel: accordionCtx.get()!.panel({ name: 'b3' }),
          }));

          const el1 = bind(document.createElement('button'), b1);
          const panelEl1 = bind(document.createElement('div'), p1);
          const el2 = bind(document.createElement('button'), b2);
          const panelEl2 = bind(document.createElement('div'), p2);
          const el3 = bind(document.createElement('button'), b3);
          const panelEl3 = bind(document.createElement('div'), p3);

          container.appendChild(el1);
          container.appendChild(panelEl1);
          container.appendChild(el2);
          container.appendChild(panelEl2);
          container.appendChild(el3);
          container.appendChild(panelEl3);
          document.body.appendChild(container);

          el1.focus();
          expect(document.activeElement).toBe(el1);

          // ArrowDown moves focus from 1 to 2
          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(el2);

          // ArrowDown moves focus from 2 to 3
          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(el3);

          // ArrowDown wraps from 3 back to 1
          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(el1);

          // ArrowUp wraps from 1 to 3
          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
          expect(document.activeElement).toBe(el3);

          document.body.removeChild(container);
        });
      }));

    it('navigates horizontally with ArrowRight and ArrowLeft when orientation is horizontal', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group', { orientation: 'horizontal' });
          const container = bind(document.createElement('div'), group);

          const { item: h1, panel: p1 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'h1' }),
            panel: accordionCtx.get()!.panel({ name: 'h1' }),
          }));

          const { item: h2, panel: p2 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'h2' }),
            panel: accordionCtx.get()!.panel({ name: 'h2' }),
          }));

          const el1 = bind(document.createElement('button'), h1);
          const panelEl1 = bind(document.createElement('div'), p1);
          const el2 = bind(document.createElement('button'), h2);
          const panelEl2 = bind(document.createElement('div'), p2);

          container.appendChild(el1);
          container.appendChild(panelEl1);
          container.appendChild(el2);
          container.appendChild(panelEl2);
          document.body.appendChild(container);

          el1.focus();
          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(el2);

          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          expect(document.activeElement).toBe(el1);

          document.body.removeChild(container);
        });
      }));

    it('skips disabled accordion items during roving navigation', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group');
          const container = bind(document.createElement('div'), group);

          const { item: i1 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'i1' }),
          }));

          const { item: i2 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'i2', disabled: true }),
          }));

          const { item: i3 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'i3' }),
          }));

          const el1 = bind(document.createElement('button'), i1);
          const el2 = bind(document.createElement('button'), i2);
          const el3 = bind(document.createElement('button'), i3);

          container.appendChild(el1);
          container.appendChild(el2);
          container.appendChild(el3);
          document.body.appendChild(container);

          el1.focus();
          // ArrowDown skips disabled i2 and lands directly on i3
          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(el3);

          document.body.removeChild(container);
        });
      }));

    it('ignores keyboard navigation when group is disabled', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion-group', { disabled: true, value: 'd1' });
          const container = bind(document.createElement('div'), group);

          const { item: d1 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'd1' }),
          }));

          const { item: d2 } = component().run(() => ({
            item: accordionCtx.get()!.item({ name: 'd2' }),
          }));

          const b1 = bind(document.createElement('button'), d1);
          const b2 = bind(document.createElement('button'), d2);
          container.appendChild(b1);
          container.appendChild(b2);

          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
          expect(group.props.value).toBe('d1');
        });
      }));
  });
});
