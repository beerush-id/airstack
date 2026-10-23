import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type ToastProps = ComponentStyles & {
  critical?: boolean;
  duration?: number;
  children?: ReactNode;
  ondismiss?: (event: CustomEvent<void>) => void;
};

export type ToastCloseProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

const TOAST_ROLE = 'toast';
const CLOSE_ROLE = 'toast-close';

const toastStyles: ComponentStyles = {};

register('toast', toastStyles);
register('toastClose', toastStyles);

/**
 * One message with one lifetime. It announces itself on appearance and
 * reports dismissal once; removing the node stays with the consumer.
 */
export const Toast = setup<ToastProps>((props) => {
  const toast = aria(TOAST_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TOAST, props, auiConfig.toast);

  return () => (
    <div ref={toast.ref} {...toast.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'Toast');

/**
 * Button that commits the enclosing toast's dismissal.
 */
export const ToastClose = setup<ToastCloseProps>((props) => {
  const close = aria(CLOSE_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.TOAST_CLOSE], props, auiConfig.toastClose);

  return () => (
    <button ref={close.ref} {...close.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'ToastClose');
