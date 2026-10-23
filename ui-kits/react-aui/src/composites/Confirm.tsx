import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, Slot, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { modalScope } from './scopes.js';

export type ConfirmSlots = {
  trigger: () => ReactNode;
};

export type ConfirmProps = ComponentStyles & {
  id?: string;
  open?: Bindable<boolean>;
  label?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  cancelLabel?: string;
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

const CONFIRM_OMIT = [...OMIT_KEYS, 'title', 'description', 'actionLabel', 'cancelLabel'];

const confirmButtonStyles: ComponentStyles = { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.FILLED };

register('confirm', {});
register('confirmTrigger', { ...confirmButtonStyles });
register('confirmPanel', {});
register('confirmTitle', {});
register('confirmDescription', {});
register('confirmAction', { ...confirmButtonStyles });
register('confirmCancel', { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.TEXT });

/**
 * Decision panel that is always modal and never dismissable: the answer
 * comes from the action or the cancel button, never from `Escape`.
 * With `title` it renders the sheet for you: `label` becomes the trigger,
 * and `actionLabel` / `cancelLabel` name the two answers. Its `color`
 * reaches the trigger and the action — `color="error"` for a destructive one.
 */
export const Confirm = setup<ConfirmProps, ConfirmSlots>((props, slots) => {
  const confirm = aria(CONFIRM_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.MODAL, AUI_CLASS.CONFIRM], { className: props.className }, auiConfig.confirm);

  modalScope.provide(props);

  return () => (
    <div ref={confirm.ref} {...confirm.restProps(CONFIRM_OMIT)} className={className()}>
      {props.title === undefined ? (
        props.children
      ) : (
        <>
          {props.label && (
            <ConfirmTrigger>
              <Slot for={() => slots.trigger?.()}>{props.label}</Slot>
            </ConfirmTrigger>
          )}
          <ConfirmPanel>
            <ConfirmTitle>{props.title}</ConfirmTitle>
            {props.description && <ConfirmDescription>{props.description}</ConfirmDescription>}
            {props.children && <div>{props.children}</div>}
            <ConfirmCancel>{props.cancelLabel}</ConfirmCancel>
            <ConfirmAction>{props.actionLabel}</ConfirmAction>
          </ConfirmPanel>
        </>
      )}
    </div>
  );
}, 'Confirm');

/**
 * Button that opens the enclosing confirm panel.
 */
export const ConfirmTrigger = setup<ConfirmTriggerProps>((props) => {
  const styles = modalScope.inherit(props);
  const trigger = aria(TRIGGER_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.CONFIRM_TRIGGER], styles, auiConfig.confirmTrigger);

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
  const className = () => $families([AUI_CLASS.MODAL_PANEL, AUI_CLASS.CONFIRM_PANEL], props, auiConfig.confirmPanel);

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
  const className = () => $families([AUI_CLASS.MODAL_TITLE, AUI_CLASS.CONFIRM_TITLE], props, auiConfig.confirmTitle);

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
  const className = () =>
    $families([AUI_CLASS.MODAL_DESCRIPTION, AUI_CLASS.CONFIRM_DESCRIPTION], props, auiConfig.confirmDescription);

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
  const styles = modalScope.inherit(props);
  const action = aria(ACTION_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.CONFIRM_ACTION], styles, auiConfig.confirmAction);

  return () => (
    <button ref={action.ref} {...action.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'ConfirmAction');

/**
 * Button that declines the decision. Receives focus when the panel opens.
 * It follows the root's size and color but keeps its own quieter variant.
 */
export const ConfirmCancel = setup<ConfirmCancelProps>((props) => {
  const scoped = modalScope.inherit(props);
  const cancel = aria(CANCEL_ROLE, props as AnyType);
  const className = () =>
    $families(
      [AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.CONFIRM_CANCEL],
      { size: scoped.size, color: scoped.color, variant: props.variant, className: props.className },
      auiConfig.confirmCancel
    );

  return () => (
    <button ref={cancel.ref} {...cancel.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'ConfirmCancel');
