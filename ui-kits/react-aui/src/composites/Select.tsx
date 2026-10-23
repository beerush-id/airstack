import { aria, type OptionAria, type SelectAria, type SelectPanelAria, type SelectTriggerAria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, renderDynamic, Slot, setup, shadowPortal } from '@airlib/react';
import type { ReactNode } from 'react';
import {
  $families,
  type AuiFieldProps,
  type AuiPrimitive,
  type AuiProps,
  auiConfig,
  type ComponentStyles,
  type FieldStyles,
  OMIT_KEYS,
} from '../config.js';
import { ArrowDown, CheckIcon } from '../icons/index.js';
import { createStyleScope, hasEntries, type OptionEntry, type OptionsInput, toOptions } from '../utils/common.js';

export type SelectValue = AuiPrimitive | AuiPrimitive[];
export type SelectItem = OptionEntry;

export type SelectSlots = {
  option: (entry: OptionEntry, option: OptionAria) => ReactNode;
  trigger: (value?: AuiPrimitive | AuiPrimitive[]) => ReactNode;
};

export type SelectProps = FieldStyles & {
  open?: Bindable<boolean>;
  value?: Bindable<SelectValue>;
  label?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;

  options?: OptionsInput;
  children?: ReactNode | ((instance: SelectAria) => ReactNode);

  onopen?: (event: CustomEvent<boolean>) => void;
  onclose?: (event: CustomEvent<boolean>) => void;
  oninput?: (event: CustomEvent<string | undefined>) => void;
  onchange?: (event: CustomEvent<string | string[] | undefined>) => void;
};

export type SelectTriggerProps = AuiFieldProps<'button'> & {
  label?: string;
  disabled?: boolean;
  children?: ReactNode | ((trigger: SelectTriggerAria) => ReactNode);
  placeholder?: string;
};

export type SelectPanelProps = AuiProps<'div'> & {
  id?: string;
  children?: ReactNode | ((panel: SelectPanelAria) => ReactNode);
};

export type SelectOptionProps = AuiProps<'div'> & {
  value: string;
  children?: ReactNode | ((option: OptionAria) => ReactNode);
  disabled?: boolean;
};

const SELECT_ROLE = 'select';
const SELECT_PANEL_ROLE = 'select-panel';
const SELECT_OPTION_ROLE = 'option';
const SELECT_TRIGGER_ROLE = 'select-trigger';

const selectStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
  variant: VARIANTS.FILLED,
};

register('select', selectStyles);
register('selectPanel', selectStyles);
register('selectOption', selectStyles);
register('selectTrigger', selectStyles);

const selectScope = createStyleScope<SelectProps>();

export const Select = setup<SelectProps, SelectSlots>((props, slots) => {
  const select = aria(SELECT_ROLE, props as AnyType);

  selectScope.provide(props);

  return () => {
    if (hasEntries(props.options)) {
      return (
        <>
          <SelectTrigger label={props.label} placeholder={props.placeholder}>
            {slots.trigger ? <Slot for={() => slots.trigger?.(select.value)} /> : undefined}
          </SelectTrigger>
          <SelectPanel>
            <For each={() => toOptions(props.options)}>
              {(entry) => (
                <SelectOption value={entry.key}>
                  {(option) => <Slot for={() => slots.option?.(entry, option)}>{entry.label ?? entry.key}</Slot>}
                </SelectOption>
              )}
            </For>
          </SelectPanel>
        </>
      );
    }

    const className = () => $families(AUI_CLASS.SELECT, props as ComponentStyles, auiConfig.select);
    return (
      <div ref={select.ref} {...select.restProps(OMIT_KEYS)} className={className()}>
        {renderDynamic(props.children, select)}
      </div>
    );
  };
}, 'Select');

export const SelectTrigger = setup<SelectTriggerProps>((props) => {
  const styles = selectScope.inherit(props as ComponentStyles);
  const trigger = aria(SELECT_TRIGGER_ROLE, props);
  const className = () => $families([AUI_CLASS.CONTROL, AUI_CLASS.SELECT_TRIGGER], styles, auiConfig.selectTrigger);

  // One line, never wider than the trigger: the first choice, cut with an ellipsis, plus a count of the rest.
  return () => {
    const chosen = chosenLabels(trigger);

    return (
      <button ref={trigger.ref} {...trigger.restProps(OMIT_KEYS)} className={className()}>
        {/* Filled content replaces the whole face; the label stays only as the trigger's name. */}
        {props.label && (
          <span className={AUI_CLASS.SELECT_PLACEHOLDER} data-visually-hidden={props.children ? 'true' : undefined}>
            {props.label}
          </span>
        )}
        {props.children ? (
          <span className={AUI_CLASS.SELECT_VALUE}>{renderDynamic(props.children, trigger)}</span>
        ) : (
          <>
            <span className={AUI_CLASS.SELECT_VALUE}>{chosen[0] ?? props.placeholder}</span>
            {chosen.length > 1 && <span className={AUI_CLASS.SELECT_COUNT}>+{chosen.length - 1}</span>}
          </>
        )}
        <ArrowDown className={AUI_CLASS.SELECT_CARET} aria-hidden="true" />
      </button>
    );
  };
}, 'SelectTrigger');

/**
 * The labels of the current choices, in selection order.
 *
 * @param trigger - The select trigger whose select holds the value and options.
 * @returns One label per chosen option; empty when nothing is chosen.
 */
function chosenLabels(trigger: SelectTriggerAria): string[] {
  const host = trigger.host;
  const value = host?.value as string | string[] | undefined;
  const keys = Array.isArray(value) ? value : value === undefined || value === '' ? [] : [value];
  const labels = host?.labels as OptionsInput | undefined;
  return keys.map((key) => labelOf(labels, String(key))).filter((label): label is string => !!label);
}

function labelOf(labels: OptionsInput | undefined, key: string): string | undefined {
  if (!labels) return undefined;
  if (Array.isArray(labels)) {
    const entry = labels.find((option) => option.key === key);
    return entry ? (entry.label ?? entry.key) : undefined;
  }
  const label = labels[key];
  return label === undefined ? undefined : String(label);
}

export const SelectPanel = setup<SelectPanelProps>((props) => {
  const styles = selectScope.inherit(props);
  const panel = aria(SELECT_PANEL_ROLE, props);
  const shadow = shadowPortal(() => panel.open);
  const className = () => $families([AUI_CLASS.PANEL, AUI_CLASS.SELECT_PANEL], styles, auiConfig.selectPanel);

  return () =>
    shadow(
      <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
        {renderDynamic(props.children, panel)}
      </div>
    );
}, 'SelectPanel');

export const SelectOption = setup<SelectOptionProps>((props) => {
  const styles = selectScope.inherit(props);
  const option = aria(SELECT_OPTION_ROLE, props);
  const className = () => $families([AUI_CLASS.ITEM, AUI_CLASS.SELECT_OPTION], styles, auiConfig.selectOption);

  return () => (
    <div ref={option.ref} {...option.restProps(OMIT_KEYS)} className={className()}>
      {renderDynamic(props.children, option)}
      {option.selected && <CheckIcon />}
    </div>
  );
}, 'SelectOption');
