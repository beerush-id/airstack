import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiProps, auiConfig, OMIT_KEYS } from '../config.js';

export type SplitterProps = AuiProps<'div'> & {
  value?: Bindable<number>;
  min?: number;
  max?: number;
  step?: number;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  label?: string;
  children?: ReactNode;
  oninput?: (event: CustomEvent<number>) => void;
  onchange?: (event: CustomEvent<number>) => void;
};

const SPLITTER_ROLE = 'splitter';

const SPLITTER_OMIT = [...OMIT_KEYS, 'value', 'min', 'max', 'step', 'orientation'];

register('splitter', {});

/**
 * The movable boundary between two panes. It holds the position against real
 * bounds, follows a pointer drag along the parent area, and steps with the
 * arrows; every write is clamped.
 */
export const Splitter = setup<SplitterProps>((props) => {
  const splitter = aria(SPLITTER_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.SPLITTER, props, auiConfig.splitter);

  return () => (
    <div ref={splitter.ref} {...splitter.restProps(SPLITTER_OMIT)} className={className()}>
      {props.children}
    </div>
  );
}, 'Splitter');
