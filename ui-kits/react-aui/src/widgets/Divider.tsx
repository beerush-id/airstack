import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ComponentProps } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type DividerProps = ComponentProps<'div'> &
  Omit<ComponentStyles, 'size' | 'variant'> & {
    orientation?: 'horizontal' | 'vertical';
    inset?: boolean;
  };

const DIVIDER_ROLE = 'divider';
const DIVIDER_OMIT_KEYS = [...OMIT_KEYS, 'orientation', 'inset'] as const;

const dividerStyles: ComponentStyles = {};

register(DIVIDER_ROLE, dividerStyles);

/**
 * Structural boundary announced as a separator but never focusable and
 * never a value. The axis is announced only when it departs from the
 * horizontal default. `inset` stops the rule short of both ends.
 */
export const Divider = setup<DividerProps>((props) => {
  const divider = aria(DIVIDER_ROLE, props);
  const className = () => {
    const families = $families(AUI_CLASS.DIVIDER, props, auiConfig.divider);
    return props.inset ? `${families} ${AUI_CLASS.DIVIDER_INSET}` : families;
  };

  return () => (
    <div ref={divider.ref} {...divider.restProps([...DIVIDER_OMIT_KEYS])} className={className()}>
      {props.children}
    </div>
  );
}, 'Divider');
