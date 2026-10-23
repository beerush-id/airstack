import { aria } from '@airlib/aria';
import { AUI_CLASS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, For, Show, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CloseIcon } from '../icons/index.js';
import { createStyleScope } from '../utils/common.js';
import { toast } from './toast-registry.js';

export type ToastProps = ComponentStyles & {
  critical?: boolean;
  duration?: number;
  children?: ReactNode;
  ondismiss?: (event: CustomEvent<void>) => void;
};

export type ToastCloseProps = ComponentStyles & {
  disabled?: boolean;
  'aria-label'?: string;
  children?: ReactNode;
};

/** The corner notifications gather in. */
export type ToastPlacement = 'top-end' | 'top-start' | 'bottom-end' | 'bottom-start';

export type ToastHostProps = ComponentStyles & {
  /** Names each notification's close button; without it, they have none and leave on their own. */
  closeLabel?: string;
  /** Milliseconds a notification stays when it sets no `duration` of its own. Defaults to 5000. */
  duration?: number;
  /** The corner they gather in. Defaults to the top end, clear of the dock. */
  placement?: ToastPlacement;
};

const TOAST_DURATION = 5000;

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
 * Shows the notifications added with `toast`, gathered in a corner, newest
 * last. Mount it once. Each leaves when its time runs out or its close
 * button is pressed; neither takes focus from what people are doing.
 */
export const ToastHost = setup<ToastHostProps>(
  (props) => () => (
    <div className={$families(AUI_CLASS.TOAST_HOST, props)} data-placement={props.placement ?? 'top-end'}>
      <For each={() => toast.entries}>
        {(entry) => (
          <Toast
            key={entry.id}
            color={entry.color}
            critical={entry.critical}
            duration={entry.duration ?? props.duration ?? TOAST_DURATION}
            size={props.size}
            ondismiss={entry.dismiss}
          >
            {typeof entry.content === 'function' ? (entry.content as () => ReactNode)() : entry.content}
            <Show when={() => props.closeLabel}>{(label) => <ToastClose aria-label={label} />}</Show>
          </Toast>
        )}
      </For>
    </div>
  ),
  'ToastHost'
);

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
