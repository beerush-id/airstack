import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, Slot, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import type { DialogModality } from './overlay.js';
import { modalScope } from './scopes.js';

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

export type DialogTriggerProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

export type DialogPanelProps = ComponentStyles & {
  children?: ReactNode;
};

export type DialogTitleProps = ComponentStyles & {
  children?: ReactNode;
};

export type DialogDescriptionProps = ComponentStyles & {
  children?: ReactNode;
};

export type DialogCloseProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

const DIALOG_ROLE = 'dialog';
const TRIGGER_ROLE = 'dialog-trigger';
const PANEL_ROLE = 'dialog-panel';
const TITLE_ROLE = 'dialog-title';
const DESCRIPTION_ROLE = 'dialog-description';
const CLOSE_ROLE = 'dialog-close';

const DIALOG_OMIT = [...OMIT_KEYS, 'title', 'description', 'closeLabel'];

register('dialog', {});
register('dialogTrigger', { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.FILLED });
register('dialogPanel', {});
register('dialogTitle', {});
register('dialogDescription', {});
register('dialogClose', { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.TEXT });

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
 * Button that opens the enclosing dialog. Carries `aria-haspopup`,
 * `aria-expanded`, and `aria-controls`.
 */
export const DialogTrigger = setup<DialogTriggerProps>((props) => {
  const styles = modalScope.inherit(props);
  const trigger = aria(TRIGGER_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.DIALOG_TRIGGER], styles, auiConfig.dialogTrigger);

  return () => (
    <button ref={trigger.ref} {...trigger.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'DialogTrigger');

/**
 * Overlay container that traps focus while modal and hides through
 * `hidden` while closed.
 */
export const DialogPanel = setup<DialogPanelProps>((props) => {
  const panel = aria(PANEL_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.MODAL_PANEL, AUI_CLASS.DIALOG_PANEL], props, auiConfig.dialogPanel);

  return () => (
    <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'DialogPanel');

/**
 * Element that names the dialog, addressed by `aria-labelledby`.
 */
export const DialogTitle = setup<DialogTitleProps>((props) => {
  const title = aria(TITLE_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.MODAL_TITLE, AUI_CLASS.DIALOG_TITLE], props, auiConfig.dialogTitle);

  return () => (
    <div ref={title.ref} {...title.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'DialogTitle');

/**
 * Element that explains the dialog, addressed by `aria-describedby`.
 */
export const DialogDescription = setup<DialogDescriptionProps>((props) => {
  const description = aria(DESCRIPTION_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.MODAL_DESCRIPTION, AUI_CLASS.DIALOG_DESCRIPTION], props, auiConfig.dialogDescription);

  return () => (
    <div ref={description.ref} {...description.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'DialogDescription');

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
