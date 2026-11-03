import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, classx, setup, shadowPortal } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { modalScope } from './scopes.js';

export type DialogTriggerProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

export type DialogPanelProps = ComponentStyles & {
  children?: ReactNode;
};

export type DialogTitleProps = ComponentStyles & {
  children?: ReactNode;
};

export type DialogDescriptionProps = ComponentStyles & {
  children?: ReactNode;
};

/** The dialog entities: each names its classes, its style config, and its parts. */
export type DialogName = 'dialog' | 'confirm' | 'drawer';

export type DialogPartsOptions = {
  /**
   * The behavior its parts play: `dialog` for a dismissable sheet, `confirm` for a decision.
   *
   * @default 'dialog'
   */
  role?: 'dialog' | 'confirm';
  /**
   * Adds a class of the entity's own to its panel. Runs in the panel's setup, where context is
   * in reach, and returns the class to read on every render.
   */
  panelClass?: () => () => string | undefined;
};

/**
 * Builds the parts every dialog entity shares — the trigger that opens it, the panel, its title,
 * and its description — so Dialog, Confirm, and Drawer differ only where they really do. The
 * panel is a window over the page: a glass frame that catches the pointer's light, holding the
 * content on a solid surface, with a scrim beside it while modal. It is drawn over the page, so
 * no glass or transformed ancestor can hold it.
 *
 * @param name - The entity: its classes (`aui-<name>-panel`) and style config (`<name>Panel`).
 * @param componentName - Display-name prefix for the parts (`Confirm` → `ConfirmPanel`).
 * @param options - The behavior the parts play, and a class of the entity's own for the panel.
 * @returns The `Trigger`, `Panel`, `Title`, and `Description` components.
 */
export function createDialog(name: DialogName, componentName: string, options: DialogPartsOptions = {}) {
  const role = options.role ?? 'dialog';
  const classes = {
    trigger: branded(`${name}-trigger`),
    panel: branded(`${name}-panel`),
    title: branded(`${name}-title`),
    description: branded(`${name}-description`),
  };

  register(`${name}Trigger`, { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.FILLED });
  register(`${name}Panel`, {});
  register(`${name}Title`, {});
  register(`${name}Description`, {});

  /** Button that opens the enclosing dialog. Carries `aria-haspopup`, `aria-expanded`, and `aria-controls`. */
  const Trigger = setup<DialogTriggerProps>((props) => {
    const styles = modalScope.inherit(props);
    const trigger = aria(`${role}-trigger` as 'dialog-trigger', props as AnyType);
    const className = () =>
      $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, classes.trigger], styles, auiConfig[`${name}Trigger`]);

    return () => (
      <button ref={trigger.ref} {...trigger.restProps(OMIT_KEYS)} className={className()}>
        {props.children}
      </button>
    );
  }, `${componentName}Trigger`);

  /** The dialog itself: a frame that traps focus while modal, holding its content on a surface. */
  const Panel = setup<DialogPanelProps>((props) => {
    const panel = aria(`${role}-panel` as 'dialog-panel', props as AnyType, { trackPointer: true });
    const shadow = shadowPortal(() => panel.open);
    const ownClass = options.panelClass?.();
    const className = () =>
      classx(
        $families([AUI_CLASS.MODAL_PANEL, classes.panel], props, auiConfig[`${name}Panel`]),
        AUI_CLASS.GLINT,
        ownClass?.()
      );

    return () =>
      shadow(
        <>
          <div className={AUI_CLASS.MODAL_SCRIM} />
          <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
            <div className={AUI_CLASS.MODAL_CONTENT}>{props.children}</div>
          </div>
        </>
      );
  }, `${componentName}Panel`);

  /** Names the dialog, addressed by `aria-labelledby`. */
  const Title = setup<DialogTitleProps>((props) => {
    const title = aria(`${role}-title` as 'dialog-title', props as AnyType);
    const className = () => $families([AUI_CLASS.MODAL_TITLE, classes.title], props, auiConfig[`${name}Title`]);

    return () => (
      <div ref={title.ref} {...title.restProps(OMIT_KEYS)} className={className()}>
        {props.children}
      </div>
    );
  }, `${componentName}Title`);

  /** Explains the dialog, addressed by `aria-describedby`. */
  const Description = setup<DialogDescriptionProps>((props) => {
    const description = aria(`${role}-description` as 'dialog-description', props as AnyType);
    const className = () =>
      $families([AUI_CLASS.MODAL_DESCRIPTION, classes.description], props, auiConfig[`${name}Description`]);

    return () => (
      <div ref={description.ref} {...description.restProps(OMIT_KEYS)} className={className()}>
        {props.children}
      </div>
    );
  }, `${componentName}Description`);

  return { Trigger, Panel, Title, Description };
}
