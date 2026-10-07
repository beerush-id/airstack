import { withContext } from '@airlib/react';
import { describe, expect, it } from 'vitest';
import {
  ConfirmCancelAria,
  ConfirmDescriptionAria,
  ConfirmPanelAria,
  ConfirmTitleAria,
  ConfirmTriggerAria,
  confirm,
} from '../../src/composites/confirm.js';
import { bind } from '../utils.js';

describe('Confirm Composite - Coverage & Edge Cases', () => {
  describe('Standalone Part Resolution & Fallbacks', () => {
    it('falls back to default confirm ID when standalone parts created without ambient coordinator', () => {
      withContext(() => {
        const panel = new ConfirmPanelAria();
        const trigger = new ConfirmTriggerAria();
        const title = new ConfirmTitleAria();
        const desc = new ConfirmDescriptionAria();

        expect(panel.attributes.id).toBe('confirm-panel');
        expect(panel.attributes['aria-labelledby']).toBe('confirm-title');
        expect(panel.attributes['aria-describedby']).toBe('confirm-description');

        expect(trigger.attributes['aria-controls']).toBe('confirm-panel');
        expect(title.attributes.id).toBe('confirm-title');
        expect(desc.attributes.id).toBe('confirm-description');
      });
    });

    it('sets open property dynamically and toggles open state', () => {
      withContext(() => {
        const root = confirm();
        expect(root.open).toBe(false);

        root.open = true;
        expect(root.open).toBe(true);

        root.open = false;
        expect(root.open).toBe(false);

        root.toggle();
        expect(root.open).toBe(true);

        root.toggle();
        expect(root.open).toBe(false);

        root.close();
        expect(root.open).toBe(false);

        root.show();
        expect(root.open).toBe(true);
      });
    });
  });

  describe('Custom Host Accessibility Semantics (native: false)', () => {
    it('compiles role=button, tabindex, and aria-disabled on custom trigger hosts', () => {
      withContext(() => {
        const root = confirm();
        const enabledTrigger = root.trigger(undefined, { native: false });
        expect(enabledTrigger.attributes.role).toBe('button');
        expect(enabledTrigger.attributes.tabindex).toBe(0);
        expect(enabledTrigger.attributes['aria-disabled']).toBeUndefined();

        const disabledTrigger = root.trigger({ disabled: true }, { native: false });
        expect(disabledTrigger.attributes.role).toBe('button');
        expect(disabledTrigger.attributes.tabindex).toBe(-1);
        expect(disabledTrigger.attributes['aria-disabled']).toBe('true');
      });
    });

    it('compiles role=button, tabindex, and aria-disabled on custom action and cancel hosts', () => {
      withContext(() => {
        const root = confirm();
        const enabledAction = root.action(undefined, { native: false });
        expect(enabledAction.attributes.role).toBe('button');
        expect(enabledAction.attributes.tabindex).toBe(0);
        expect(enabledAction.attributes['aria-disabled']).toBeUndefined();

        const disabledAction = root.action({ disabled: true }, { native: false });
        expect(disabledAction.attributes.role).toBe('button');
        expect(disabledAction.attributes.tabindex).toBe(-1);
        expect(disabledAction.attributes['aria-disabled']).toBe('true');

        const enabledCancel = root.cancel(undefined, { native: false });
        expect(enabledCancel.attributes.role).toBe('button');
        expect(enabledCancel.attributes.tabindex).toBe(0);

        const disabledCancel = root.cancel({ disabled: true }, { native: false });
        expect(disabledCancel.attributes.role).toBe('button');
        expect(disabledCancel.attributes.tabindex).toBe(-1);
        expect(disabledCancel.attributes['aria-disabled']).toBe('true');
      });
    });

    it('prevents default click on disabled action and cancel custom buttons', () => {
      withContext(() => {
        const root = confirm({ open: true });
        const disabledAction = root.action({ disabled: true });
        const disabledCancel = root.cancel({ disabled: true });

        const actionEl = bind(document.createElement('div'), disabledAction);
        const cancelEl = bind(document.createElement('div'), disabledCancel);

        const actionEvt = new MouseEvent('click', { cancelable: true });
        actionEl.dispatchEvent(actionEvt);
        expect(actionEvt.defaultPrevented).toBe(true);
        expect(root.open).toBe(true);

        const cancelEvt = new MouseEvent('click', { cancelable: true });
        cancelEl.dispatchEvent(cancelEvt);
        expect(cancelEvt.defaultPrevented).toBe(true);
        expect(root.open).toBe(true);

        disabledAction.ref(null);
        disabledCancel.ref(null);
      });
    });
  });

  describe('Native Host Accessibility Semantics (native: true)', () => {
    it('compiles type=button and disabled attribute on native button hosts', () => {
      withContext(() => {
        const root = confirm();
        const trigger = root.trigger({ disabled: true }, { native: true });
        const action = root.action({ disabled: true }, { native: true });
        const cancel = root.cancel({ disabled: true }, { native: true });

        expect(trigger.attributes.type).toBe('button');
        expect(trigger.attributes.disabled).toBe(true);

        expect(action.attributes.type).toBe('button');
        expect(action.attributes.disabled).toBe(true);

        expect(cancel.attributes.type).toBe('button');
        expect(cancel.attributes.disabled).toBe(true);
      });
    });
  });

  describe('Detachment & Teardown Cleanups', () => {
    it('removes autofocus attribute from cancel button on unmount', () => {
      withContext(() => {
        const cancel = new ConfirmCancelAria();
        const btn = document.createElement('button');
        cancel.ref(btn);
        expect(btn.hasAttribute('autofocus')).toBe(true);

        cancel.ref(null);
        expect(btn.hasAttribute('autofocus')).toBe(false);
      });
    });

    it('cleans up overlay lifecycle listeners when panel unmounts', () => {
      withContext(() => {
        const root = confirm({ open: true });
        const panelEl = document.createElement('div');
        const panel = root.panel();

        panel.ref(panelEl);
        panel.ref(null);
      });
    });

    it('prevents default click on disabled trigger', () => {
      withContext(() => {
        const root = confirm({ open: false });
        const disabledTrigger = root.trigger({ disabled: true });
        const btn = bind(document.createElement('button'), disabledTrigger);

        const evt = new MouseEvent('click', { cancelable: true });
        btn.dispatchEvent(evt);

        expect(evt.defaultPrevented).toBe(true);
        expect(root.open).toBe(false);
      });
    });

    it('syncs open state when native dialog dispatches close event', () => {
      withContext(() => {
        const root = confirm({ open: true });
        const dialogEl = document.createElement('dialog');
        const panel = root.panel(undefined, { native: true });
        panel.ref(dialogEl);

        dialogEl.dispatchEvent(new Event('close'));
        expect(root.open).toBe(false);
      });
    });

    it('handles close on standalone panel without confirm coordinator', () => {
      withContext(() => {
        const panel = new ConfirmPanelAria(undefined, { native: true });
        const dialogEl = document.createElement('dialog');
        panel.ref(dialogEl);

        dialogEl.dispatchEvent(new Event('close'));
        panel.ref(null);
      });
    });

    it('prevents dialog close when confirm or cancel events are defaultPrevented', () => {
      withContext(() => {
        const root = confirm({ open: true });
        const action = root.action();
        const cancel = root.cancel();

        const actionEl = bind(document.createElement('button'), action);
        const cancelEl = bind(document.createElement('button'), cancel);

        actionEl.addEventListener('confirm', (e) => e.preventDefault());
        actionEl.click();
        expect(root.open).toBe(true);

        cancelEl.addEventListener('cancel', (e) => e.preventDefault());
        cancelEl.click();
        expect(root.open).toBe(true);

        action.ref(null);
        cancel.ref(null);
      });
    });

    it('invokes onConfirm and onCancel callbacks on coordinator', () => {
      withContext(() => {
        let confirmed = false;
        let canceled = false;
        const root = confirm({
          open: true,
          onConfirm: () => {
            confirmed = true;
          },
          onCancel: () => {
            canceled = true;
          },
        });

        const action = root.action();
        const cancel = root.cancel();
        const actionEl = bind(document.createElement('button'), action);
        const cancelEl = bind(document.createElement('button'), cancel);

        actionEl.click();
        expect(confirmed).toBe(true);

        cancelEl.click();
        expect(canceled).toBe(true);

        action.ref(null);
        cancel.ref(null);
      });
    });

    it('invokes lowercase onconfirm and oncancel callbacks', () => {
      withContext(() => {
        let confirmed = false;
        let canceled = false;
        const root = confirm({
          open: true,
          onconfirm: () => {
            confirmed = true;
          },
          oncancel: () => {
            canceled = true;
          },
        });

        const action = root.action();
        const cancel = root.cancel();
        const actionEl = bind(document.createElement('button'), action);
        const cancelEl = bind(document.createElement('button'), cancel);

        actionEl.click();
        expect(confirmed).toBe(true);

        cancelEl.click();
        expect(canceled).toBe(true);

        action.ref(null);
        cancel.ref(null);
      });
    });
  });
});
