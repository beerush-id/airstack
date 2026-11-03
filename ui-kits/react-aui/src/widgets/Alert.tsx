import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, classx, Slot, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CheckIcon, CloseIcon, ErrorIcon, InfoIcon, WarningIcon } from '../icons/index.js';

export type AlertVariant = 'tonal' | 'filled';

export type AlertSlots = {
  icon: () => ReactNode;
  actions: () => ReactNode;
};

export type AlertProps = Omit<ComponentProps<'div'>, 'className' | 'color' | 'title'> &
  Omit<ComponentStyles, 'variant'> & {
    variant?: AlertVariant;
    title?: ReactNode;
    description?: ReactNode;
    open?: Bindable<boolean>;
    dismissable?: boolean;
    dismissLabel?: string;
    politeness?: 'polite' | 'assertive' | 'off';
    children?: ReactNode;
    ondismiss?: () => void;
  };

const ALERT_ROLE = 'announcer';
const ALERT = branded('alert');
const ALERT_ICON = branded('alert-icon');
const ALERT_CONTENT = branded('alert-content');
const ALERT_TITLE = branded('alert-title');
const ALERT_BODY = branded('alert-body');
const ALERT_ACTIONS = branded('alert-actions');
const ALERT_DISMISS = branded('alert-dismiss');
const ALERT_OMIT = [...OMIT_KEYS, 'title', 'description', 'open', 'dismissable', 'dismissLabel', 'ondismiss'];

/** The glyph each role speaks with when no `icon` slot is given. */
const ROLE_ICONS: Partial<Record<string, typeof InfoIcon>> = {
  success: CheckIcon,
  warning: WarningIcon,
  error: ErrorIcon,
};

register('alert', { size: SIZES.MD, color: COLORS.INFO, variant: VARIANTS.TONAL });

/**
 * An inline message that stays in the page: a notice, a warning, a success
 * after saving. It sits where it is written and speaks through a live
 * region, so a message that appears later is announced; one present on load
 * is simply read in place. Set `politeness="assertive"` for urgent changes,
 * `"off"` for messages that should never interrupt.
 */
export const Alert = setup<AlertProps, AlertSlots>((props, slots) => {
  const alert = aria(ALERT_ROLE, props as AnyType);
  const config = () => auiConfig.alert;
  const className = () => $families([AUI_CLASS.SCALE, ALERT], props as ComponentStyles, config());

  const dismiss = () => {
    props.open = false;
    props.ondismiss?.();
  };

  const roleIcon = () => {
    const Icon = ROLE_ICONS[props.color ?? config()?.color ?? COLORS.INFO] ?? InfoIcon;
    return <Icon />;
  };

  // The dismiss button is always icon-only; its classes are composed here so `overrides` never strips them.
  const dismissClass = () =>
    classx(
      $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON], { size: props.size ?? config()?.size, variant: VARIANTS.TEXT }),
      AUI_CLASS.CONTROL_ICON,
      ALERT_DISMISS
    );

  return () => (
    <div
      ref={alert.ref}
      {...alert.restProps(ALERT_OMIT)}
      hidden={props.open === false || undefined}
      className={className()}
    >
      <span className={ALERT_ICON} aria-hidden="true">
        <Slot for={() => slots.icon?.()}>{roleIcon()}</Slot>
      </span>
      <div className={ALERT_CONTENT}>
        {props.title && <p className={ALERT_TITLE}>{props.title}</p>}
        {(props.children ?? props.description) && (
          <div className={ALERT_BODY}>{props.children ?? props.description}</div>
        )}
      </div>
      {slots.actions && (
        <div className={ALERT_ACTIONS}>
          <Slot for={() => slots.actions?.()} />
        </div>
      )}
      {props.dismissable && (
        <button type="button" className={dismissClass()} aria-label={props.dismissLabel} onClick={dismiss}>
          <CloseIcon aria-hidden="true" />
        </button>
      )}
    </div>
  );
}, 'Alert');
