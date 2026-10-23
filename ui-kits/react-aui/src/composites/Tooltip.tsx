import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup, teleport } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import type { OverlayXDirection, OverlayYDirection } from './overlay.js';

export type TooltipMode = 'hover' | 'focus' | 'click';

export type TooltipProps = ComponentStyles & {
  id?: string;
  open?: Bindable<boolean>;
  mode?: TooltipMode[];
  delay?: number;
  dismissable?: boolean;
  xDir?: OverlayXDirection;
  yDir?: OverlayYDirection;
  children?: ReactNode;
  onchange?: (event: CustomEvent<boolean>) => void;
};

const TOOLTIP_ROLE = 'tooltip';

register('tooltip', {});

/**
 * Advisory panel describing the control around it. It is not a control:
 * it claims no tab stop, never takes focus, and links to the trigger
 * through `aria-describedby` only while it is showing.
 */
export const Tooltip = setup<TooltipProps>((props) => {
  const tooltip = aria(TOOLTIP_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TOOLTIP, props, auiConfig.tooltip);

  // Teleported to the page while showing, so no ancestor's overflow, stacking, or containing block can trap it.
  return () => {
    if (!tooltip.open) return null;
    return teleport(
      <div ref={tooltip.ref} {...tooltip.restProps(OMIT_KEYS)} className={className()}>
        {props.children}
      </div>
    );
  };
}, 'Tooltip');
