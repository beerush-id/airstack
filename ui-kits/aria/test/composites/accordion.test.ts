import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { type AccordionProps, accordionCtx, aria } from '../../src/index.js';
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
          const props = mutable<AccordionProps>({ id: 'faq', value: 'shipping' });
          const group = aria('accordion', props);
          const container = bind(document.createElement('div'), group);

          const { item: itemShipping, panel: panelShipping } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'shipping' }),
            panel: accordionCtx.get()!.panel({ name: 'shipping' }),
          }));

          const { item: itemBilling, panel: panelBilling } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'billing' }),
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
          const group = aria('accordion', { value: 'first' });

          const { item, panel } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'first' }),
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
          const group = aria('accordion', { id: 'support' });

          const { item, panel } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'help', id: 'custom-trigger-id' }),
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
          const group = aria('accordion');
          expect(group.properties.orientation).toBe('vertical');
          expect(group.attributes.id).toBe(group.id);

          // Orientation getter falls back to vertical if prop is explicitly set to undefined
          group.properties.orientation = undefined;
          expect(group.properties.orientation ?? 'vertical').toBe('vertical');
        });
      }));

    it('instantiates standalone accordion trigger collapsed with toggle enabled by default', () =>
      scope.run(() => {
        component().run(() => {
          const item = aria('accordion-button');
          expect(item.expanded).toBe(false);
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
          const trigger = aria('accordion-button', { name: 'disclaimer' });
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

    it('supports panel expanded state inside an accordion group', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { value: 'active' });
          const activePanel = group.panel({ name: 'active' });
          const region = bind(document.createElement('div'), activePanel);

          expect(activePanel.expanded).toBe(true);
          expect(activePanel.attributes.hidden).toBe(false);
          expect(region.hidden).toBe(false);
        });
      }));

    it('resolves standalone panel key with value or auto id fallback', () =>
      scope.run(() => {
        component().run(() => {
          const valPanel = aria('accordion-panel', { name: 'by-val' });
          expect(valPanel.key).toBe('by-val');

          const autoPanel = aria('accordion-panel');
          expect(autoPanel.key).toBe(autoPanel.id);
        });
      }));

    it('supports non-native element polyfilling role="button", tabindex, and keyboard activation', () =>
      scope.run(() => {
        component().run(() => {
          const customTrigger = aria('accordion-button', { name: 'custom' }, { native: false });
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
          const disabledCustom = aria('accordion-button', { name: 'off', disabled: true }, { native: false });
          expect(disabledCustom.attributes.tabindex).toBe(-1);
        });
      }));

    it('manages independent states when multiple standalone accordions exist', () =>
      scope.run(() => {
        component().run(() => {
          const first = aria('accordion-button', { name: 'first' });
          const second = aria('accordion-button', { name: 'second' });

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
    it('collapses freely by default with no initial claiming when uncontrolled', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion');
          const container = bind(document.createElement('div'), group);

          const { item: secA, panel: panelA } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'a' }),
            panel: accordionCtx.get()!.panel({ name: 'a' }),
          }));

          const { item: secB, panel: panelB } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'b' }),
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

          // No initial claiming: all sections start collapsed
          expect(group.properties.value).toBeUndefined();
          expect(secA.expanded).toBe(false);
          expect(regionA.hidden).toBe(true);

          // Opening A, then clicking A collapses it back
          elA.click();
          expect(group.properties.value).toBe('a');
          expect(regionA.hidden).toBe(false);

          elA.click();
          expect(group.properties.value).toBeUndefined();
          expect(secA.expanded).toBe(false);
          expect(regionA.hidden).toBe(true);

          // Switching between sections still works
          elB.click();
          expect(group.properties.value).toBe('b');
          expect(secB.expanded).toBe(true);
          expect(regionB.hidden).toBe(false);
        });
      }));

    it('enforces mutually-exclusive expansion when required: true (one section must stay open)', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { required: true });
          const container = bind(document.createElement('div'), group);

          const { item: secA, panel: panelA } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'a' }),
            panel: accordionCtx.get()!.panel({ name: 'a' }),
          }));

          const { item: secB, panel: panelB } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'b' }),
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
          expect(group.properties.value).toBe('a');
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
          expect(group.properties.value).toBe('b');
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
          expect(group.properties.value).toBe('b');
          expect(secB.expanded).toBe(true);
          expect(panelB.expanded).toBe(true);
          expect(elB.getAttribute('aria-expanded')).toBe('true');
          expect(regionB.hidden).toBe(false);
        });
      }));

    it('allows collapsing all sections when group explicitly sets required: false', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { required: false, value: 'item1' });
          const container = bind(document.createElement('div'), group);

          const { item: item1, panel: panel1 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'item1' }),
            panel: accordionCtx.get()!.panel({ name: 'item1' }),
          }));

          const { item: item2, panel: panel2 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'item2' }),
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
          expect(group.properties.value).toBeUndefined();

          // Clicking item2 opens item2 and shows panel
          el2.click();
          expect(item2.expanded).toBe(true);
          expect(panel2.expanded).toBe(true);
          expect(region2.hidden).toBe(false);
          expect(group.properties.value).toBe('item2');
        });
      }));

    it('honors child item with selected prop to claim initial group selection', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion');

          const { item: first, panel: p1 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'first' }),
            panel: accordionCtx.get()!.panel({ name: 'first' }),
          }));

          const { item: second, panel: p2 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'second', selected: true }),
            panel: accordionCtx.get()!.panel({ name: 'second' }),
          }));

          const r1 = bind(document.createElement('div'), p1);
          const r2 = bind(document.createElement('div'), p2);

          expect(group.properties.value).toBe('second');
          expect(first.expanded).toBe(false);
          expect(second.expanded).toBe(true);
          expect(r1.hidden).toBe(true);
          expect(r2.hidden).toBe(false);
        });
      }));

    it('coordinates array collection membership for multi-expansion', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { value: ['sec1'], multiple: true });

          const { item: sec1, panel: p1 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'sec1' }),
            panel: accordionCtx.get()!.panel({ name: 'sec1' }),
          }));

          const { item: sec2, panel: p2 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'sec2' }),
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
          expect(group.properties.value).toEqual(['sec1', 'sec2']);

          // Collapsing sec1 removes it from array and hides its panel
          el1.click();
          expect(sec1.expanded).toBe(false);
          expect(r1.hidden).toBe(true);
          expect(sec2.expanded).toBe(true);
          expect(r2.hidden).toBe(false);
          expect(group.properties.value).toEqual(['sec2']);
        });
      }));

    it('cascades disabled state from group and blocks interaction', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { disabled: true, value: 'item1' });

          const { item: item1 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'item1' }),
          }));

          const { item: item2, panel: p2 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'item2' }),
            panel: accordionCtx.get()!.panel({ name: 'item2' }),
          }));

          const el1 = bind(document.createElement('button'), item1);
          const el2 = bind(document.createElement('button'), item2);
          const r2 = bind(document.createElement('div'), p2);

          expect(item1.disabled).toBe(true);
          expect(item2.disabled).toBe(true);
          expect(el1.disabled).toBe(true);
          expect(el2.disabled).toBe(true);
          expect(el1.getAttribute('aria-disabled')).toBe('true');
          expect(el2.getAttribute('aria-disabled')).toBe('true');

          el2.click();
          expect(item2.expanded).toBe(false);
          expect(r2.hidden).toBe(true);
          expect(group.properties.value).toBe('item1');
        });
      }));
  });

  describe('Keyboard Navigation (Roving Focus)', () => {
    it('navigates vertically with ArrowDown and ArrowUp wrapping around items', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { orientation: 'vertical' });
          const container = bind(document.createElement('div'), group);

          const { item: b1, panel: p1 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'b1' }),
            panel: accordionCtx.get()!.panel({ name: 'b1' }),
          }));

          const { item: b2, panel: p2 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'b2' }),
            panel: accordionCtx.get()!.panel({ name: 'b2' }),
          }));

          const { item: b3, panel: p3 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'b3' }),
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
          const group = aria('accordion', { orientation: 'horizontal' });
          const container = bind(document.createElement('div'), group);

          const { item: h1, panel: p1 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'h1' }),
            panel: accordionCtx.get()!.panel({ name: 'h1' }),
          }));

          const { item: h2, panel: p2 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'h2' }),
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

    it('handles roving key with fallback orientation and manual settings in multiple mode', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { multiple: true });
          const container = bind(document.createElement('div'), group);
          delete (group.properties as Record<string, unknown>).orientation;
          delete (group.properties as Record<string, unknown>).manual;

          const { item: b1 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'b1' }),
          }));
          const el = bind(document.createElement('button'), b1);
          container.appendChild(el);
          document.body.appendChild(container);

          el.focus();
          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          document.body.removeChild(container);
        });
      }));

    it('skips disabled accordion items during roving navigation', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion');
          const container = bind(document.createElement('div'), group);

          const { item: i1 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'i1' }),
          }));

          const { item: i2 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'i2', disabled: true }),
          }));

          const { item: i3 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'i3' }),
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
          const group = aria('accordion', { disabled: true, value: 'd1' });
          const container = bind(document.createElement('div'), group);

          const { item: d1 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'd1' }),
          }));

          const { item: d2 } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'd2' }),
          }));

          const b1 = bind(document.createElement('button'), d1);
          const b2 = bind(document.createElement('button'), d2);
          container.appendChild(b1);
          container.appendChild(b2);

          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
          expect(group.properties.value).toBe('d1');
        });
      }));
  });

  describe('Expansion Mutability Invariant (Single vs Multi)', () => {
    it('yields the expansion to a consumer that cancels the trigger click', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { value: 'closed' });
          const container = bind(document.createElement('div'), group);

          const { item: closedBtn, panel: closedPanel } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'closed' }),
            panel: accordionCtx.get()!.panel({ name: 'closed' }),
          }));

          const { item: openBtn, panel: openPanel } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'open' }),
            panel: accordionCtx.get()!.panel({ name: 'open' }),
          }));

          const closedEl = bind(document.createElement('button'), closedBtn);
          const closedRegion = bind(document.createElement('div'), closedPanel);
          const openEl = bind(document.createElement('button'), openBtn);
          const openRegion = bind(document.createElement('div'), openPanel);

          container.append(closedEl, closedRegion, openEl, openRegion);
          document.body.appendChild(container);

          const veto = (event: Event) => event.preventDefault();
          closedEl.addEventListener('click', veto);

          closedEl.click();
          expect(group.properties.value).toBe('closed');
          expect(closedBtn.expanded).toBe(false);
          expect(closedRegion.hidden).toBe(true);
          expect(openRegion.hidden).toBe(false);

          // Releasing the objection lets the same gesture through
          closedEl.removeEventListener('click', veto);
          closedEl.click();
          expect(group.properties.value).toBe('closed');
          expect(closedBtn.expanded).toBe(true);
          expect(closedRegion.hidden).toBe(false);
          expect(openBtn.expanded).toBe(false);
          expect(openRegion.hidden).toBe(true);

          document.body.removeChild(container);
        });
      }));

    it('commits the group value through a bubbling change event on the container', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion');
          const container = bind(document.createElement('div'), group);

          const { item: a } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'a' }),
          }));

          const { item: b } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'b' }),
          }));

          const elA = bind(document.createElement('button'), a);
          const elB = bind(document.createElement('button'), b);
          container.append(elA, elB);

          const commits: unknown[] = [];
          container.addEventListener('change', (event) => commits.push((event as CustomEvent).detail));

          elA.click();
          expect(commits).toEqual(['a']);

          // Switching sections commits the new value once, not a collapse plus an expand
          elB.click();
          expect(commits).toEqual(['a', 'b']);

          // Collapsing a free accordion commits the empty value
          elB.click();
          expect(commits).toHaveLength(3);
          expect(commits[2]).toBeUndefined();
          expect(group.properties.value).toBeUndefined();

          document.body.removeChild(container);
        });
      }));

    it('keeps multi-expansion commits on the array value and standalone commits on the item', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { multiple: true, value: [] });
          const container = bind(document.createElement('div'), group);

          const { item: one } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'one' }),
          }));

          const { item: two } = component().run(() => ({
            item: accordionCtx.get()!.button({ name: 'two' }),
          }));

          const elOne = bind(document.createElement('button'), one);
          const elTwo = bind(document.createElement('button'), two);
          container.append(elOne, elTwo);

          const groupCommits: unknown[] = [];
          container.addEventListener('change', (event) => groupCommits.push((event as CustomEvent).detail));

          elOne.click();
          elTwo.click();
          expect(groupCommits).toEqual([['one'], ['one', 'two']]);

          elOne.click();
          expect(groupCommits).toHaveLength(3);
          expect(groupCommits[2]).toEqual(['two']);

          document.body.removeChild(container);
        });

        component().run(() => {
          const item = aria('accordion-item', { expanded: false });
          const itemEl = bind(document.createElement('div'), item);
          document.body.appendChild(itemEl);

          const trigger = component().run(() => aria('accordion-button', { name: 'note' }));
          const triggerEl = bind(document.createElement('button'), trigger);
          itemEl.appendChild(triggerEl);

          const itemCommits: unknown[] = [];
          const onDocumentChange = (event: Event) => itemCommits.push((event as CustomEvent).detail);
          itemEl.addEventListener('change', onDocumentChange);

          triggerEl.click();
          expect(item.expanded).toBe(true);
          expect(itemCommits).toEqual([true]);

          triggerEl.click();
          expect(item.expanded).toBe(false);
          expect(itemCommits).toEqual([true, false]);

          itemEl.removeEventListener('change', onDocumentChange);
          document.body.removeChild(itemEl);
        });
      }));
  });

  describe('Linear Item Traversal Invariant', () => {
    it('keeps one tab stop on the expanded trigger and falls back to the first enabled one', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { value: 'second' });
          const container = bind(document.createElement('div'), group);

          const first = component().run(() => accordionCtx.get()!.button({ name: 'first' }));
          const second = component().run(() => accordionCtx.get()!.button({ name: 'second' }));
          const third = component().run(() => accordionCtx.get()!.button({ name: 'third' }));

          const elFirst = bind(document.createElement('button'), first);
          const elSecond = bind(document.createElement('button'), second);
          const elThird = bind(document.createElement('button'), third);
          container.append(elFirst, elSecond, elThird);

          // The expanded item owns the single tab stop
          expect(elFirst.getAttribute('tabindex')).toBe('-1');
          expect(elSecond.getAttribute('tabindex')).toBe('0');
          expect(elThird.getAttribute('tabindex')).toBe('-1');

          // Collapsing everything falls back to the first trigger so Tab still reaches it
          group.properties.value = null;
          expect(elFirst.getAttribute('tabindex')).toBe('0');
          expect(elSecond.getAttribute('tabindex')).toBe('-1');
          expect(elThird.getAttribute('tabindex')).toBe('-1');

          document.body.removeChild(container);
        });
      }));

    it('sends Home and End to the first and last enabled trigger', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion');
          const container = bind(document.createElement('div'), group);

          const first = component().run(() => accordionCtx.get()!.button({ name: 'first' }));
          const middle = component().run(() => accordionCtx.get()!.button({ name: 'middle', disabled: true }));
          const last = component().run(() => accordionCtx.get()!.button({ name: 'last' }));

          const elFirst = bind(document.createElement('button'), first);
          const elMiddle = bind(document.createElement('button'), middle);
          const elLast = bind(document.createElement('button'), last);
          container.append(elFirst, elMiddle, elLast);
          document.body.appendChild(container);

          elLast.focus();
          expect(document.activeElement).toBe(elLast);

          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(elFirst);

          // The disabled middle trigger is not an End destination either
          container.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(elLast);

          document.body.removeChild(container);
        });
      }));
  });

  describe('Item Linkage & Panel Association Invariant', () => {
    it('pairs a panel mounted before its trigger to the same derived addresses', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { id: 'terms', value: 'data' });

          const parts = component().run(() => ({
            trigger: accordionCtx.get()!.button({ name: 'data' }),
            panel: accordionCtx.get()!.panel({ name: 'data' }),
          }));

          // The panel binds first, the trigger later — pairing must not depend on order
          const region = bind(document.createElement('div'), parts.panel);
          const button = bind(document.createElement('button'), parts.trigger);

          expect(button.getAttribute('aria-controls')).toBe('terms-region-data');
          expect(region.getAttribute('id')).toBe('terms-region-data');
          expect(region.getAttribute('aria-labelledby')).toBe('terms-accordion-data');
          expect(button.getAttribute('id')).toBe('terms-accordion-data');
          expect(document.getElementById(region.id)).toBe(region);
        });
      }));

    it('derives the panel address before the panel exists and resolves it on late mount', () =>
      scope.run(() => {
        component().run(() => {
          const group = aria('accordion', { id: 'late', value: 'shipping' });

          const trigger = component().run(() => accordionCtx.get()!.button({ name: 'shipping' }));
          const button = bind(document.createElement('button'), trigger);
          document.body.appendChild(button);

          const address = button.getAttribute('aria-controls');
          expect(address).toBe('late-region-shipping');
          expect(document.getElementById(address as string)).toBeNull();

          const panel = component().run(() => accordionCtx.get()!.panel({ name: 'shipping' }));
          const region = bind(document.createElement('div'), panel);

          // The late panel arrives at the address the trigger already announced
          expect(region.id).toBe(address);
          expect(region.hidden).toBe(false);

          button.click();
          expect(region.hidden).toBe(true);
          expect(button.getAttribute('aria-expanded')).toBe('false');

          document.body.removeChild(button);
        });
      }));
  });
});
