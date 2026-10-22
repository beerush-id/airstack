import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ComponentProps } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type DividerProps = ComponentProps<'div'> &
  Omit<ComponentStyles, 'size' | 'variant'> & {
    orientation?: 'horizontal' | 'vertical';
  };

const DIVIDER_ROLE = 'divider';
const DIVIDER_OMIT_KEYS = [...OMIT_KEYS, 'orientation'] as const;

const dividerStyles: ComponentStyles = {};

register(DIVIDER_ROLE, dividerStyles);

/**
 * Structural boundary announced as a separator but never focusable and
 * never a value. The axis is announced only when it departs from the
 * horizontal default.
 */
export const Divider = setup<DividerProps>((props) => {
  const divider = aria(DIVIDER_ROLE, props);
  const className = () => $families(AUI_CLASS.DIVIDER, props, auiConfig.divider);

  return () => (
    <div ref={divider.ref} {...divider.restProps([...DIVIDER_OMIT_KEYS])} className={className()}>
      {props.children}
    </div>
  );
}, 'Divider');
