import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type DisclosureEvent, type DisclosureProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function key(el: HTMLElement, type: string, keyName: string): KeyboardEvent {
  const event = new KeyboardEvent(type, { key: keyName, cancelable: true, bubbles: true });
  el.dispatchEvent(event);
  return event;
}

describe('Disclosure - Coverage (native host, guards & shielding)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Native Details Contract', () => {
    it('mirrors open on a details host and adopts browser toggles without re-dispatching', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<DisclosureProps>({ expanded: false });
          const disclosure = aria<HTMLDetailsElement>('disclosure', props, { native: true });
          const el = bind(document.createElement('details'), disclosure);

          expect(el.hasAttribute('open')).toBe(false);

          const announcements: unknown[] = [];
          el.addEventListener('toggle', (event) => announcements.push((event as DisclosureEvent).detail));

          el.open = true;
          el.dispatchEvent(new Event('toggle'));
          expect(props.expanded).toBe(true);
          expect(el.hasAttribute('open')).toBe(true);
          expect(announcements).toHaveLength(1);

          props.expanded = false;
          expect(el.open).toBe(false);
          expect(announcements).toHaveLength(1);

          disclosure.expanded = true;
          expect(props.expanded).toBe(true);
          expect(announcements).toHaveLength(1);

          disclosure.destroy();
          el.open = false;
          el.dispatchEvent(new Event('toggle'));
          expect(props.expanded).toBe(true);
          expect(disclosure.current).toBeNull();
        });
      }));

    it('stays silent on redundant and disabled commits', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<DisclosureProps>({ expanded: false });
          const disclosure = aria<HTMLDivElement>('disclosure', props, { native: false });
          const host = document.createElement('div');
          document.body.appendChild(host);
          disclosure.ref(host);

          const announcements: unknown[] = [];
          host.addEventListener('toggle', (event) => announcements.push((event as DisclosureEvent).detail));

          disclosure.expanded = false;
          expect(announcements).toHaveLength(0);

          disclosure.toggle();
          expect(props.expanded).toBe(true);
          expect(announcements).toEqual([true]);

          disclosure.assign({ disabled: true });
          disclosure.expanded = false;
          expect(props.expanded).toBe(true);
          expect(announcements).toHaveLength(1);

          disclosure.toggle();
          expect(props.expanded).toBe(true);
          expect(announcements).toHaveLength(1);

          disclosure.destroy();
          document.body.removeChild(host);
        });
      }));
  });

  describe('Trigger Guard Contract', () => {
    it('ignores foreign keys, pre-cancelled activation, and unarmed releases', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<DisclosureProps>({ expanded: false });
          const disclosure = aria('disclosure', props);
          const trigger = aria('disclosure-trigger');
          const el = bind(document.createElement('button'), trigger);

          key(el, 'keydown', 'a');
          expect(props.expanded).toBe(false);

          const denied = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          denied.preventDefault();
          el.dispatchEvent(denied);
          expect(props.expanded).toBe(false);

          key(el, 'keyup', 'a');
          expect(props.expanded).toBe(false);

          key(el, 'keyup', 'Enter');
          expect(props.expanded).toBe(false);

          key(el, 'keyup', ' ');
          expect(props.expanded).toBe(false);

          const blocked = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });
          blocked.preventDefault();
          el.dispatchEvent(blocked);
          expect(props.expanded).toBe(false);

          disclosure.destroy();
          trigger.destroy();
        });
      }));

    it('honours member-level disablement on both hosts', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<DisclosureProps>({ expanded: false });
          const disclosure = aria('disclosure', props);
          const nativeTrigger = aria('disclosure-trigger', { disabled: true });
          const nativeEl = bind(document.createElement('button'), nativeTrigger);

          expect(nativeTrigger.disabled).toBe(true);
          expect(nativeEl.disabled).toBe(true);
          expect(nativeEl.getAttribute('aria-disabled')).toBe('true');

          nativeEl.click();
          expect(props.expanded).toBe(false);

          key(nativeEl, 'keydown', 'Enter');
          expect(props.expanded).toBe(false);

          key(nativeEl, 'keyup', ' ');
          expect(props.expanded).toBe(false);

          nativeTrigger.toggle();
          expect(props.expanded).toBe(false);

          const customTrigger = aria<HTMLDivElement>('disclosure-trigger', { disabled: true }, { native: false });
          const customEl = bind(document.createElement('div'), customTrigger);

          expect(customEl.getAttribute('tabindex')).toBe('-1');
          expect(customEl.getAttribute('aria-disabled')).toBe('true');

          disclosure.destroy();
          nativeTrigger.destroy();
          customTrigger.destroy();
        });
      }));

    it('stays inert without a coordinator and namespaces its own pair', () =>
      scope.run(() => {
        component().run(() => {
          const trigger = aria('disclosure-trigger');
          const el = bind(document.createElement('button'), trigger);

          expect(trigger.expanded).toBe(false);
          expect(trigger.disabled).toBe(false);
          expect(el.getAttribute('aria-controls')).toBe(`${trigger.id}-panel`);
          expect(el.id).toBe(`${trigger.id}-trigger`);

          el.click();
          key(el, 'keydown', 'Enter');
          key(el, 'keyup', ' ');
          trigger.toggle();
          expect(trigger.expanded).toBe(false);

          trigger.destroy();

          const panel = aria('disclosure-panel');
          const panelEl = bind(document.createElement('div'), panel);

          expect(panel.expanded).toBe(false);
          expect(panelEl.hidden).toBe(true);
          expect(panelEl.getAttribute('aria-labelledby')).toBe(`${panel.id}-trigger`);
          expect(panelEl.id).toBe(`${panel.id}-panel`);

          panel.destroy();
        });
      }));
  });

  describe('Identity & Shielding Contract', () => {
    it('derives the pair from an author id and exposes managed keys on ownKeys', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const disclosure = aria('disclosure', { id: 'faq', expanded: false });
          const trigger = aria('disclosure-trigger');
          const panel = aria('disclosure-panel');

          expect(disclosure.id).toBe('faq');

          const triggerEl = bind(document.createElement('button'), trigger);
          const panelEl = bind(document.createElement('div'), panel);

          expect(triggerEl.id).toBe('faq-trigger');
          expect(triggerEl.getAttribute('aria-controls')).toBe('faq-panel');
          expect(panelEl.id).toBe('faq-panel');
          expect(panelEl.getAttribute('aria-labelledby')).toBe('faq-trigger');

          for (const key of ['id', 'expanded', 'disabled']) {
            expect(disclosure.ownKeys).toContain(key);
          }

          for (const key of ['id', 'disabled', 'aria-expanded', 'aria-controls', 'aria-disabled']) {
            expect(trigger.ownKeys).toContain(key);
          }

          expect(trigger.attributes.tabindex).toBeUndefined();

          const customTrigger = aria<HTMLDivElement>('disclosure-trigger', {}, { native: false });
          expect(customTrigger.ownKeys).toContain('tabindex');
          customTrigger.destroy();

          for (const key of ['id', 'role', 'aria-labelledby', 'hidden']) {
            expect(panel.ownKeys).toContain(key);
          }

          disclosure.destroy();
          trigger.destroy();
          panel.destroy();
          expect(panel.current).toBeNull();

          const bare = aria('disclosure');
          expect(bare.expanded).toBe(false);
          expect(bare.id).toMatch(/^disclosure-/);
          bare.destroy();
        });
      }));
  });
});
