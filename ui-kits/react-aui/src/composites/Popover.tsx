import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { $static, type AnyType, type Bindable, setup, teleport } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import type { OverlayTriggerMode, OverlayXDirection, OverlayYDirection, PopoverRole } from './overlay.js';

export type PopoverProps = ComponentStyles & {
  id?: string;
  open?: Bindable<boolean>;
  popupRole?: PopoverRole;
  mode?: OverlayTriggerMode[];
  delay?: number;
  dismissable?: boolean;
  autofocus?: boolean;
  xDir?: OverlayXDirection;
  yDir?: OverlayYDirection;
  children?: ReactNode;
  onopen?: (event: CustomEvent<boolean>) => void;
  onclose?: (event: CustomEvent<boolean>) => void;
  ontoggle?: (event: CustomEvent<boolean>) => void;
};

const POPOVER_ROLE = 'popover';

register('popover', { size: 'md', color: 'primary' });

/**
 * Floating panel anchored to the actionable control around it. The
 * trigger is refined, not wired: the panel compiles the popup contract
 * onto it and keeps its own id, role, and hidden state.
 */
export const Popover = setup<PopoverProps>((props) => {
  const popupRole = $static(() => props.popupRole);
  const popover = aria(POPOVER_ROLE, props as AnyType, { popupRole });
  const className = () => $families([AUI_CLASS.PANEL, AUI_CLASS.POPOVER], props, auiConfig.popover);

  // Teleported to the page while open, so no ancestor's overflow, stacking, or containing block can trap it.
  return () => {
    if (!popover.open) return null;
    return teleport(
      <div ref={popover.ref} {...popover.restProps(OMIT_KEYS)} className={className()}>
        {props.children}
      </div>
    );
  };
}, 'Popover');
