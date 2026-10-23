import { AUI_CLASS, COLORS, register, VARIANTS } from '@airlib/aui/utils';
import { effect, renderDynamic, setup, uIndex } from '@airlib/react';
import { LIVE_SELECTION } from '@airlib/react/browser';
import type { MouseEvent, ReactNode } from 'react';
import { $class, auiConfig, type ComponentStyles } from '../config.js';
import { Toolbar } from './Toolbar.js';

export type FloatingToolbarProps = Omit<ComponentStyles, 'size'> & {
  /** Names the strip for screen readers, e.g. "Formatting". */
  label?: string;
  /** Stops a selection from bringing the strip up. */
  disabled?: boolean;
  /** The controls on the strip; as a function, it gets the selected text. */
  children?: ReactNode | ((text: string) => ReactNode);
};

register('floatingToolbar', { color: COLORS.PRIMARY, variant: VARIANTS.GLASS });

/** The attribute that marks the region a floating toolbar inside it is limited to. */
const SCOPE = '[data-floating-scope]';

const FLOATING_TOOLBAR_SYMBOL = Symbol('aui-floating-toolbar');

/**
 * A toolbar that rises above the text people select. On mount it looks for
 * its nearest `data-floating-scope` region: inside one, it is limited to
 * selections in that region; without one, it follows selections anywhere on
 * the page. The strip renders only while there is a selection to act on, in
 * the top layer, glass by default, so nothing clips it, and it is anchored to
 * the element holding the selection, so it stays on it through any scrolling.
 * Pressing a control keeps the selection, so a command still sees the text it
 * acts on; `Escape` on the strip clears the selection and hides it.
 */
export const FloatingToolbar = setup<FloatingToolbarProps>((props) => {
  const anchorName = `--aui-floating-toolbar-${uIndex(FLOATING_TOOLBAR_SYMBOL, true)}`;
  let scope: Element | null = null;
  // The element lending its anchor, and the anchor names it had before.
  let lender: { element: HTMLElement; names: string } | undefined;

  // Where the toolbar lives decides whether it is limited to a scope or free.
  const locate = (anchor: HTMLElement | null) => {
    scope = anchor?.parentElement?.closest(SCOPE) ?? null;
  };

  // The selection, while a non-empty one lies where the toolbar may act.
  const selected = () => {
    const { size, rect, target } = LIVE_SELECTION;
    if (props.disabled || !size || !rect || !target) return;
    if (scope && !scope.contains(target)) return;
    return { rect, target: target as HTMLElement };
  };

  const release = () => {
    if (!lender) return;
    lender.element.style.anchorName = lender.names;
    lender = undefined;
  };

  // The element holding the selection carries the strip's anchor name, alongside any it has.
  effect(() => {
    const target = selected()?.target;
    if (target === lender?.element) return;

    release();
    if (!target) return;

    const names = target.style.anchorName;
    const own = getComputedStyle(target).anchorName;
    target.style.anchorName = own && own !== 'none' ? `${own}, ${anchorName}` : anchorName;
    lender = { element: target, names };
  });

  // The selection's place within the element holding it, which scrolling never changes.
  const place = ({ rect, target }: { rect: DOMRect; target: HTMLElement }) => {
    const origin = target.getBoundingClientRect();
    return {
      '--aui-floating-toolbar-anchor': anchorName,
      '--aui-floating-toolbar-x': `${rect.left + rect.width / 2 - origin.left}px`,
      '--aui-floating-toolbar-y': `${rect.top - origin.top}px`,
    } as never;
  };

  const raise = (strip: HTMLElement | null) => {
    strip?.showPopover();
  };

  // A press would move focus and clear the selection the command needs; fields still take focus.
  const keep = (event: MouseEvent) => {
    if (!(event.target as Element).closest('input, textarea, select, [contenteditable="true"]')) {
      event.preventDefault();
    }
  };

  const dismiss = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).ownerDocument.getSelection()?.collapseToEnd();
  };

  return () => {
    const selection = selected();

    return (
      <>
        <span ref={locate} hidden />
        {selection && (
          <Toolbar
            ref={raise as never}
            popover="manual"
            label={props.label}
            color={props.color ?? auiConfig.floatingToolbar?.color}
            variant={props.variant ?? auiConfig.floatingToolbar?.variant}
            className={$class(props, AUI_CLASS.FLOATING_TOOLBAR)}
            style={place(selection)}
            onMouseDown={keep}
            onKeyDown={dismiss as never}
          >
            {renderDynamic(props.children, LIVE_SELECTION.text)}
          </Toolbar>
        )}
      </>
    );
  };
}, 'FloatingToolbar');
