import { withContext } from '@airlib/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ConfirmActionAria,
  ConfirmAria,
  ConfirmCancelAria,
  ConfirmDescriptionAria,
  ConfirmPanelAria,
  ConfirmTitleAria,
  ConfirmTriggerAria,
  confirm,
} from '../../src/composites/confirm.js';
import { DialogAria, DialogPanelAria } from '../../src/composites/dialog.js';
import { aria } from '../../src/index.js';
import { bind } from '../utils.js';

describe('Confirm Composite Widget (alertdialog)', () => {
  describe('Initialization & State Defaults', () => {
    it('creates coordinator with closed state and alertdialog role semantics', () => {
      withContext(() => {
        const root = confirm();
        expect(root).toBeInstanceOf(ConfirmAria);
        expect(root).toBeInstanceOf(DialogAria);
        expect(root.open).toBe(false);
        expect(root.modality).toBe('modal');
        expect(root.dismissable).toBe(false);

        const openRoot = confirm({ open: true, id: 'delete-confirm' });
        expect(openRoot.open).toBe(true);
        expect(openRoot.id).toBe('delete-confirm');
      });
    });

    it('instantiates via aria helper overloads', () => {
      withContext(() => {
        const root = aria('confirm', { id: 'diag-1' });
        const trigger = aria('confirm-trigger');
        const panel = aria('confirm-panel');
        const title = aria('confirm-title');
        const description = aria('confirm-description');
        const action = aria('confirm-action');
        const cancel = aria('confirm-cancel');

        expect(root).toBeInstanceOf(ConfirmAria);
        expect(root).toBeInstanceOf(DialogAria);
        expect(trigger).toBeInstanceOf(ConfirmTriggerAria);
        expect(panel).toBeInstanceOf(ConfirmPanelAria);
        expect(panel).toBeInstanceOf(DialogPanelAria);
        expect(title).toBeInstanceOf(ConfirmTitleAria);
        expect(description).toBeInstanceOf(ConfirmDescriptionAria);
        expect(action).toBeInstanceOf(ConfirmActionAria);
        expect(cancel).toBeInstanceOf(ConfirmCancelAria);
      });
    });
  });

  describe('Part Linkages & Accessibility Contract', () => {
    it('synchronizes aria-controls, labelledby, and describedby across sub-entities', () => {
      withContext(() => {
        const root = confirm({ id: 'confirm-order' });
        const trigger = root.trigger();
        const panel = root.panel();
        const title = root.title();
        const desc = root.description();
        const action = root.action();
        const cancel = root.cancel();

        expect(trigger.attributes['aria-controls']).toBe('confirm-order-panel');
        expect(trigger.attributes['aria-haspopup']).toBe('dialog');
        expect(trigger.attributes['aria-expanded']).toBe('false');

        expect(panel.attributes.role).toBe('alertdialog');
        expect(panel.attributes['aria-modal']).toBe('true');
        expect(panel.attributes['aria-labelledby']).toBe('confirm-order-title');
        expect(panel.attributes['aria-describedby']).toBe('confirm-order-description');
        expect(panel.attributes.id).toBe('confirm-order-panel');
        expect(panel.attributes.hidden).toBe(true);

        expect(title.attributes.id).toBe('confirm-order-title');
        expect(desc.attributes.id).toBe('confirm-order-description');

        expect(action.attributes.type).toBe('button');
        expect(cancel.attributes.type).toBe('button');
      });
    });

    it('omits role and hidden when bound to native HTMLDialogElement', () => {
      withContext(() => {
        const root = confirm({ id: 'native-confirm' });
        const panel = root.panel({ native: true });
        expect(panel.attributes.role).toBe('alertdialog');
        expect(panel.attributes.hidden).toBeUndefined();
      });
    });
  });

  describe('Interactions & Closing Logic', () => {
    it('toggles open state from trigger and closes from action or cancel buttons', () => {
      withContext(() => {
        const root = confirm();
        const trigger = root.trigger();
        const action = root.action();
        const cancel = root.cancel();

        const triggerEl = bind(document.createElement('button'), trigger);
        const actionEl = bind(document.createElement('button'), action);
        const cancelEl = bind(document.createElement('button'), cancel);

        const confirmSpy = vi.fn();
        const cancelSpy = vi.fn();
        actionEl.addEventListener('confirm', confirmSpy);
        cancelEl.addEventListener('cancel', cancelSpy);

        expect(root.open).toBe(false);

        // Click trigger
        triggerEl.click();
        expect(root.open).toBe(true);
        expect(trigger.attributes['aria-expanded']).toBe('true');

        // Click action button
        actionEl.click();
        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(root.open).toBe(false);
        expect(trigger.attributes['aria-expanded']).toBe('false');

        // Open again and click cancel button
        triggerEl.click();
        expect(root.open).toBe(true);

        cancelEl.click();
        expect(cancelSpy).toHaveBeenCalledTimes(1);
        expect(root.open).toBe(false);

        trigger.ref(null);
        action.ref(null);
        cancel.ref(null);
      });
    });

    it('bubbles confirm and cancel events to the panel container', () => {
      withContext(() => {
        const root = confirm({ open: true });
        const panel = root.panel();
        const action = root.action();
        const cancel = root.cancel();

        const panelEl = document.createElement('div');
        const actionEl = document.createElement('button');
        const cancelEl = document.createElement('button');
        panelEl.appendChild(actionEl);
        panelEl.appendChild(cancelEl);

        bind(panelEl, panel);
        bind(actionEl, action);
        bind(cancelEl, cancel);

        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        panelEl.addEventListener('confirm', onConfirm);
        panelEl.addEventListener('cancel', onCancel);

        actionEl.click();
        expect(onConfirm).toHaveBeenCalledTimes(1);

        root.open = true;
        cancelEl.click();
        expect(onCancel).toHaveBeenCalledTimes(1);

        panel.ref(null);
        action.ref(null);
        cancel.ref(null);
      });
    });

    it('locks out trigger and buttons when disabled', () => {
      withContext(() => {
        const root = confirm();
        const trigger = root.trigger({ disabled: true });
        const action = root.action({ disabled: true });

        const triggerEl = bind(document.createElement('button'), trigger);
        const actionEl = bind(document.createElement('button'), action);

        triggerEl.click();
        expect(root.open).toBe(false);

        root.show();
        actionEl.click();
        expect(root.open).toBe(true);

        trigger.ref(null);
        action.ref(null);
      });
    });
  });

  describe('Non-Dismissable Modal Contract', () => {
    it('suppresses Escape key dismiss and outside pointer dismissal', () => {
      withContext(() => {
        const root = confirm({ open: true });
        const panelEl = document.createElement('div');
        panelEl.tabIndex = -1;
        document.body.appendChild(panelEl);

        const panel = root.panel();
        bind(panelEl, panel);

        // Outside pointerdown
        const outsideEl = document.createElement('div');
        document.body.appendChild(outsideEl);
        outsideEl.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

        expect(root.open).toBe(true);

        // Escape keydown
        panelEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(root.open).toBe(true);

        panel.ref(null);
        document.body.removeChild(panelEl);
        document.body.removeChild(outsideEl);
      });
    });

    it('lands initial focus on ConfirmCancel button upon mounting open', async () => {
      await withContext(async () => {
        const root = confirm({ open: true });
        const panelEl = document.createElement('div');
        panelEl.tabIndex = -1;

        const actionBtn = document.createElement('button');
        const cancelBtn = document.createElement('button');
        panelEl.appendChild(actionBtn);
        panelEl.appendChild(cancelBtn);
        document.body.appendChild(panelEl);

        const panel = root.panel();
        const action = root.action();
        const cancel = root.cancel();

        bind(panelEl, panel);
        bind(actionBtn, action);
        bind(cancelBtn, cancel);

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });

        expect(document.activeElement).toBe(cancelBtn);

        panel.ref(null);
        action.ref(null);
        cancel.ref(null);
        document.body.removeChild(panelEl);
      });
    });

    it('restores focus to trigger upon closure', () => {
      withContext(() => {
        const root = confirm({ open: false });
        const triggerBtn = document.createElement('button');
        const panelEl = document.createElement('div');
        const cancelBtn = document.createElement('button');
        panelEl.appendChild(cancelBtn);

        document.body.appendChild(triggerBtn);
        document.body.appendChild(panelEl);

        const trigger = root.trigger();
        const panel = root.panel();
        const cancel = root.cancel();

        bind(triggerBtn, trigger);
        bind(panelEl, panel);
        bind(cancelBtn, cancel);

        triggerBtn.focus();
        expect(document.activeElement).toBe(triggerBtn);

        // Open
        triggerBtn.click();
        expect(root.open).toBe(true);

        // Close via cancel
        cancelBtn.click();
        expect(root.open).toBe(false);
        expect(document.activeElement).toBe(triggerBtn);

        trigger.ref(null);
        panel.ref(null);
        cancel.ref(null);
        document.body.removeChild(triggerBtn);
        document.body.removeChild(panelEl);
      });
    });

    it('invokes onConfirm and onCancel on coordinator without attaching element', () => {
      withContext(() => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        const root = confirm({ open: true, onConfirm, onCancel });

        const action = root.action();
        const cancel = root.cancel();
        const actionEl = bind(document.createElement('button'), action);
        const cancelEl = bind(document.createElement('button'), cancel);

        actionEl.click();
        expect(onConfirm).toHaveBeenCalledTimes(1);

        root.open = true;
        cancelEl.click();
        expect(onCancel).toHaveBeenCalledTimes(1);

        action.ref(null);
        cancel.ref(null);
      });
    });
  });
});
