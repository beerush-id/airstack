import { aria } from '@airlib/aria';
import { AUI_CLASS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { FullscreenExitIcon, FullscreenIcon } from '../icons/index.js';

export type FullscreenButtonProps = ComponentStyles & {
  /** Names the button, e.g. "Full screen"; it reads as pressed while full screen. */
  label?: string;
  disabled?: boolean;
};

const FULLSCREEN_ROLE = 'fullscreen-toggle';

register('fullscreenButton', { size: SIZES.SM, variant: VARIANTS.TEXT });

/**
 * Takes what it sits in — an image viewer, a stage player — to full screen and back. Place it
 * anywhere inside the part, toolbar included; it finds the part itself.
 */
export const FullscreenButton = setup<FullscreenButtonProps>((props) => {
  const toggle = aria(FULLSCREEN_ROLE, props);
  const className = () =>
    `${$families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON], props, auiConfig.fullscreenButton)} ${AUI_CLASS.CONTROL_ICON}`;

  return () => (
    <button
      ref={toggle.ref}
      {...toggle.restProps([...OMIT_KEYS, 'label'])}
      aria-label={props.label ?? 'Full screen'}
      className={className()}
    >
      {toggle.state.active ? <FullscreenExitIcon aria-hidden="true" /> : <FullscreenIcon aria-hidden="true" />}
    </button>
  );
}, 'FullscreenButton');
