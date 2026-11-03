import { aria } from '@airlib/aria';
import { AUI_CLASS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, mutable, onMount, setup } from '@airlib/react';
import { $families, auiConfig, type AuiProps, OMIT_KEYS } from '../config.js';
import { FullscreenExitIcon, FullscreenIcon } from '../icons/index.js';
import { fullscreenHostCtx } from './context.js';

export type FullscreenButtonProps = AuiProps<'button'> & {
  /** Names the button for screen readers. Defaults to "Full screen". */
  label?: string;
  disabled?: boolean;
};

const TOGGLE_ROLE = 'toggle';

/** What a host carries while it fills the screen without the Fullscreen API, as a top-layer popover. */
const FALLBACK_ATTR = 'data-fullscreen';

register('fullscreenButton', { size: SIZES.SM, variant: VARIANTS.TEXT });

/**
 * Fills the screen with the part it sits in, and gives it back: a toggle, pressed while full
 * screen. Where the Fullscreen API is refused — inside a frame, say — the part fills the viewport
 * in the top layer instead, and Escape gives it back the same way.
 */
export const FullscreenButton = setup<FullscreenButtonProps>((props) => {
  const host = fullscreenHostCtx.get();
  const view = mutable({ active: false });

  const fallback = (element: HTMLElement, active: boolean) => {
    if (active) {
      element.setAttribute(FALLBACK_ATTR, 'true');
      element.setAttribute('popover', 'manual');
      element.showPopover?.();
    } else {
      if (element.matches(':popover-open')) element.hidePopover();
      element.removeAttribute('popover');
      element.removeAttribute(FALLBACK_ATTR);
    }
    view.active = active;
  };

  const toggle = aria<HTMLButtonElement, AnyType>(TOGGLE_ROLE, {
    get disabled() {
      return props.disabled;
    },
    get pressed() {
      return view.active;
    },
    set pressed(on: boolean) {
      const element = host?.();
      if (!element) return;
      if (!on) {
        if (document.fullscreenElement) void document.exitFullscreen();
        else fallback(element, false);
      } else if (element.requestFullscreen) {
        element.requestFullscreen().catch(() => fallback(element, true));
      } else {
        fallback(element, true);
      }
    },
  } as AnyType);

  // Full screen ends outside the button too — the browser's own Escape — so the state follows the document.
  onMount(() => {
    const sync = () => {
      view.active = !!document.fullscreenElement && document.fullscreenElement === host?.();
    };
    const esc = (event: KeyboardEvent) => {
      const element = host?.();
      if (event.key === 'Escape' && element?.hasAttribute(FALLBACK_ATTR)) fallback(element, false);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('keydown', esc);
    };
  });

  const className = () =>
    `${$families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON], props, auiConfig.fullscreenButton)} ${AUI_CLASS.CONTROL_ICON}`;

  return () => (
    <button
      ref={toggle.ref}
      {...toggle.restProps([...OMIT_KEYS, 'label'])}
      aria-label={props.label ?? 'Full screen'}
      className={className()}
    >
      {view.active ? <FullscreenExitIcon aria-hidden="true" /> : <FullscreenIcon aria-hidden="true" />}
    </button>
  );
}, 'FullscreenButton');
