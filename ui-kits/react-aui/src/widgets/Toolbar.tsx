import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, VARIANTS } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type ToolbarProps = Omit<ComponentProps<'div'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'size'> & {
    label?: string;
    orientation?: 'horizontal' | 'vertical';
    disabled?: boolean;
    children?: ReactNode;
  };

const TOOLBAR_ROLE = 'toolbar';

const toolbarStyles: ComponentStyles = {
  color: COLORS.PRIMARY,
  variant: VARIANTS.TEXT,
};

register('toolbar', toolbarStyles);

/**
 * Named strip owning arrow travel across its controls.
 * One axis is claimed; activation stays with the focused control.
 * `variant` gives the strip a surface the controls and groups sit on —
 * none for `text`, the default — and `color` tints it.
 */
export const Toolbar = setup<ToolbarProps>((props) => {
  const toolbar = aria(TOOLBAR_ROLE, props);
  const className = () => {
    const families = $families([AUI_CLASS.SCALE, AUI_CLASS.TOOLBAR], props, auiConfig.toolbar);
    // Glass is the shared material, not a strip style of its own.
    const variant = props.variant ?? auiConfig.toolbar?.variant;
    return variant === VARIANTS.GLASS ? `${families} ${AUI_CLASS.GLASS_FRAME}` : families;
  };

  return () => (
    <div ref={toolbar.ref} {...toolbar.restProps([...OMIT_KEYS, 'orientation'])} className={className()}>
      {props.children}
    </div>
  );
}, 'Toolbar');
