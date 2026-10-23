import { aria } from '@airlib/aria';
import { AUI_CLASS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CloseIcon } from '../icons/index.js';
import { createStyleScope } from '../utils/common.js';

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

register('toast', {});
register('toastClose', { size: SIZES.SM, variant: VARIANTS.TEXT });

const toastScope = createStyleScope();

/**
 * One message with one lifetime. It announces itself on appearance and
 * reports dismissal once; removing the node stays with the consumer.
 * Without a `color` it is a neutral inverse snackbar; a `color` tints it
 * with that role's container.
 */
export const Toast = setup<ToastProps>((props) => {
  const toast = aria(TOAST_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TOAST, props, auiConfig.toast);

  toastScope.provide(props);

  return () => (
    <div ref={toast.ref} {...toast.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'Toast');

/**
 * Button that commits the enclosing toast's dismissal. Without children it
 * shows a close glyph.
 */
export const ToastClose = setup<ToastCloseProps>((props) => {
  const scoped = toastScope.inherit(props);
  const close = aria(CLOSE_ROLE, props as AnyType);
  // Only the size follows the toast; the button's own color comes from the toast surface.
  const className = () => {
    const families = $families(
      [AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.TOAST_CLOSE],
      { size: scoped.size, color: props.color, variant: props.variant, className: props.className },
      auiConfig.toastClose
    );
    return props.children ? families : `${families} ${AUI_CLASS.CONTROL_ICON}`;
  };

  // The glyph-only form has no visible text: name it with your own `aria-label`.
  return () => (
    <button ref={close.ref} {...close.restProps(OMIT_KEYS)} className={className()}>
      {props.children ?? <CloseIcon aria-hidden="true" />}
    </button>
  );
}, 'ToastClose');
