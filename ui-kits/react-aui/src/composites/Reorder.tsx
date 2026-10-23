import { aria, type ReorderAria, type ReorderItemAria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, renderDynamic, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type ReorderOrientation = 'vertical' | 'horizontal';

export type ReorderProps = ComponentStyles & {
  id?: string;
  label?: string;
  labelledby?: string;
  value?: Bindable<string[]>;
  preview?: Bindable<string[]>;
  active?: Bindable<string | null>;
  orientation?: ReorderOrientation;
  disabled?: boolean;
  children?: ReactNode | ((reorder: ReorderAria) => ReactNode);
  oninput?: (event: CustomEvent<string[]>) => void;
  onchange?: (event: CustomEvent<string[]>) => void;
  oncancel?: (event: CustomEvent<string>) => void;
};

export type ReorderItemProps = ComponentStyles & {
  id?: string;
  value: string;
  label?: string;
  disabled?: boolean;
  children?: ReactNode | ((item: ReorderItemAria) => ReactNode);
};

export type ReorderHandleProps = ComponentStyles & {
  id?: string;
  label?: string;
  disabled?: boolean;
  children?: ReactNode;
};

const REORDER_ROLE = 'reorder';
const ITEM_ROLE = 'reorder-item';
const HANDLE_ROLE = 'reorder-handle';

register('reorder', {});
register('reorderItem', {});
register('reorderHandle', {});

/**
 * Collection that rearranges existing entries. The committed `value` stays
 * put while an entry is held: moves rewrite `preview`, a drop commits, and
 * `Escape` or a tab away restores the original order.
 */
export const Reorder = setup<ReorderProps>((props) => {
  const reorder = aria(REORDER_ROLE, props as AnyType);
  const className = () => {
    const tokens = [AUI_CLASS.REORDER];
    if (props.orientation === 'horizontal') tokens.push(AUI_CLASS.REORDER_HORIZONTAL);
    return $families(tokens, props, auiConfig.reorder);
  };

  return () => (
    <ul ref={reorder.ref} {...reorder.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {renderDynamic(props.children, reorder)}
    </ul>
  );
}, 'Reorder');

/**
 * One movable entry. It publishes itself to the enclosing collection and its
 * own `value` decides where its handle moves it.
 */
export const ReorderItem = setup<ReorderItemProps>((props) => {
  const item = aria(ITEM_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.REORDER_ITEM, props, auiConfig.reorderItem);

  return () => (
    <li ref={item.ref} {...(item.restProps([...OMIT_KEYS, 'value']) as ComponentProps<'li'>)} className={className()}>
      {renderDynamic(props.children, item)}
    </li>
  );
}, 'ReorderItem');

/**
 * The grip inside an entry. Activating it picks the entry up, the arrows move
 * its slot, activating it again drops, and a pointer drag is the same gesture.
 */
export const ReorderHandle = setup<ReorderHandleProps>((props) => {
  const handle = aria(HANDLE_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.REORDER_HANDLE], props, auiConfig.reorderHandle);

  return () => (
    <button ref={handle.ref} {...handle.restProps([...OMIT_KEYS, 'type'])} type="button" className={className()}>
      {props.children}
    </button>
  );
}, 'ReorderHandle');
