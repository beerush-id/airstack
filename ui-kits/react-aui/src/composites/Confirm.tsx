import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, Slot, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import {
  createDialog,
  type DialogDescriptionProps,
  type DialogPanelProps,
  type DialogTitleProps,
  type DialogTriggerProps,
} from './dialog-parts.js';
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

export type ConfirmTriggerProps = DialogTriggerProps;
export type ConfirmPanelProps = DialogPanelProps;
export type ConfirmTitleProps = DialogTitleProps;
export type ConfirmDescriptionProps = DialogDescriptionProps;

export type ConfirmActionProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

export type ConfirmCancelProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

const CONFIRM_ROLE = 'confirm';
const ACTION_ROLE = 'confirm-action';
const CANCEL_ROLE = 'confirm-cancel';

const CONFIRM_OMIT = [...OMIT_KEYS, 'title', 'description', 'actionLabel', 'cancelLabel'];

register('confirm', {});
register('confirmAction', { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.FILLED });
register('confirmCancel', { size: SIZES.MD, color: COLORS.SECONDARY, variant: VARIANTS.TEXT });

export const {
  Trigger: ConfirmTrigger,
  Panel: ConfirmPanel,
  Title: ConfirmTitle,
  Description: ConfirmDescription,
} = createDialog('confirm', 'Confirm', { role: 'confirm' });

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
 * It follows the root's size but keeps its own quiet color and variant, so a
 * destructive `color` never makes declining look like the risky answer.
 */
export const ConfirmCancel = setup<ConfirmCancelProps>((props) => {
  const scoped = modalScope.inherit(props);
  const cancel = aria(CANCEL_ROLE, props as AnyType);
  const className = () =>
    $families(
      [AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.CONFIRM_CANCEL],
      { size: scoped.size, color: props.color, variant: props.variant, className: props.className },
      auiConfig.confirmCancel
    );

  return () => (
    <button ref={cancel.ref} {...cancel.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'ConfirmCancel');
