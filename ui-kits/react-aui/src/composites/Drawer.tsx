import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, createContext, Slot, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { DialogClose } from './Dialog.js';
import { createDialog, type DialogPanelProps } from './dialog-parts.js';
import type { DialogModality } from './overlay.js';
import { modalScope } from './scopes.js';

export type DrawerSide = 'start' | 'end' | 'top' | 'bottom';

export type DrawerSlots = {
  trigger: () => ReactNode;
  actions: () => ReactNode;
};

export type DrawerProps = ComponentStyles & {
  id?: string;
  open?: Bindable<boolean>;
  side?: DrawerSide;
  modality?: DialogModality;
  dismissable?: boolean;
  label?: string;
  title?: string;
  description?: string;
  closeLabel?: string;
  children?: ReactNode;
  onopen?: (event: CustomEvent<void>) => void;
  onclose?: (event: CustomEvent<void>) => void;
};

export type DrawerPanelProps = DialogPanelProps;

const DIALOG_ROLE = 'dialog';
const DRAWER = branded('drawer');
const DRAWER_PANEL = branded('drawer-panel');
const DRAWER_BODY = branded('drawer-body');
const DRAWER_ACTIONS = branded('drawer-actions');
const DRAWER_OMIT = [...OMIT_KEYS, 'title', 'description', 'closeLabel', 'side'];

register('drawer', {});

/** The enclosing drawer's side, for its sheet: the sheet is drawn over the page, outside the drawer's own element. */
const drawerSide = createContext<{ side?: DrawerSide }>();

/** A drawer is a dialog pinned to an edge: the dialog's parts, its sheet carrying its side wherever it is drawn. */
export const {
  Trigger: DrawerTrigger,
  Panel: DrawerPanel,
  Title: DrawerTitle,
  Description: DrawerDescription,
} = createDialog('drawer', 'Drawer', {
  panelClass: () => {
    const drawer = drawerSide.get();
    return () => `${DRAWER_PANEL}-${drawer?.side ?? 'end'}`;
  },
});

/** Closes the drawer; the dialog close button under a drawer name. */
export const DrawerClose = DialogClose;

/**
 * A sheet that slides in from an edge of the screen: filters beside a list,
 * the detail of a row, a settings pane. It is a dialog in every other way —
 * focus moves in and returns on close, `Escape` and an outside press dismiss
 * it unless told otherwise. With `title` it renders the sheet for you:
 * `label` becomes the trigger, the children become the scrolling body, and
 * `closeLabel` adds a close button unless the `actions` slot supplies the
 * buttons. Every visible and accessible name comes from you.
 */
export const Drawer = setup<DrawerProps, DrawerSlots>((props, slots) => {
  const dialog = aria(DIALOG_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.MODAL, DRAWER], { className: props.className }, auiConfig.drawer);

  modalScope.provide(props);
  drawerSide.set(props);

  return () => (
    <div ref={dialog.ref} {...dialog.restProps(DRAWER_OMIT)} className={className()}>
      {props.title === undefined ? (
        props.children
      ) : (
        <>
          {props.label && (
            <DrawerTrigger>
              <Slot for={() => slots.trigger?.()}>{props.label}</Slot>
            </DrawerTrigger>
          )}
          <DrawerPanel>
            <DrawerTitle>{props.title}</DrawerTitle>
            {props.description && <DrawerDescription>{props.description}</DrawerDescription>}
            {props.children && <div className={DRAWER_BODY}>{props.children}</div>}
            {(slots.actions || props.closeLabel) && (
              <div className={DRAWER_ACTIONS}>
                <Slot for={() => slots.actions?.()}>
                  {props.closeLabel && <DialogClose variant="filled">{props.closeLabel}</DialogClose>}
                </Slot>
              </div>
            )}
          </DrawerPanel>
        </>
      )}
    </div>
  );
}, 'Drawer');
