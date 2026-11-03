import type { AnyType } from '@airlib/react';
import type { KeyboardEvent, MouseEvent } from 'react';

/** What a pick list (a gallery, a listbox) holds to switch between picking one item and several. */
export type PickModeProps = {
  /** The picked item, or the checked items while picking several. */
  value?: AnyType;
  /** Whether several items are picked at once. */
  multiple?: AnyType;
  /** Whether the list switches between the two itself. */
  checkable?: boolean;
};

/** Where an item starts, among what's pressed. */
const ITEM = '[role="option"]';

/**
 * Lets a `checkable` pick list switch between picking one item and several, as photo libraries
 * and file browsers do. A click picks one item. An item's check, or Ctrl/Cmd- or Shift-clicking
 * an item, switches to picking several, carrying the picked item along; unchecking the last item,
 * Escape, or pressing the list's own background switches back to picking one, with none picked.
 * A list that isn't `checkable` is left as it is.
 *
 * @param props - The list's props: its value, its mode, and whether it switches.
 * @param check - The selector of an item's check.
 * @returns The handlers for the list's root element.
 */
export function pickModes(props: PickModeProps, check: string) {
  // The value is a list exactly while picking several, so it goes in before the switch and out after.
  const pickSeveral = () => {
    const picked = props.value;
    props.value = typeof picked === 'string' ? [picked] : [];
    props.multiple = true;
  };
  const pickOne = () => {
    props.multiple = false;
    props.value = null;
  };

  return {
    /** Before an item takes the click: its check, or Ctrl/Cmd or Shift, switches to picking several. */
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (!props.checkable || props.multiple) return;
      const target = event.target as Element;
      const item = target.closest(ITEM);
      if (!item || (!target.closest(check) && !event.ctrlKey && !event.metaKey && !event.shiftKey)) return;

      const picked = item.getAttribute('aria-selected') === 'true';
      pickSeveral();
      // The picked item is already checked; its own click would uncheck it again.
      if (picked) event.preventDefault();
    },

    /** After the click: a press on the list itself lets go of what's picked; with nothing left checked, back to one. */
    onClick(event: MouseEvent<HTMLElement>) {
      if (!props.checkable) return;
      if (event.target === event.currentTarget) {
        if (props.multiple) pickOne();
        else props.value = null;
        return;
      }
      const value = props.value;
      if (props.multiple && (!value || value.length === 0)) pickOne();
    },

    /** Escape is taken first, before what's around the list (a window, a dialog) handles it as closing. */
    onKeyDownCapture(event: KeyboardEvent<HTMLElement>) {
      if (event.key !== 'Escape' || !props.checkable || !props.multiple) return;
      event.preventDefault();
      event.stopPropagation();
      pickOne();
    },
  };
}
