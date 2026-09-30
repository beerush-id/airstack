import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type DialogProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Dialog - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Focus Containment & Trap Invariant', () => {
    it('moves focus inside on open, cycles it within the panel, and returns it on close', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = document.createElement('div');
          document.body.appendChild(host);

          const props = mutable<DialogProps>({ open: false, modality: 'modal' });
          const dialog = aria('dialog', props);
          const trigger = aria('dialog-trigger');
          const close = aria('dialog-close');

          const triggerEl = document.createElement('button');
          host.appendChild(triggerEl);
          bind(triggerEl, trigger);

          const panel = document.createElement('div');
          host.appendChild(panel);
          dialog.ref(panel);

          const bodyField = document.createElement('input');
          const closeEl = document.createElement('button');
          panel.appendChild(bodyField);
          panel.appendChild(closeEl);
          bind(closeEl, close);

          triggerEl.focus();
          expect(document.activeElement).toBe(triggerEl);

          // 3. Open: focus enters the dialog without the trigger being clicked away
          triggerEl.click();
          expect(props.open).toBe(true);
          expect(panel.contains(document.activeElement)).toBe(true);

          // 4/5. Forward travel wraps at the end, reverse travel wraps at the start
          closeEl.focus();
          const forward = new KeyboardEvent('keydown', {
            key: 'Tab',
            cancelable: true,
            bubbles: true,
          });
          closeEl.dispatchEvent(forward);
          expect(document.activeElement).toBe(bodyField);

          const backward = new KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: true,
            cancelable: true,
            bubbles: true,
          });
          bodyField.dispatchEvent(backward);
          expect(document.activeElement).toBe(closeEl);

          // 6. Closing hands focus back to the element that opened it
          closeEl.click();
          expect(props.open).toBe(false);
          expect(document.activeElement).toBe(triggerEl);

          dialog.destroy();
          trigger.destroy();
          close.destroy();
          document.body.removeChild(host);
        });
      }));

    it('leaves tab travel free while the dialog is nonmodal', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = document.createElement('div');
          document.body.appendChild(host);

          const props = mutable<DialogProps>({ open: true, modality: 'nonmodal' });
          const dialog = aria('dialog', props);

          const panel = document.createElement('div');
          host.appendChild(panel);
          bind(panel, dialog);

          const inside = document.createElement('button');
          panel.appendChild(inside);

          const outside = document.createElement('button');
          host.appendChild(outside);

          expect(panel.getAttribute('aria-modal')).toBe('false');

          inside.focus();
          const forward = new KeyboardEvent('keydown', {
            key: 'Tab',
            cancelable: true,
            bubbles: true,
          });
          inside.dispatchEvent(forward);

          // A nonmodal dialog has no claim on where focus goes next
          expect(forward.defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(inside);

          outside.focus();
          expect(document.activeElement).toBe(outside);

          dialog.destroy();
          document.body.removeChild(host);
        });
      }));
  });

  describe('Dismissal & Escape Traversal Invariant', () => {
    it('routes Escape through a cancelable event and commits only when nothing objects', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = document.createElement('div');
          document.body.appendChild(host);

          const props = mutable<DialogProps>({ open: true, modality: 'modal', dismissable: true });
          const dialog = aria('dialog', props);

          const panel = document.createElement('div');
          host.appendChild(panel);
          bind(panel, dialog);

          const closes = vi.fn();
          panel.addEventListener('close', closes);

          // A listener may veto the dismissal
          const veto = (event: Event) => event.preventDefault();
          panel.addEventListener('cancel', veto);

          const escape = new KeyboardEvent('keydown', {
            key: 'Escape',
            cancelable: true,
            bubbles: true,
          });
          panel.dispatchEvent(escape);

          expect(props.open).toBe(true);
          expect(closes).not.toHaveBeenCalled();

          // With the objection withdrawn, the same key closes the dialog
          panel.removeEventListener('cancel', veto);

          const cancelSeen: boolean[] = [];
          panel.addEventListener('cancel', (event) => cancelSeen.push(event.cancelable));

          const secondEscape = new KeyboardEvent('keydown', {
            key: 'Escape',
            cancelable: true,
            bubbles: true,
          });
          panel.dispatchEvent(secondEscape);

          expect(cancelSeen).toEqual([true]);
          expect(props.open).toBe(false);
          expect(closes).toHaveBeenCalledTimes(1);

          // Closing is not re-announced for an already-closed dialog
          panel.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }),
          );
          expect(closes).toHaveBeenCalledTimes(1);

          dialog.destroy();
          document.body.removeChild(host);
        });
      }));

    it('honors an outside click only while the dialog is dismissable', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = document.createElement('div');
          document.body.appendChild(host);

          const props = mutable<DialogProps>({ open: true, modality: 'modal', dismissable: true });
          const dialog = aria('dialog', props);

          const panel = document.createElement('div');
          host.appendChild(panel);
          bind(panel, dialog);

          const inside = document.createElement('button');
          panel.appendChild(inside);

          const closes = vi.fn();
          panel.addEventListener('close', closes);

          // A click inside the panel is not a dismissal signal
          inside.click();
          expect(props.open).toBe(true);
          expect(closes).not.toHaveBeenCalled();

          // A click on the background commits the close
          const outside = new MouseEvent('click', { cancelable: true, bubbles: true });
          host.dispatchEvent(outside);
          expect(props.open).toBe(false);
          expect(closes).toHaveBeenCalledTimes(1);

          dialog.destroy();

          // The same gestures on a non-dismissable dialog change nothing
          const lockedProps = mutable<DialogProps>({
            open: true,
            modality: 'modal',
            dismissable: false,
          });
          const locked = aria('dialog', lockedProps);
          const lockedPanel = document.createElement('div');
          host.appendChild(lockedPanel);
          bind(lockedPanel, locked);

          const lockedCloses = vi.fn();
          lockedPanel.addEventListener('close', lockedCloses);

          lockedPanel.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }),
          );
          host.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));

          expect(lockedProps.open).toBe(true);
          expect(lockedCloses).not.toHaveBeenCalled();

          locked.destroy();
          document.body.removeChild(host);
        });
      }));
  });

  describe('Host Parity & Top-Layer Modal Invariant', () => {
    it('announces modality explicitly and follows a live mode change', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const host = document.createElement('div');
          document.body.appendChild(host);

          const props = mutable<DialogProps>({ open: true, modality: 'modal' });
          const dialog = aria('dialog', props);

          // 1. Creation & SSR
          expect(dialog.attributes.role).toBe('dialog');
          expect(dialog.attributes['aria-modal']).toBe('true');

          const panel = document.createElement('div');
          host.appendChild(panel);
          bind(panel, dialog);

          expect(panel.getAttribute('role')).toBe('dialog');
          expect(panel.getAttribute('aria-modal')).toBe('true');

          // 5. Nonmodal is stated, not implied by absence
          props.modality = 'nonmodal';
          expect(dialog.attributes['aria-modal']).toBe('false');
          expect(panel.getAttribute('aria-modal')).toBe('false');

          props.modality = 'modal';
          expect(panel.getAttribute('aria-modal')).toBe('true');

          // A closed dialog keeps its role and stops claiming modality over the document
          props.open = false;
          expect(panel.getAttribute('role')).toBe('dialog');

          dialog.destroy();
          document.body.removeChild(host);
          expect(dialog.current).toBeNull();
        });
      }));

    it('inerts the background for the duration of a modal opening and restores it on close', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const page = document.createElement('div');
          document.body.appendChild(page);

          const background = document.createElement('main');
          const backgroundField = document.createElement('input');
          background.appendChild(backgroundField);
          page.appendChild(background);

          const props = mutable<DialogProps>({ open: false, modality: 'modal' });
          const dialog = aria('dialog', props);
          const trigger = aria('dialog-trigger');

          const triggerEl = document.createElement('button');
          page.appendChild(triggerEl);
          bind(triggerEl, trigger);

          const panel = document.createElement('div');
          page.appendChild(panel);
          dialog.ref(panel);

          const panelField = document.createElement('button');
          panel.appendChild(panelField);

          expect(background.hasAttribute('inert')).toBe(false);

          // 3. Opening removes the background from hit-testing, focus, and AT
          triggerEl.click();
          expect(props.open).toBe(true);
          expect(background.hasAttribute('inert')).toBe(true);

          // 5. The dialog's own content stays reachable
          expect(panel.hasAttribute('inert')).toBe(false);
          panelField.focus();
          expect(document.activeElement).toBe(panelField);

          // 6. Closing gives the background back
          triggerEl.click();
          expect(props.open).toBe(false);
          expect(background.hasAttribute('inert')).toBe(false);

          dialog.destroy();
          trigger.destroy();
          document.body.removeChild(page);
        });
      }));
  });
});
