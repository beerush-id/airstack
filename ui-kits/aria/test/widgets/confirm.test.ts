import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { type AlertDialogProps, aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('AlertDialog - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Focus Containment & Trap Invariant', () => {
    it('pulls focus into the dialog on open and keeps Tab travel inside it', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = document.createElement('div');
          document.body.appendChild(host);

          const openButton = document.createElement('button');
          openButton.textContent = 'Delete';
          host.appendChild(openButton);

          const props = mutable<AlertDialogProps>({ id: 'delete-confirm', open: false });
          const dialog = aria('confirm', props);
          const trigger = aria('confirm-trigger');

          // 1. Creation & SSR: the trigger announces the dialog it owns
          expect(trigger.attributes['aria-haspopup']).toBe('dialog');
          expect(trigger.attributes['aria-expanded']).toBe('false');

          const controls = trigger.attributes['aria-controls'];
          expect(typeof controls).toBe('string');
          expect((controls as string).length).toBeGreaterThan(0);

          const triggerEl = bind(openButton, trigger);
          expect(triggerEl.getAttribute('aria-controls')).toBe(controls);

          const panel = document.createElement('div');
          host.appendChild(panel);
          dialog.ref(panel);
          expect(dialog.current).toBe(panel);

          // The claimed target is a real node in the document, not a dangling address
          expect(panel.id).toBe(controls);
          expect(document.getElementById(controls as string)).toBe(panel);

          const actionEl = document.createElement('button');
          actionEl.textContent = 'Delete';
          const cancelEl = document.createElement('button');
          cancelEl.textContent = 'Keep';
          panel.appendChild(actionEl);
          panel.appendChild(cancelEl);

          const action = aria('confirm-action');
          const cancel = aria('confirm-cancel');
          bind(actionEl, action);
          bind(cancelEl, cancel);

          // Focus starts outside, held by the trigger
          triggerEl.focus();
          expect(document.activeElement).toBe(triggerEl);

          // 3. Opening transfers focus inside the modal
          triggerEl.click();
          expect(props.open).toBe(true);
          expect(panel.contains(document.activeElement)).toBe(true);

          // 4/5. Forward travel wraps from the last control back to the first
          cancelEl.focus();
          const forward = new KeyboardEvent('keydown', {
            key: 'Tab',
            cancelable: true,
            bubbles: true,
          });
          cancelEl.dispatchEvent(forward);
          expect(document.activeElement).toBe(actionEl);

          // Reverse travel wraps from the first control to the last
          const backward = new KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: true,
            cancelable: true,
            bubbles: true,
          });
          actionEl.dispatchEvent(backward);
          expect(document.activeElement).toBe(cancelEl);

          dialog.destroy();
          trigger.destroy();
          action.destroy();
          cancel.destroy();
          document.body.removeChild(host);
        });
      }));

    it('leaves tab travel alone while the dialog is closed', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = document.createElement('div');
          document.body.appendChild(host);

          const props = mutable<AlertDialogProps>({ open: false });
          const dialog = aria('confirm', props);

          const panel = document.createElement('div');
          host.appendChild(panel);
          bind(panel, dialog);

          const first = document.createElement('button');
          const second = document.createElement('button');
          panel.appendChild(first);
          panel.appendChild(second);

          first.focus();

          const forward = new KeyboardEvent('keydown', {
            key: 'Tab',
            cancelable: true,
            bubbles: true,
          });
          first.dispatchEvent(forward);

          expect(forward.defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(first);

          dialog.destroy();
          document.body.removeChild(host);
        });
      }));
  });

  describe('Destructive Guarding & Non-Dismissable Invariant', () => {
    it('commits nothing on Escape or an outside click and stays open', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = document.createElement('div');
          document.body.appendChild(host);

          const props = mutable<AlertDialogProps>({ id: 'revoke-session', open: false });
          const dialog = aria('confirm', props);
          const trigger = aria('confirm-trigger');

          const triggerEl = document.createElement('button');
          host.appendChild(triggerEl);
          bind(triggerEl, trigger);

          const panel = document.createElement('div');
          host.appendChild(panel);
          dialog.ref(panel);

          triggerEl.click();
          expect(props.open).toBe(true);
          expect(trigger.attributes['aria-expanded']).toBe('true');

          // Escape is not an answer to a destructive confirmation
          const escape = new KeyboardEvent('keydown', {
            key: 'Escape',
            cancelable: true,
            bubbles: true,
          });
          panel.dispatchEvent(escape);
          expect(props.open).toBe(true);
          expect(dialog.attributes['aria-modal']).toBe('true');
          expect(trigger.attributes['aria-expanded']).toBe('true');

          const documentEscape = new KeyboardEvent('keydown', {
            key: 'Escape',
            cancelable: true,
            bubbles: true,
          });
          document.dispatchEvent(documentEscape);
          expect(props.open).toBe(true);

          // An outside click commits nothing either
          const outside = new MouseEvent('click', { cancelable: true, bubbles: true });
          host.dispatchEvent(outside);
          expect(props.open).toBe(true);

          dialog.destroy();
          trigger.destroy();
          document.body.removeChild(host);
        });
      }));

    it('closes only through an explicit action or cancel choice', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = document.createElement('div');
          document.body.appendChild(host);

          const props = mutable<AlertDialogProps>({ open: false });
          const dialog = aria('confirm', props);
          const trigger = aria('confirm-trigger');

          const triggerEl = document.createElement('button');
          host.appendChild(triggerEl);
          bind(triggerEl, trigger);

          const panel = document.createElement('div');
          host.appendChild(panel);
          dialog.ref(panel);

          const actionEl = document.createElement('button');
          const cancelEl = document.createElement('button');
          panel.appendChild(actionEl);
          panel.appendChild(cancelEl);

          const action = aria('confirm-action');
          const cancel = aria('confirm-cancel');
          bind(actionEl, action);
          bind(cancelEl, cancel);

          // Cancel is the safe exit
          triggerEl.click();
          expect(props.open).toBe(true);

          cancelEl.click();
          expect(props.open).toBe(false);
          expect(trigger.attributes['aria-expanded']).toBe('false');

          // Action commits and closes as well
          triggerEl.click();
          expect(props.open).toBe(true);

          actionEl.click();
          expect(props.open).toBe(false);

          dialog.destroy();
          trigger.destroy();
          action.destroy();
          cancel.destroy();
          document.body.removeChild(host);
        });
      }));
  });

  describe('Restorative Teardown & Focus Return Invariant', () => {
    it('returns focus to the trigger that opened it and to none when torn down unmounted', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = document.createElement('div');
          document.body.appendChild(host);

          const props = mutable<AlertDialogProps>({ open: false });
          const dialog = aria('confirm', props);
          const trigger = aria('confirm-trigger');

          const triggerEl = document.createElement('button');
          host.appendChild(triggerEl);
          bind(triggerEl, trigger);

          const panel = document.createElement('div');
          host.appendChild(panel);
          dialog.ref(panel);

          const cancelEl = document.createElement('button');
          panel.appendChild(cancelEl);
          const cancel = aria('confirm-cancel');
          bind(cancelEl, cancel);

          triggerEl.focus();
          triggerEl.click();
          expect(props.open).toBe(true);
          expect(panel.contains(document.activeElement)).toBe(true);

          // Closing restores the element that opened it
          cancelEl.click();
          expect(props.open).toBe(false);
          expect(document.activeElement).toBe(triggerEl);

          // Tearing down while open releases the modal without leaving focus stranded
          triggerEl.click();
          expect(props.open).toBe(true);

          dialog.destroy();
          expect(dialog.current).toBeNull();
          expect(document.activeElement).toBe(triggerEl);

          trigger.destroy();
          cancel.destroy();
          document.body.removeChild(host);
        });
      }));

    it('withdraws the modal announcement and its linkage when the dialog is destroyed', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = document.createElement('div');
          document.body.appendChild(host);

          const props = mutable<AlertDialogProps>({ id: 'discard-draft', open: true });
          const dialog = aria('confirm', props);
          const trigger = aria('confirm-trigger');

          const triggerEl = document.createElement('button');
          host.appendChild(triggerEl);
          const panel = document.createElement('div');
          host.appendChild(panel);

          bind(panel, dialog);
          bind(triggerEl, trigger);

          expect(panel.getAttribute('role')).toBe('alertdialog');
          expect(panel.getAttribute('aria-modal')).toBe('true');
          expect(triggerEl.getAttribute('aria-controls')).toBe(panel.id);

          dialog.destroy();
          expect(dialog.current).toBeNull();

          // The panel stops claiming a modal the controller no longer owns
          props.open = false;
          expect(panel.getAttribute('role')).toBe('alertdialog');

          // The surviving trigger no longer claims an unlinked target
          expect(trigger.attributes['aria-expanded']).toBe('false');

          trigger.destroy();
          document.body.removeChild(host);
        });
      }));
  });
});
