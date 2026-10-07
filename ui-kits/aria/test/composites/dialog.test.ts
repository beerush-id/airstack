import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type DialogProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Dialog - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Dialog Structure & SSR Attribute Compilation', () => {
    it('compiles deterministic roles, linkages, and states without mounting DOM', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<DialogProps>({
            id: 'edit-profile',
            open: false,
            modality: 'modal',
            dismissable: true,
          });

          const dialog = aria('dialog', props);
          const trigger = aria('dialog-trigger');
          const panel = aria('dialog-panel');
          const title = aria('dialog-title');
          const description = aria('dialog-description');
          const close = aria('dialog-close');

          expect(dialog.id).toBe('edit-profile');
          expect(dialog.open).toBe(false);
          expect(dialog.attributes.role).toBeUndefined();
          expect(dialog.props.open).toBeUndefined();
          expect(dialog.props.modality).toBeUndefined();
          expect(dialog.props.dismissable).toBeUndefined();

          expect(trigger.attributes['aria-haspopup']).toBe('dialog');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(trigger.attributes['aria-controls']).toBe('edit-profile-panel');

          expect(panel.attributes.role).toBe('dialog');
          expect(panel.attributes['aria-modal']).toBe('true');
          expect(panel.attributes.id).toBe('edit-profile-panel');
          expect(panel.attributes['aria-labelledby']).toBe('edit-profile-title');
          expect(panel.attributes['aria-describedby']).toBe('edit-profile-description');
          expect(panel.attributes.hidden).toBe(true);

          expect(title.attributes.id).toBe('edit-profile-title');
          expect(description.attributes.id).toBe('edit-profile-description');

          expect(close.attributes.type).toBe('button');
        });
        tree.destroy();
      }));

    it('compiles nonmodal dialog with aria-modal="false"', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const _dialog = aria('dialog', {
            id: 'help-window',
            modality: 'nonmodal',
          });
          const panel = aria('dialog-panel');

          expect(panel.attributes['aria-modal']).toBe('false');
        });
        tree.destroy();
      }));
  });

  describe('Mount, Trigger & Close Interactions', () => {
    it('toggles dialog open state and updates panel visibility', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'confirm-box' });
          const trigger = aria('dialog-trigger');
          const panel = aria('dialog-panel');
          const close = aria('dialog-close');

          const triggerEl = bind(document.createElement('button'), trigger);
          const panelEl = bind(document.createElement('div'), panel);
          const closeEl = bind(document.createElement('button'), close);

          expect(dialog.open).toBe(false);
          expect(panelEl.hidden).toBe(true);

          triggerEl.click();
          expect(dialog.open).toBe(true);
          expect(trigger.attributes['aria-expanded']).toBe('true');
          expect(panelEl.hidden).toBe(false);

          closeEl.click();
          expect(dialog.open).toBe(false);
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(panelEl.hidden).toBe(true);
        });
        tree.destroy();
      }));

    it('closes dialog when clicking trigger with pointerdown while already open', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'toggle-box', open: true });
          const trigger = aria('dialog-trigger');
          const panel = aria('dialog-panel');

          const triggerEl = bind(document.createElement('button'), trigger);
          const panelEl = bind(document.createElement('div'), panel);
          document.body.appendChild(triggerEl);
          document.body.appendChild(panelEl);

          expect(dialog.open).toBe(true);

          triggerEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          triggerEl.click();

          expect(dialog.open).toBe(false);

          triggerEl.remove();
          panelEl.remove();
        });
        tree.destroy();
      }));

    it('provides show(), close(), and toggle() methods on the dialog coordinator', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'prompt-box' });
          expect(dialog.open).toBe(false);

          dialog.show();
          expect(dialog.open).toBe(true);

          dialog.close();
          expect(dialog.open).toBe(false);

          dialog.toggle();
          expect(dialog.open).toBe(true);

          dialog.toggle();
          expect(dialog.open).toBe(false);
        });
        tree.destroy();
      }));
  });

  describe('Dismissal & Event Lifecycle', () => {
    it('dispatches cancel and close events on custom panel on Escape keydown', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'modal-event-box', open: true });
          const panel = aria('dialog-panel');
          const panelEl = bind(document.createElement('div'), panel);
          document.body.appendChild(panelEl);

          const cancelSpy = vi.fn();
          const closeSpy = vi.fn();
          panelEl.addEventListener('cancel', cancelSpy);
          panelEl.addEventListener('close', closeSpy);

          const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
          panelEl.dispatchEvent(escEvent);

          expect(cancelSpy).toHaveBeenCalledTimes(1);
          expect(closeSpy).toHaveBeenCalledTimes(1);
          expect(dialog.open).toBe(false);

          document.body.removeChild(panelEl);
        });
        tree.destroy();
      }));

    it('honors cancel event preventDefault to veto dismissal on Escape', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'veto-box', open: true });
          const panel = aria('dialog-panel');
          const panelEl = bind(document.createElement('div'), panel);
          document.body.appendChild(panelEl);

          panelEl.addEventListener('cancel', (e) => {
            e.preventDefault();
          });

          const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
          panelEl.dispatchEvent(escEvent);

          expect(dialog.open).toBe(true);
          expect(panelEl.hidden).toBe(false);

          document.body.removeChild(panelEl);
        });
        tree.destroy();
      }));

    it('ignores Escape when dismissable is false', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'locked-box', open: true, dismissable: false });
          const panel = aria('dialog-panel');
          const panelEl = bind(document.createElement('div'), panel);
          document.body.appendChild(panelEl);

          const cancelSpy = vi.fn();
          panelEl.addEventListener('cancel', cancelSpy);

          const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
          panelEl.dispatchEvent(escEvent);

          expect(cancelSpy).not.toHaveBeenCalled();
          expect(dialog.open).toBe(true);

          document.body.removeChild(panelEl);
        });
        tree.destroy();
      }));
  });

  describe('Focus Management & Restoration', () => {
    it('restores focus to trigger upon closing', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'focus-test' });
          const trigger = aria('dialog-trigger');
          const panel = aria('dialog-panel');
          const close = aria('dialog-close');

          const triggerEl = bind(document.createElement('button'), trigger);
          const panelEl = bind(document.createElement('div'), panel);
          const closeEl = bind(document.createElement('button'), close);
          panelEl.appendChild(closeEl);

          document.body.appendChild(triggerEl);
          document.body.appendChild(panelEl);

          triggerEl.focus();
          expect(document.activeElement).toBe(triggerEl);

          triggerEl.click();
          expect(dialog.open).toBe(true);

          closeEl.click();
          expect(dialog.open).toBe(false);
          expect(document.activeElement).toBe(triggerEl);

          document.body.removeChild(triggerEl);
          document.body.removeChild(panelEl);
        });
        tree.destroy();
      }));

    it('restores focus to previously active element upon programmatic show() and close()', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'prog-focus-test' });
          const panel = aria('dialog-panel');
          const panelEl = bind(document.createElement('div'), panel);

          const externalBtn = document.createElement('button');
          document.body.appendChild(externalBtn);
          document.body.appendChild(panelEl);

          externalBtn.focus();
          expect(document.activeElement).toBe(externalBtn);

          dialog.show();
          expect(dialog.open).toBe(true);

          dialog.close();
          expect(dialog.open).toBe(false);
          expect(document.activeElement).toBe(externalBtn);

          document.body.removeChild(externalBtn);
          document.body.removeChild(panelEl);
        });
        tree.destroy();
      }));

    it('traps focus within panel on Tab and Shift+Tab when modal', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const _dialog = aria('dialog', { id: 'trap-test', open: true, modality: 'modal' });
          const panel = aria('dialog-panel');
          const panelEl = bind(document.createElement('div'), panel);

          const firstBtn = document.createElement('button');
          const lastBtn = document.createElement('button');
          panelEl.appendChild(firstBtn);
          panelEl.appendChild(lastBtn);
          document.body.appendChild(panelEl);

          firstBtn.focus();
          expect(document.activeElement).toBe(firstBtn);

          // Shift+Tab on first element wraps to last element
          const shiftTab = new KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          });
          firstBtn.dispatchEvent(shiftTab);
          expect(shiftTab.defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(lastBtn);

          // Tab on last element wraps to first element
          const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, bubbles: true, cancelable: true });
          lastBtn.dispatchEvent(tab);
          expect(tab.defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(firstBtn);

          document.body.removeChild(panelEl);
        });
        tree.destroy();
      }));

    it('does not trap focus when dialog is nonmodal', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const _dialog = aria('dialog', { id: 'nonmodal-trap-test', open: true, modality: 'nonmodal' });
          const panel = aria('dialog-panel');
          const panelEl = bind(document.createElement('div'), panel);

          const btn = document.createElement('button');
          panelEl.appendChild(btn);
          document.body.appendChild(panelEl);

          btn.focus();
          const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
          btn.dispatchEvent(tab);
          expect(tab.defaultPrevented).toBe(false);

          document.body.removeChild(panelEl);
        });
        tree.destroy();
      }));
  });

  describe('Native <dialog> Integration', () => {
    it('delegates to native showModal() and close() on HTMLDialogElement', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const dialog = aria('dialog', { id: 'native-box' });
          const panel = aria('dialog-panel' as never, {}, { native: true });

          const dialogEl = document.createElement('dialog');
          dialogEl.showModal = vi.fn();
          dialogEl.close = vi.fn();

          bind(dialogEl, panel);

          dialog.show();
          expect(dialogEl.showModal).toHaveBeenCalledTimes(1);

          dialog.close();
          expect(dialogEl.close).toHaveBeenCalledTimes(1);
        });
        tree.destroy();
      }));
  });
});
