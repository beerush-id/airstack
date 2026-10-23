import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import type { DialogModality } from './overlay.js';

export type DialogProps = ComponentStyles & {
  id?: string;
  open?: Bindable<boolean>;
  modality?: DialogModality;
  dismissable?: boolean;
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

const dialogStyles: ComponentStyles = {};

register('dialog', dialogStyles);
register('dialogTrigger', dialogStyles);
register('dialogPanel', dialogStyles);
register('dialogTitle', dialogStyles);
register('dialogDescription', dialogStyles);
register('dialogClose', dialogStyles);

/**
 * Modal or nonmodal overlay that names itself through a title, explains
 * itself through a description, and returns focus where it came from.
 */
export const Dialog = setup<DialogProps>((props) => {
  const dialog = aria(DIALOG_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.DIALOG, props, auiConfig.dialog);

  return () => (
    <div ref={dialog.ref} {...dialog.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'Dialog');

/**
 * Button that opens the enclosing dialog. Carries `aria-haspopup`,
 * `aria-expanded`, and `aria-controls`.
 */
export const DialogTrigger = setup<DialogTriggerProps>((props) => {
  const trigger = aria(TRIGGER_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.DIALOG_TRIGGER], props, auiConfig.dialogTrigger);

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
  const className = () => $families(AUI_CLASS.DIALOG_PANEL, props, auiConfig.dialogPanel);

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
  const className = () => $families(AUI_CLASS.DIALOG_TITLE, props, auiConfig.dialogTitle);

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
  const className = () => $families(AUI_CLASS.DIALOG_DESCRIPTION, props, auiConfig.dialogDescription);

  return () => (
    <div ref={description.ref} {...description.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'DialogDescription');

/**
 * Button inside the panel that closes the dialog.
 */
export const DialogClose = setup<DialogCloseProps>((props) => {
  const close = aria(CLOSE_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.DIALOG_CLOSE], props, auiConfig.dialogClose);

  return () => (
    <button ref={close.ref} {...close.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'DialogClose');
