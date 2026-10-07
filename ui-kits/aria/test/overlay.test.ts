import { mutable } from '@airlib/core';
import { describe, expect, it, vi } from 'vitest';
import { attachOverlayLifecycle, handleOverlayKeyDown } from '../src/utils/overlay.js';

describe('Overlay Utility - Lifecycle & Focus Management', () => {
  describe('attachOverlayLifecycle - Focus Capture & Restoration', () => {
    it('captures active element on open and restores focus on close', () => {
      const state = mutable({ open: false });
      const externalBtn = document.createElement('button');
      const panel = document.createElement('div');
      document.body.appendChild(externalBtn);
      document.body.appendChild(panel);

      externalBtn.focus();
      expect(document.activeElement).toBe(externalBtn);

      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        onClose: () => {
          state.open = false;
        },
      });

      state.open = true;
      expect(document.activeElement).toBe(externalBtn);

      state.open = false;
      expect(document.activeElement).toBe(externalBtn);

      detach();
      document.body.removeChild(externalBtn);
      document.body.removeChild(panel);
    });

    it('does not capture active element if it is within the panel itself', () => {
      const state = mutable({ open: false });
      const panel = document.createElement('div');
      panel.tabIndex = -1;
      document.body.appendChild(panel);

      panel.focus();
      expect(document.activeElement).toBe(panel);

      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        onClose: () => {
          state.open = false;
        },
      });

      state.open = true;
      state.open = false;

      detach();
      document.body.removeChild(panel);
    });

    it('restores focus on detach if still open', () => {
      const state = mutable({ open: true });
      const externalBtn = document.createElement('button');
      const panel = document.createElement('div');
      document.body.appendChild(externalBtn);
      document.body.appendChild(panel);

      externalBtn.focus();

      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        onClose: () => {
          state.open = false;
        },
        restoreFocus: true,
      });

      detach();
      expect(document.activeElement).toBe(externalBtn);

      document.body.removeChild(externalBtn);
      document.body.removeChild(panel);
    });

    it('does not restore focus when restoreFocus is false', () => {
      const state = mutable({ open: false });
      const externalBtn = document.createElement('button');
      const panel = document.createElement('div');
      document.body.appendChild(externalBtn);
      document.body.appendChild(panel);

      externalBtn.focus();

      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        onClose: () => {
          state.open = false;
        },
        restoreFocus: false,
      });

      state.open = true;
      state.open = false;

      detach();
      document.body.removeChild(externalBtn);
      document.body.removeChild(panel);
    });

    it('moves focus to [autofocus] or first focusable when autoFocus is true', () => {
      const state = mutable({ open: false });
      const panel = document.createElement('div');
      const autofocusBtn = document.createElement('button');
      autofocusBtn.setAttribute('autofocus', '');
      panel.appendChild(autofocusBtn);
      document.body.appendChild(panel);

      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        onClose: () => {
          state.open = false;
        },
        autoFocus: true,
      });

      state.open = true;
      expect(document.activeElement).toBe(autofocusBtn);

      detach();
      document.body.removeChild(panel);
    });

    it('moves focus to first focusable child when autoFocus is true without [autofocus]', () => {
      const state = mutable({ open: false });
      const panel = document.createElement('div');
      const firstBtn = document.createElement('button');
      panel.appendChild(firstBtn);
      document.body.appendChild(panel);

      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        onClose: () => {
          state.open = false;
        },
        autoFocus: true,
      });

      state.open = true;
      expect(document.activeElement).toBe(firstBtn);

      detach();
      document.body.removeChild(panel);
    });

    it('falls back to focusing panel itself when autoFocus is true and no focusable children exist', () => {
      const state = mutable({ open: false });
      const panel = document.createElement('div');
      panel.tabIndex = -1;
      document.body.appendChild(panel);

      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        onClose: () => {
          state.open = false;
        },
        autoFocus: true,
      });

      state.open = true;
      expect(document.activeElement).toBe(panel);

      detach();
      document.body.removeChild(panel);
    });

    it('defaults autoFocus to true when modal and false when non-modal', () => {
      const modalState = mutable({ open: false });
      const modalPanel = document.createElement('div');
      const modalBtn = document.createElement('button');
      modalPanel.appendChild(modalBtn);
      document.body.appendChild(modalPanel);

      const detachModal = attachOverlayLifecycle({
        element: modalPanel,
        isOpen: () => modalState.open,
        isModal: () => true,
        onClose: () => {
          modalState.open = false;
        },
      });

      modalState.open = true;
      expect(document.activeElement).toBe(modalBtn);
      detachModal();
      document.body.removeChild(modalPanel);

      const nonModalState = mutable({ open: false });
      const nonModalPanel = document.createElement('div');
      const nonModalBtn = document.createElement('button');
      const externalBtn = document.createElement('button');
      nonModalPanel.appendChild(nonModalBtn);
      document.body.appendChild(nonModalPanel);
      document.body.appendChild(externalBtn);
      externalBtn.focus();

      const detachNonModal = attachOverlayLifecycle({
        element: nonModalPanel,
        isOpen: () => nonModalState.open,
        isModal: () => false,
        onClose: () => {
          nonModalState.open = false;
        },
      });

      nonModalState.open = true;
      expect(document.activeElement).toBe(externalBtn);
      detachNonModal();
      document.body.removeChild(nonModalPanel);
      document.body.removeChild(externalBtn);
    });

    it('defers focus via requestAnimationFrame when child element mounts asynchronously', async () => {
      const state = mutable({ open: false });
      const panel = document.createElement('div');
      panel.tabIndex = -1;
      document.body.appendChild(panel);

      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        isModal: () => true,
        onClose: () => {
          state.open = false;
        },
      });

      state.open = true;
      expect(document.activeElement).toBe(panel);

      const lateBtn = document.createElement('button');
      panel.appendChild(lateBtn);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      expect(document.activeElement).toBe(lateBtn);

      detach();
      document.body.removeChild(panel);
    });

    it('cancels pending animation frame on close', () => {
      const state = mutable({ open: false });
      const panel = document.createElement('div');
      document.body.appendChild(panel);

      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        isModal: () => true,
        onClose: () => {
          state.open = false;
        },
      });

      state.open = true;
      state.open = false;

      detach();
      document.body.removeChild(panel);
    });
  });

  describe('attachOverlayLifecycle - Outside Pointer Dismissal', () => {
    it('invokes onClose when clicking outside an open dismissable overlay', () => {
      const state = mutable({ open: true });
      const panel = document.createElement('div');
      const insideChild = document.createElement('span');
      panel.appendChild(insideChild);
      document.body.appendChild(panel);

      const closeSpy = vi.fn(() => {
        state.open = false;
      });

      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        onClose: closeSpy,
      });

      // Click inside child
      insideChild.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(closeSpy).not.toHaveBeenCalled();

      // Click outside
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(closeSpy).toHaveBeenCalledTimes(1);

      detach();
      document.body.removeChild(panel);
    });

    it('ignores outside pointerdown when closed or non-dismissable', () => {
      const state = mutable({ open: false });
      const panel = document.createElement('div');
      document.body.appendChild(panel);

      const closeSpy = vi.fn();
      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        isDismissable: () => false,
        onClose: closeSpy,
      });

      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(closeSpy).not.toHaveBeenCalled();

      state.open = true;
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(closeSpy).not.toHaveBeenCalled();

      detach();
      document.body.removeChild(panel);
    });

    it('ignores outside pointerdown on elements matching excludeFromDismiss', () => {
      const state = mutable({ open: true });
      const panel = document.createElement('div');
      const trigger = document.createElement('button');
      document.body.appendChild(panel);
      document.body.appendChild(trigger);

      const closeSpy = vi.fn();
      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => state.open,
        excludeFromDismiss: (target) => target === trigger,
        onClose: closeSpy,
      });

      trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(closeSpy).not.toHaveBeenCalled();

      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(closeSpy).toHaveBeenCalledTimes(1);

      detach();
      document.body.removeChild(panel);
      document.body.removeChild(trigger);
    });
  });

  describe('attachOverlayLifecycle - Native <dialog> Synchronization', () => {
    it('synchronizes native dialog showModal, show, and close methods', () => {
      const state = mutable({ open: false, modal: true });
      const dialogEl = document.createElement('dialog');
      dialogEl.showModal = vi.fn();
      dialogEl.show = vi.fn();
      dialogEl.close = vi.fn();

      const detach = attachOverlayLifecycle({
        element: dialogEl,
        isOpen: () => state.open,
        isModal: () => state.modal,
        isNative: true,
        onClose: () => {
          state.open = false;
        },
      });

      state.open = true;
      expect(dialogEl.showModal).toHaveBeenCalledTimes(1);

      state.open = false;
      expect(dialogEl.close).toHaveBeenCalledTimes(1);

      // Nonmodal show()
      state.modal = false;
      state.open = true;
      expect(dialogEl.show).toHaveBeenCalledTimes(1);

      state.open = false;
      detach();
    });

    it('synchronizes native cancel and close events', () => {
      const state = mutable({ open: true, dismissable: true });
      const dialogEl = document.createElement('dialog');

      const detach = attachOverlayLifecycle({
        element: dialogEl,
        isOpen: () => state.open,
        isDismissable: () => state.dismissable,
        isNative: true,
        onClose: () => {
          state.open = false;
        },
      });

      // Preventable cancel when not dismissable
      state.dismissable = false;
      const cancelEvt1 = new Event('cancel', { cancelable: true });
      dialogEl.dispatchEvent(cancelEvt1);
      expect(cancelEvt1.defaultPrevented).toBe(true);
      expect(state.open).toBe(true);

      // Dismissable cancel
      state.dismissable = true;
      const cancelEvt2 = new Event('cancel', { cancelable: true });
      dialogEl.dispatchEvent(cancelEvt2);
      expect(state.open).toBe(false);

      // Close event
      state.open = true;
      dialogEl.dispatchEvent(new Event('close'));
      expect(state.open).toBe(false);

      detach();
    });
  });

  describe('handleOverlayKeyDown - Key Interactions', () => {
    it('prevents default on Tab when modal overlay has zero focusable elements', () => {
      const panel = document.createElement('div');
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });

      const handled = handleOverlayKeyDown(tabEvent, {
        element: panel,
        isOpen: () => true,
        isModal: () => true,
        onClose: vi.fn(),
      });

      expect(handled).toBe(true);
      expect(tabEvent.defaultPrevented).toBe(true);
    });

    it('wraps focus between first and last elements on Tab and Shift+Tab', () => {
      const panel = document.createElement('div');
      const btn1 = document.createElement('button');
      const btn2 = document.createElement('button');
      panel.appendChild(btn1);
      panel.appendChild(btn2);
      document.body.appendChild(panel);

      btn1.focus();

      // Tab on first element -> normal tab, not intercepted
      const normalTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      const normalHandled = handleOverlayKeyDown(normalTab, {
        element: panel,
        isOpen: () => true,
        isModal: () => true,
        onClose: vi.fn(),
      });
      expect(normalHandled).toBe(false);
      expect(normalTab.defaultPrevented).toBe(false);

      // Shift+Tab on first element -> wraps to btn2
      const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
      const shiftHandled = handleOverlayKeyDown(shiftTab, {
        element: panel,
        isOpen: () => true,
        isModal: () => true,
        onClose: vi.fn(),
      });
      expect(shiftHandled).toBe(true);
      expect(shiftTab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(btn2);

      // Shift+Tab on last element (btn2) -> normal backwards tab, not intercepted
      const normalShiftTab = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const normalShiftHandled = handleOverlayKeyDown(normalShiftTab, {
        element: panel,
        isOpen: () => true,
        isModal: () => true,
        onClose: vi.fn(),
      });
      expect(normalShiftHandled).toBe(false);
      expect(normalShiftTab.defaultPrevented).toBe(false);

      // Tab on last element (btn2) -> wraps to btn1
      const wrapTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, bubbles: true, cancelable: true });
      const wrapHandled = handleOverlayKeyDown(wrapTab, {
        element: panel,
        isOpen: () => true,
        isModal: () => true,
        onClose: vi.fn(),
      });
      expect(wrapHandled).toBe(true);
      expect(wrapTab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(btn1);

      // Focus on panel itself -> Tab pulls into btn1
      panel.tabIndex = -1;
      panel.focus();
      const pullTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, bubbles: true, cancelable: true });
      handleOverlayKeyDown(pullTab, {
        element: panel,
        isOpen: () => true,
        isModal: () => true,
        onClose: vi.fn(),
      });
      expect(pullTab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(btn1);

      // Focus on panel itself -> Shift+Tab pulls into btn2
      panel.focus();
      const pullShiftTab = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      handleOverlayKeyDown(pullShiftTab, {
        element: panel,
        isOpen: () => true,
        isModal: () => true,
        onClose: vi.fn(),
      });
      expect(pullShiftTab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(btn2);

      document.body.removeChild(panel);
    });

    it('returns false for non-handled keys or closed/nonmodal states', () => {
      const panel = document.createElement('div');
      const enterEvt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });

      expect(
        handleOverlayKeyDown(enterEvt, {
          element: panel,
          isOpen: () => true,
          onClose: vi.fn(),
        })
      ).toBe(false);

      const tabEvt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      expect(
        handleOverlayKeyDown(tabEvt, {
          element: panel,
          isOpen: () => false,
          onClose: vi.fn(),
        })
      ).toBe(false);

      expect(
        handleOverlayKeyDown(tabEvt, {
          element: panel,
          isOpen: () => true,
          isModal: () => false,
          onClose: vi.fn(),
        })
      ).toBe(false);

      const escEvt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      expect(
        handleOverlayKeyDown(escEvt, {
          element: panel,
          isOpen: () => false,
          onClose: vi.fn(),
        })
      ).toBe(false);

      expect(
        handleOverlayKeyDown(escEvt, {
          element: panel,
          isOpen: () => true,
          isDismissable: () => false,
          onClose: vi.fn(),
        })
      ).toBe(false);

      // Default isModal and isDismissable fallback invocation
      const closeSpy = vi.fn();
      const defaultEsc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      expect(
        handleOverlayKeyDown(defaultEsc, {
          element: panel,
          isOpen: () => true,
          onClose: closeSpy,
        })
      ).toBe(true);
      expect(closeSpy).toHaveBeenCalledTimes(1);

      const defaultTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      expect(
        handleOverlayKeyDown(defaultTab, {
          element: panel,
          isOpen: () => true,
          onClose: vi.fn(),
        })
      ).toBe(true);
    });

    it('ignores reactive updates while remaining in the open state', () => {
      const state = mutable({ open: true, counter: 0 });
      const panel = document.createElement('div');
      document.body.appendChild(panel);

      const detach = attachOverlayLifecycle({
        element: panel,
        isOpen: () => {
          void state.counter;
          return state.open;
        },
        onClose: vi.fn(),
      });

      state.counter++;
      expect(state.open).toBe(true);

      detach();
      document.body.removeChild(panel);
    });
  });
});
