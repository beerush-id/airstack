import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ComponentProps } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type DividerProps = ComponentProps<'div'> &
  Omit<ComponentStyles, 'variant'> & {
    orientation?: 'horizontal' | 'vertical';
    inset?: boolean;
    /** `ghost` keeps the room and draws no line: a gap between groups, e.g. a window's own buttons and the app's. */
    variant?: 'ghost';
  };

const DIVIDER_ROLE = 'divider';
const DIVIDER_OMIT_KEYS = [...OMIT_KEYS, 'orientation', 'inset'] as const;
const GHOST_CLASS = branded('divider-ghost');

const dividerStyles: ComponentStyles = {};

register(DIVIDER_ROLE, dividerStyles);

/**
 * Structural boundary announced as a separator but never focusable and
 * never a value. The axis is announced only when it departs from the
 * horizontal default. `inset` stops the rule short of both ends; `size`
 * is the room it keeps on either side of the line, and `ghost` keeps that
 * room without drawing the line.
 */
export const Divider = setup<DividerProps>((props) => {
  const divider = aria(DIVIDER_ROLE, props);
  const className = () =>
    [
      $families(AUI_CLASS.DIVIDER, props, auiConfig.divider),
      props.inset && AUI_CLASS.DIVIDER_INSET,
      props.variant === 'ghost' && GHOST_CLASS,
    ]
      .filter(Boolean)
      .join(' ');

  return () => (
    <div ref={divider.ref} {...divider.restProps([...DIVIDER_OMIT_KEYS])} className={className()}>
      {props.children}
    </div>
  );
}, 'Divider');
