import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { $static, type AnyType, type Bindable, setup } from '@airlib/react';
import type { MouseEvent, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CheckIcon, CloseIcon } from '../icons/index.js';
import { Button } from './Button.js';

export type ChipProps = ComponentStyles & {
  id?: string;
  /** Turns the chip into a filter: a pressable button that stays on or off. */
  pressed?: Bindable<boolean>;
  /** Token a filter chip stands for inside a toggle group. */
  value?: string;
  /** Adds a remove button after the label. */
  removable?: boolean;
  /** Accessible name of the remove button, e.g. `Remove Berlin`. */
  removeLabel?: string;
  disabled?: boolean;
  children?: ReactNode;
  /** The remove button was activated; drop the chip's entry from your data. */
  onremove?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** A filter chip was switched on or off. */
  onchange?: (event: CustomEvent<boolean>) => void;
};

const TOGGLE_ROLE = 'toggle';
const CHIP = branded('chip');
const CHIP_LABEL = branded('chip-label');
const CHIP_REMOVE = branded('chip-remove');
const CHIP_OMIT = [...OMIT_KEYS, 'removable', 'removeLabel', 'onremove', 'pressed', 'value'];

register('chip', { size: SIZES.SM, color: COLORS.PRIMARY, variant: VARIANTS.TONAL });

/**
 * A compact label. Three shapes from one component:
 * - a static tag (just children),
 * - a removable tag (`removable` adds a remove button and fires `onremove`),
 * - a filter chip (`pressed` makes it a toggle button that shows a check while on).
 */
export const Chip = setup<ChipProps>((props) => {
  const filter = $static(() => props.pressed !== undefined);
  const toggle = filter ? aria<HTMLButtonElement>(TOGGLE_ROLE, props as AnyType) : undefined;
  const className = () =>
    $families(
      filter ? [AUI_CLASS.SCALE, CHIP, AUI_CLASS.FOCUSABLE] : [AUI_CLASS.SCALE, CHIP],
      props,
      auiConfig.chip
    );
  const remove = (event: MouseEvent<HTMLButtonElement>) => props.onremove?.(event);

  return () => {
    if (toggle) {
      return (
        <button ref={toggle.ref} {...toggle.restProps(CHIP_OMIT)} className={className()}>
          {toggle.pressed && <CheckIcon aria-hidden="true" />}
          <span className={CHIP_LABEL}>{props.children}</span>
        </button>
      );
    }

    return (
      <span id={props.id} className={className()} aria-disabled={props.disabled ? 'true' : undefined}>
        <span className={CHIP_LABEL}>{props.children}</span>
        {props.removable && (
          <Button
            className={`${AUI_CLASS.CONTROL_ICON} ${CHIP_REMOVE}`}
            size={props.size}
            variant="text"
            disabled={props.disabled}
            aria-label={props.removeLabel}
            onClick={remove}
          >
            <CloseIcon aria-hidden="true" />
          </Button>
        )}
      </span>
    );
  };
}, 'Chip');
