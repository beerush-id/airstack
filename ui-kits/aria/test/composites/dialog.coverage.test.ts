import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, DialogAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Dialog - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Coordinator Instance Factories & Default ID', () => {
    it('spawns child parts directly from DialogAria instance methods', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = new DialogAria();
          expect(dialog.id).toMatch(/^dialog-/);

          const trigger = dialog.trigger();
          const panel = dialog.panel();
          const close = dialog.closeButton();
          const title = dialog.title();
          const description = dialog.description();

          expect(trigger.attributes['aria-controls']).toBe(`${dialog.id}-panel`);
          expect(panel.attributes.id).toBe(`${dialog.id}-panel`);
          expect(close.attributes.type).toBe('button');
          expect(title.attributes.id).toBe(`${dialog.id}-title`);
          expect(description.attributes.id).toBe(`${dialog.id}-description`);
        });
        tree.destroy();
      }));
  });

  describe('Custom Host (Non-Native) Trigger & Close Buttons', () => {
    it('compiles role="button" and tabindex="0" on custom trigger and close', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const _dialog = aria('dialog', { id: 'custom-btn-dialog' });
          const trigger = aria('dialog-trigger', {}, { native: false });
          const close = aria('dialog-close', {}, { native: false });

          expect(trigger.attributes.role).toBe('button');
          expect(trigger.attributes.tabindex).toBe(0);
          expect(trigger.attributes.type).toBeUndefined();

          expect(close.attributes.role).toBe('button');
          expect(close.attributes.tabindex).toBe(0);
          expect(close.attributes.type).toBeUndefined();

          // Disabled custom trigger and close
          const disabledTrigger = aria('dialog-trigger', { disabled: true }, { native: false });
          const disabledClose = aria('dialog-close', { disabled: true }, { native: false });

          expect(disabledTrigger.attributes.role).toBe('button');
          expect(disabledTrigger.attributes.tabindex).toBe(-1);
          expect(disabledTrigger.attributes['aria-disabled']).toBe('true');

          expect(disabledClose.attributes.role).toBe('button');
          expect(disabledClose.attributes.tabindex).toBe(-1);
          expect(disabledClose.attributes['aria-disabled']).toBe('true');
        });
        tree.destroy();
      }));

    it('ignores clicks on disabled trigger or close', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'disabled-dialog' });
          const trigger = aria('dialog-trigger', { disabled: true });
          const close = aria('dialog-close', { disabled: true });

          const triggerEl = bind(document.createElement('button'), trigger);
          const closeEl = bind(document.createElement('button'), close);

          triggerEl.click();
          expect(dialog.open).toBe(false);

          dialog.open = true;
          closeEl.click();
          expect(dialog.open).toBe(true);
        });
        tree.destroy();
      }));

    it('ignores clicks when event.defaultPrevented is true', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'veto-click-dialog' });
          const trigger = aria('dialog-trigger');
          const close = aria('dialog-close');

          const triggerEl = bind(document.createElement('button'), trigger);
          const closeEl = bind(document.createElement('button'), close);

          triggerEl.addEventListener('click', (e) => e.preventDefault(), { capture: true });
          closeEl.addEventListener('click', (e) => e.preventDefault(), { capture: true });

          triggerEl.click();
          expect(dialog.open).toBe(false);

          dialog.open = true;
          closeEl.click();
          expect(dialog.open).toBe(true);
        });
        tree.destroy();
      }));
  });

  describe('Outside Click Dismissal Lifecycle', () => {
    it('closes on pointerdown outside the panel and ignores clicks inside', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'outside-dialog', open: true });
          const panel = aria('dialog-panel');

          const panelEl = bind(document.createElement('div'), panel);
          const childEl = document.createElement('span');
          panelEl.appendChild(childEl);
          document.body.appendChild(panelEl);

          // Click inside child
          const insideEvent = new MouseEvent('pointerdown', { bubbles: true });
          childEl.dispatchEvent(insideEvent);
          expect(dialog.open).toBe(true);

          // Click outside on document body
          const outsideEvent = new MouseEvent('pointerdown', { bubbles: true });
          document.body.dispatchEvent(outsideEvent);
          expect(dialog.open).toBe(false);

          // Click outside when dialog is closed
          document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
          expect(dialog.open).toBe(false);

          // Click outside when dismissable is false
          dialog.open = true;
          dialog.assign({ dismissable: false });
          document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
          expect(dialog.open).toBe(true);

          document.body.removeChild(panelEl);
        });
        tree.destroy();
      }));

    it('cleans up outside click listener on panel detachment', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'detach-dialog', open: true });
          const panel = aria('dialog-panel');

          const panelEl = bind(document.createElement('div'), panel);
          document.body.appendChild(panelEl);

          // Detach panel
          panel.ref(null);

          const outsideEvent = new MouseEvent('pointerdown', { bubbles: true });
          document.body.dispatchEvent(outsideEvent);

          // Dialog open state not affected after unmount
          expect(dialog.open).toBe(true);

          document.body.removeChild(panelEl);
        });
        tree.destroy();
      }));
  });

  describe('Native <dialog> Cancel and Close Handlers', () => {
    it('handles native nonmodal dialog show() and close()', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'native-nonmodal', modality: 'nonmodal' });
          const panel = aria('dialog-panel', {}, { native: true });

          const dialogEl = document.createElement('dialog');
          dialogEl.show = vi.fn();
          dialogEl.close = vi.fn();

          bind(dialogEl, panel);

          dialog.show();
          expect(dialogEl.show).toHaveBeenCalledTimes(1);

          dialog.close();
          expect(dialogEl.close).toHaveBeenCalledTimes(1);
        });
        tree.destroy();
      }));

    it('handles native cancel event with preventDefault when dismissable is false', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'native-cancel-veto', open: true, dismissable: false });
          const panel = aria('dialog-panel', {}, { native: true });

          const dialogEl = document.createElement('dialog');
          bind(dialogEl, panel);

          const cancelEvt = new Event('cancel', { cancelable: true });
          dialogEl.dispatchEvent(cancelEvt);

          expect(cancelEvt.defaultPrevented).toBe(true);
          expect(dialog.open).toBe(true);
        });
        tree.destroy();
      }));

    it('syncs open = false on native cancel when dismissable is true', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'native-cancel-sync', open: true, dismissable: true });
          const panel = aria('dialog-panel', {}, { native: true });

          const dialogEl = document.createElement('dialog');
          bind(dialogEl, panel);

          const cancelEvt = new Event('cancel', { cancelable: true });
          dialogEl.dispatchEvent(cancelEvt);

          expect(dialog.open).toBe(false);
        });
        tree.destroy();
      }));

    it('syncs open = false on native close event', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'native-close-sync', open: true });
          const panel = aria('dialog-panel', {}, { native: true });

          const dialogEl = document.createElement('dialog');
          bind(dialogEl, panel);

          dialogEl.dispatchEvent(new Event('close'));
          expect(dialog.open).toBe(false);
        });
        tree.destroy();
      }));
  });

  describe('Keydown Edge Cases on Panel', () => {
    it('ignores non-Escape keys and keydown when dialog is closed', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'ignore-key-dialog', open: false });
          const panel = aria('dialog-panel');
          const panelEl = bind(document.createElement('div'), panel);

          panelEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          expect(dialog.open).toBe(false);

          panelEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          expect(dialog.open).toBe(false);
        });
        tree.destroy();
      }));
  });

  describe('Autonomous (Detached) Part Instantiation', () => {
    it('compiles safe defaults when instantiated without an ambient dialog context', () =>
      scope.run(() => {
        const trigger = aria('dialog-trigger');
        const panel = aria('dialog-panel');
        const close = aria('dialog-close');
        const title = aria('dialog-title');
        const description = aria('dialog-description');

        expect(trigger.attributes['aria-controls']).toBe('dialog-panel');
        expect(panel.attributes.id).toBe('dialog-panel');
        expect(close.attributes.type).toBe('button');
        expect(title.attributes.id).toBe('dialog-title');
        expect(description.attributes.id).toBe('dialog-description');

        const triggerEl = bind(document.createElement('button'), trigger);
        triggerEl.click();

        const closeEl = bind(document.createElement('button'), close);
        closeEl.click();

        // Native detached panel lifecycle
        const nativePanel = aria('dialog-panel', {}, { native: true });
        const dialogEl = document.createElement('dialog');
        bind(dialogEl, nativePanel);

        dialogEl.dispatchEvent(new Event('close'));
        dialogEl.dispatchEvent(new Event('cancel'));
        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      }));
  });
});
