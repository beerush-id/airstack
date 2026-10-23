import { aria, type ReorderAria, type ReorderItemAria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, renderDynamic, Slot, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { DragIndicator } from '../icons/index.js';
import { createStyleScope, type ItemEntry, type ItemsInput, toEntries } from '../utils/common.js';

export type ReorderOrientation = 'vertical' | 'horizontal';

export type ReorderSlots = {
  item: (entry: ItemEntry, position: number) => ReactNode;
};

export type ReorderProps = ComponentStyles & {
  id?: string;
  label?: string;
  labelledby?: string;
  value?: Bindable<string[]>;
  preview?: Bindable<string[]>;
  active?: Bindable<string | null>;
  orientation?: ReorderOrientation;
  disabled?: boolean;
  items?: ItemsInput;
  /** Names each entry's grip in `items` mode, e.g. `(entry) => t('move', entry.label)`. */
  handleLabel?: (entry: ItemEntry) => string;
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
register('reorderItem', { size: SIZES.MD, color: COLORS.PRIMARY });
register('reorderHandle', { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.TEXT });

const reorderScope = createStyleScope();

/**
 * Collection that rearranges existing entries. The committed `value` stays
 * put while an entry is held: moves rewrite `preview`, a drop commits, and
 * `Escape` or a tab away restores the original order.
 * With `items` it renders the entries itself in their live order, each with
 * a grip; `value` then only needs binding if you want the order back.
 */
export const Reorder = setup<ReorderProps, ReorderSlots>((props, slots) => {
  const reorder = aria(REORDER_ROLE, props as AnyType);
  const className = () => {
    const tokens = [AUI_CLASS.REORDER];
    if (props.orientation === 'horizontal') tokens.push(AUI_CLASS.REORDER_HORIZONTAL);
    return $families(tokens, { className: props.className }, auiConfig.reorder);
  };

  reorderScope.provide(props);

  // While an entry is held the preview is the order on screen; otherwise the committed value.
  const order = () => {
    const entries = toEntries(props.items);
    const names = (props.active ? props.preview : props.value) ?? entries.map((entry) => entry.name);
    return names.map((name, index) => ({
      entry: entries.find((entry) => entry.name === name) ?? { name },
      position: index + 1,
    }));
  };

  return () => (
    <ol
      ref={reorder.ref}
      {...reorder.restProps([...OMIT_KEYS, 'labelledby', 'items', 'handleLabel'])}
      className={className()}
    >
      {props.items ? (
        // Keyed by name so a held entry keeps its node while the order shifts around it.
        order().map(({ entry, position }) => (
          <ReorderItem key={entry.name} value={entry.name} disabled={entry.disabled}>
            <span>
              <Slot for={() => slots.item?.(entry, position)}>{entry.label ?? entry.name}</Slot>
            </span>
            <ReorderHandle label={props.handleLabel?.(entry)} />
          </ReorderItem>
        ))
      ) : (
        renderDynamic(props.children, reorder)
      )}
    </ol>
  );
}, 'Reorder');

/**
 * One movable entry. It publishes itself to the enclosing collection and its
 * own `value` decides where its handle moves it. The `<li>` holds the slot and
 * never moves; its content sits in an inner card, the part that follows the
 * pointer while the entry is dragged.
 */
export const ReorderItem = setup<ReorderItemProps>((props) => {
  const root = reorderScope.get() as ReorderProps | undefined;
  const styles = reorderScope.inherit(props);
  const item = aria(ITEM_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.SCALE, AUI_CLASS.REORDER_ITEM], styles, auiConfig.reorderItem);

  // Slots the held entry has already moved in the preview; CSS subtracts them from the pointer travel.
  const shift = () => {
    if (!root?.active || root.active !== props.value) return 0;
    return (root.preview?.indexOf(props.value) ?? 0) - (root.value?.indexOf(props.value) ?? 0);
  };

  return () => (
    <li
      ref={item.ref}
      {...(item.restProps([...OMIT_KEYS, 'value']) as ComponentProps<'li'>)}
      style={{ '--aui-reorder-shift': shift() } as ComponentProps<'li'>['style']}
      className={className()}
    >
      <div className={AUI_CLASS.REORDER_CARD}>{renderDynamic(props.children, item)}</div>
    </li>
  );
}, 'ReorderItem');

/**
 * The grip inside an entry. Activating it picks the entry up, the arrows move
 * its slot, activating it again drops, and a pointer drag is the same gesture.
 * Without children it shows a drag glyph.
 */
export const ReorderHandle = setup<ReorderHandleProps>((props) => {
  const scoped = reorderScope.inherit(props);
  const handle = aria(HANDLE_ROLE, props as AnyType);
  const className = () => {
    const families = $families(
      [AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.REORDER_HANDLE],
      { size: scoped.size, color: scoped.color, variant: props.variant, className: props.className },
      auiConfig.reorderHandle
    );
    return props.children ? families : `${families} ${AUI_CLASS.CONTROL_ICON}`;
  };

  return () => (
    <button ref={handle.ref} {...handle.restProps([...OMIT_KEYS, 'type'])} type="button" className={className()}>
      {props.children ?? <DragIndicator aria-hidden="true" />}
    </button>
  );
}, 'ReorderHandle');
