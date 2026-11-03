import { $static } from '@airlib/core';
import type { BaseElement } from '../../types.js';
import type { ListboxAttributes } from '../listbox.js';
import { MenuPanelAria, type MenuPanelProps } from '../menu/panel.js';
import { type ContextMenuAria, contextMenuCtx } from './context-menu.js';

/**
 * Reactive input properties for the ContextMenu panel.
 */
export interface ContextMenuPanelProps extends MenuPanelProps {}
/**
 * Anchored panel for context menus.
 *
 * Inherits MenuPanelAria (vertical roving focus, typeahead, item activation,
 * and internal popover dismissal).
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class ContextMenuPanelAria<E extends BaseElement = HTMLElement> extends MenuPanelAria<E> {
  public declare host?: ContextMenuAria;

  /**
   * Unique panel identifier, preferring user-provided ID or falling back to namespaced root ID.
   */
  public override get id(): string {
    return this.host?.id ?? this.properties.id!;
  }

  /**
   * @param props - User-provided panel properties.
   */
  public constructor(props: ContextMenuPanelProps = {}) {
    super(props);

    $static(() => {
      this.popup.properties.mode = ['click'];
    });

    this.popup.refine((_, attrs) => {
      if (this.host?.anchorX !== undefined && this.host?.anchorY !== undefined) {
        return {
          style: {
            ...attrs.style,
            '--anchor-x': `${this.host.anchorX}px`,
            '--anchor-y': `${this.host.anchorY}px`,
          },
        };
      }
    });
  }

  /**
   * Compiles the panel attributes, ensuring pointer coordinates are reflected in style.
   */
  protected override createAttributes(): ListboxAttributes<E> {
    const attrs = super.createAttributes();
    if (this.host?.anchorX !== undefined && this.host?.anchorY !== undefined) {
      attrs.style = {
        ...attrs.style,
        '--anchor-x': `${this.host.anchorX}px`,
        '--anchor-y': `${this.host.anchorY}px`,
      };
    }
    return attrs;
  }
}
