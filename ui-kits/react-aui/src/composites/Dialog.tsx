import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, Slot, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { createDialog } from './dialog-parts.js';
import type { DialogModality } from './overlay.js';
import { modalScope } from './scopes.js';

export type { DialogDescriptionProps, DialogPanelProps, DialogTitleProps, DialogTriggerProps } from './dialog-parts.js';

export type DialogSlots = {
  trigger: () => ReactNode;
  actions: () => ReactNode;
};

export type DialogProps = ComponentStyles & {
  id?: string;
  open?: Bindable<boolean>;
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

export type DialogCloseProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

const DIALOG_ROLE = 'dialog';
const CLOSE_ROLE = 'dialog-close';

const DIALOG_OMIT = [...OMIT_KEYS, 'title', 'description', 'closeLabel'];

register('dialog', {});
register('dialogClose', { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.TEXT });

export const {
  Trigger: DialogTrigger,
  Panel: DialogPanel,
  Title: DialogTitle,
  Description: DialogDescription,
} = createDialog('dialog', 'Dialog');

/**
 * Modal or nonmodal overlay that names itself through a title, explains
 * itself through a description, and returns focus where it came from.
 * With `title` it renders the sheet for you: `label` becomes the trigger,
 * the children become the body, and a close button ends it unless the
 * `actions` slot supplies the buttons.
 */
export const Dialog = setup<DialogProps, DialogSlots>((props, slots) => {
  const dialog = aria(DIALOG_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.MODAL, AUI_CLASS.DIALOG], { className: props.className }, auiConfig.dialog);

  modalScope.provide(props);

  return () => (
    <div ref={dialog.ref} {...dialog.restProps(DIALOG_OMIT)} className={className()}>
      {props.title === undefined ? (
        props.children
      ) : (
        <>
          {props.label && (
            <DialogTrigger>
              <Slot for={() => slots.trigger?.()}>{props.label}</Slot>
            </DialogTrigger>
          )}
          <DialogPanel>
            <DialogTitle>{props.title}</DialogTitle>
            {props.description && <DialogDescription>{props.description}</DialogDescription>}
            {props.children && <div>{props.children}</div>}
            <Slot for={() => slots.actions?.()}>
              {props.closeLabel && <DialogClose variant={VARIANTS.FILLED}>{props.closeLabel}</DialogClose>}
            </Slot>
          </DialogPanel>
        </>
      )}
    </div>
  );
}, 'Dialog');

/**
 * Button inside the panel that closes the dialog. It follows the dialog's
 * size and color but keeps its own quieter variant: a way out reads as text,
 * the answer that moves on is filled.
 */
export const DialogClose = setup<DialogCloseProps>((props) => {
  const scoped = modalScope.inherit(props);
  const close = aria(CLOSE_ROLE, props as AnyType);
  const className = () =>
    $families(
      [AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.DIALOG_CLOSE],
      { size: scoped.size, color: scoped.color, variant: props.variant, className: props.className },
      auiConfig.dialogClose
    );

  return () => (
    <button ref={close.ref} {...close.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'DialogClose');
