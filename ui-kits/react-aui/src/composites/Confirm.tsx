import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type ConfirmProps = ComponentStyles & {
  id?: string;
  open?: Bindable<boolean>;
  children?: ReactNode;
  onopen?: (event: CustomEvent<void>) => void;
  onclose?: (event: CustomEvent<void>) => void;
  onconfirm?: (event: CustomEvent<void>) => void;
  oncancel?: (event: CustomEvent<void>) => void;
};

export type ConfirmTriggerProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

export type ConfirmPanelProps = ComponentStyles & {
  children?: ReactNode;
};

export type ConfirmTitleProps = ComponentStyles & {
  children?: ReactNode;
};

export type ConfirmDescriptionProps = ComponentStyles & {
  children?: ReactNode;
};

export type ConfirmActionProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

export type ConfirmCancelProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

const CONFIRM_ROLE = 'confirm';
const TRIGGER_ROLE = 'confirm-trigger';
const PANEL_ROLE = 'confirm-panel';
const TITLE_ROLE = 'confirm-title';
const DESCRIPTION_ROLE = 'confirm-description';
const ACTION_ROLE = 'confirm-action';
const CANCEL_ROLE = 'confirm-cancel';

const confirmStyles: ComponentStyles = {};

register('confirm', confirmStyles);
register('confirmTrigger', confirmStyles);
register('confirmPanel', confirmStyles);
register('confirmTitle', confirmStyles);
register('confirmDescription', confirmStyles);
register('confirmAction', confirmStyles);
register('confirmCancel', confirmStyles);

/**
 * Decision panel that is always modal and never dismissable: the answer
 * comes from the action or the cancel button, never from `Escape`.
 */
export const Confirm = setup<ConfirmProps>((props) => {
  const confirm = aria(CONFIRM_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CONFIRM, props, auiConfig.confirm);

  return () => (
    <div ref={confirm.ref} {...confirm.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'Confirm');

/**
 * Button that opens the enclosing confirm panel.
 */
export const ConfirmTrigger = setup<ConfirmTriggerProps>((props) => {
  const trigger = aria(TRIGGER_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.CONFIRM_TRIGGER], props, auiConfig.confirmTrigger);

  return () => (
    <button ref={trigger.ref} {...trigger.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'ConfirmTrigger');

/**
 * Alert dialog container. Focus starts on the safe choice.
 */
export const ConfirmPanel = setup<ConfirmPanelProps>((props) => {
  const panel = aria(PANEL_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CONFIRM_PANEL, props, auiConfig.confirmPanel);

  return () => (
    <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'ConfirmPanel');

/**
 * Element that names the decision.
 */
export const ConfirmTitle = setup<ConfirmTitleProps>((props) => {
  const title = aria(TITLE_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CONFIRM_TITLE, props, auiConfig.confirmTitle);

  return () => (
    <div ref={title.ref} {...title.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'ConfirmTitle');

/**
 * Element that explains what the decision commits.
 */
export const ConfirmDescription = setup<ConfirmDescriptionProps>((props) => {
  const description = aria(DESCRIPTION_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CONFIRM_DESCRIPTION, props, auiConfig.confirmDescription);

  return () => (
    <div ref={description.ref} {...description.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'ConfirmDescription');

/**
 * Button that commits the decision. Closes the panel unless the handler
 * cancels the event.
 */
export const ConfirmAction = setup<ConfirmActionProps>((props) => {
  const action = aria(ACTION_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.CONFIRM_ACTION], props, auiConfig.confirmAction);

  return () => (
    <button ref={action.ref} {...action.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'ConfirmAction');

/**
 * Button that declines the decision. Receives focus when the panel opens.
 */
export const ConfirmCancel = setup<ConfirmCancelProps>((props) => {
  const cancel = aria(CANCEL_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.CONFIRM_CANCEL], props, auiConfig.confirmCancel);

  return () => (
    <button ref={cancel.ref} {...cancel.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'ConfirmCancel');
