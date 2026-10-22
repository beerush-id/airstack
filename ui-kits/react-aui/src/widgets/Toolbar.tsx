import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type ToolbarProps = Omit<ComponentProps<'div'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'size' | 'variant' | 'color'> & {
    label?: string;
    orientation?: 'horizontal' | 'vertical';
    disabled?: boolean;
    children?: ReactNode;
  };

const TOOLBAR_ROLE = 'toolbar';

const toolbarStyles: ComponentStyles = {};

register('toolbar', toolbarStyles);

/**
 * Named strip owning arrow travel across its controls.
 * One axis is claimed; activation stays with the focused control.
 */
export const Toolbar = setup<ToolbarProps>((props) => {
  const toolbar = aria(TOOLBAR_ROLE, props);
  const className = () => $families(AUI_CLASS.TOOLBAR, props, auiConfig.toolbar);

  return () => (
    <div ref={toolbar.ref} {...toolbar.restProps([...OMIT_KEYS, 'orientation'])} className={className()}>
      {props.children}
    </div>
  );
}, 'Toolbar');
