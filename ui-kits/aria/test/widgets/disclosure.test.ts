import { type AnyType, createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type DisclosureProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Disclosure - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Disclosure Expansion & Visibility Invariant', () => {
    it('toggles through pointer, Enter, and Space while the panel follows with hidden', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<DisclosureProps>({ expanded: false });
          const disclosure = aria('disclosure', props);
          const trigger = aria('disclosure-trigger');
          const panel = aria('disclosure-panel');

          // 1. Creation & SSR
          expect(disclosure.expanded).toBe(false);
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(panel.attributes['aria-labelledby']).toBeDefined();

          // 2. DOM Binding
          const triggerEl = bind(document.createElement('button'), trigger);
          const panelEl = bind(document.createElement('div'), panel);

          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');
          expect(panelEl.hidden).toBe(true);

          // 3. Pointer activation reveals the panel
          triggerEl.click();
          expect(props.expanded).toBe(true);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');
          expect(panelEl.hidden).toBe(false);

          triggerEl.click();
          expect(props.expanded).toBe(false);
          expect(panelEl.hidden).toBe(true);

          // 4. Enter toggles on keydown
          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }));
          expect(props.expanded).toBe(true);
          expect(panelEl.hidden).toBe(false);

          // Space suppresses the scroll; a full press is one toggle
          const space = new KeyboardEvent('keydown', {
            key: ' ',
            cancelable: true,
            bubbles: true,
          });
          triggerEl.dispatchEvent(space);
          expect(space.defaultPrevented).toBe(true);

          triggerEl.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(props.expanded).toBe(false);
          expect(panelEl.hidden).toBe(true);

          // 6. Teardown
          disclosure.destroy();
          trigger.destroy();
          panel.destroy();
          expect(trigger.current).toBeNull();
        });
      }));

    it('yields to a consumer that cancels the activation and stays put when disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<DisclosureProps>({ expanded: false });
          const disclosure = aria('disclosure', props);
          const trigger = aria('disclosure-trigger');
          const panel = aria('disclosure-panel');

          const triggerEl = bind(document.createElement('button'), trigger);
          const panelEl = bind(document.createElement('div'), panel);

          const veto = (event: Event) => event.preventDefault();
          triggerEl.addEventListener('click', veto, { capture: true });

          triggerEl.click();
          expect(props.expanded).toBe(false);
          expect(panelEl.hidden).toBe(true);

          triggerEl.removeEventListener('click', veto, { capture: true });
          triggerEl.click();
          expect(props.expanded).toBe(true);

          // A disabled disclosure claims nothing and changes nothing
          disclosure.assign({ disabled: true });
          expect(triggerEl.getAttribute('aria-disabled')).toBe('true');

          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          triggerEl.dispatchEvent(click);
          expect(props.expanded).toBe(true);

          const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            cancelable: true,
            bubbles: true,
          });
          triggerEl.dispatchEvent(enter);
          expect(enter.defaultPrevented).toBe(true);
          expect(props.expanded).toBe(true);

          disclosure.destroy();
          trigger.destroy();
          panel.destroy();
        });
      }));
  });

  describe('Control Association & Linkage Invariant', () => {
    it('resolves the trigger-to-panel and panel-to-trigger addresses to live nodes', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const disclosure = aria('disclosure', { expanded: true });
          const trigger = aria('disclosure-trigger');
          const panel = aria('disclosure-panel');

          const controls = trigger.attributes['aria-controls'];
          const labelledby = panel.attributes['aria-labelledby'];
          expect(typeof controls).toBe('string');
          expect(typeof labelledby).toBe('string');

          const host = document.createElement('div');
          document.body.appendChild(host);

          const triggerEl = document.createElement('button');
          const panelEl = document.createElement('div');
          host.appendChild(triggerEl);
          host.appendChild(panelEl);

          bind(triggerEl, trigger);
          bind(panelEl, panel);

          // Each address points at the other element, and nothing else answers to it
          expect(panelEl.id).toBe(controls);
          expect(triggerEl.id).toBe(labelledby);
          expect(document.getElementById(controls as AnyType)).toBe(panelEl);
          expect(document.getElementById(labelledby as AnyType)).toBe(triggerEl);

          // The addresses survive the state they were derived beside
          triggerEl.click();
          expect(disclosure.expanded).toBe(false);
          expect(triggerEl.getAttribute('aria-controls')).toBe(controls);
          expect(panelEl.getAttribute('aria-labelledby')).toBe(labelledby);

          disclosure.destroy();
          trigger.destroy();
          panel.destroy();
          document.body.removeChild(host);
        });
      }));

    it('keeps the region role announced while the panel is hidden', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<DisclosureProps>({ expanded: true });
          const disclosure = aria('disclosure', props);
          const panel = aria('disclosure-panel');

          const panelEl = bind(document.createElement('section'), panel);
          expect(panelEl.getAttribute('role')).toBe('region');
          expect(panelEl.hidden).toBe(false);

          // 5. Reconciliation: the collapse is carried by hidden, not by dropping semantics
          props.expanded = false;
          expect(panelEl.hidden).toBe(true);
          expect(panelEl.getAttribute('role')).toBe('region');
          expect(panelEl.hasAttribute('aria-hidden')).toBe(false);

          props.expanded = true;
          expect(panelEl.hidden).toBe(false);

          disclosure.destroy();
          panel.destroy();
        });
      }));
  });

  describe('Host Parity & Native Summary Invariant', () => {
    it('dispatches a non-bubbling toggle CustomEvent on a custom host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<DisclosureProps>({ expanded: false });
          const disclosure = aria<HTMLDivElement>('disclosure', props, { native: false });
          const trigger = aria<HTMLButtonElement>('disclosure-trigger');

          const host = document.createElement('div');
          document.body.appendChild(host);
          disclosure.ref(host);

          const triggerEl = document.createElement('button');
          host.appendChild(triggerEl);
          bind(triggerEl, trigger);

          const seen: Array<{ detail: unknown; bubbles: boolean }> = [];
          host.addEventListener('toggle', (event) =>
            seen.push({ detail: (event as AnyType).detail, bubbles: event.bubbles })
          );

          const onDocument = vi.fn();
          document.addEventListener('toggle', onDocument);

          triggerEl.click();

          // The expansion announcement is for the disclosure element, not the page
          expect(seen).toHaveLength(1);
          expect(seen[0].detail).toBe(true);
          expect(seen[0].bubbles).toBe(false);
          expect(onDocument).not.toHaveBeenCalled();

          triggerEl.click();
          expect(seen).toHaveLength(2);
          expect(seen[1].detail).toBe(false);
          expect(onDocument).not.toHaveBeenCalled();

          document.removeEventListener('toggle', onDocument);
          disclosure.destroy();
          trigger.destroy();
          document.body.removeChild(host);
        });
      }));

    it('omits the redundant button role on a native trigger and keeps it on a custom one', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeDisclosure = aria('disclosure', { expanded: false });
          const nativeTrigger = aria('disclosure-trigger');
          const nativePanel = aria('disclosure-panel');

          const nativeTriggerEl = bind(document.createElement('button'), nativeTrigger);
          expect(nativeTriggerEl.hasAttribute('role')).toBe(false);
          expect(nativeTriggerEl.getAttribute('aria-expanded')).toBe('false');

          nativeTriggerEl.click();
          expect(nativeDisclosure.expanded).toBe(true);

          nativeDisclosure.destroy();
          nativeTrigger.destroy();
          nativePanel.destroy();

          const customDisclosure = aria('disclosure', { expanded: false });
          const customTrigger = aria<HTMLDivElement>('disclosure-trigger', {}, { native: false });
          const customTriggerEl = bind(document.createElement('div'), customTrigger);

          expect(customTriggerEl.getAttribute('role')).toBe('button');
          expect(customTriggerEl.getAttribute('tabindex')).toBe('0');
          expect(customTriggerEl.getAttribute('aria-expanded')).toBe('false');

          customTriggerEl.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true })
          );
          expect(customDisclosure.expanded).toBe(true);
          expect(customTriggerEl.getAttribute('aria-expanded')).toBe('true');

          customDisclosure.destroy();
          customTrigger.destroy();
        });
      }));
  });
});
