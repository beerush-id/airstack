import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiFieldProps, type AuiProps, auiConfig, FIELD_STYLES } from '../config.js';
import { createStyleScope } from '../utils/common.js';
import { withInputAttributes } from './attributes.js';

export type CodeInputKind = 'numeric' | 'alphanumeric';

export type CodeInputProps = AuiFieldProps<'div'> & {
  value?: Bindable<string>;
  length?: number;
  kind?: CodeInputKind;
  label?: string;
  disabled?: boolean;
  readonly?: boolean;
  children?: ReactNode;
  oninput?: (event: CustomEvent<string>) => void;
  onchange?: (event: CustomEvent<string>) => void;
  oncomplete?: (event: CustomEvent<string>) => void;
};

export type CodeInputCellProps = AuiProps<'input'> & {
  index: number;
};

const CODE_INPUT_ROLE = 'code-input';
const CODE_INPUT_CELL_ROLE = 'code-input-cell';
const DEFAULT_LENGTH = 6;
const STYLE_KEYS = ['size', 'color', 'variant'];

register('codeInput', {});
register('codeInputCell', { ...FIELD_STYLES });

const codeInputScope = createStyleScope();

/**
 * The code as a whole. It holds the one contiguous string and a single tab
 * stop; every cell finds it in scope, so the characters never drift apart.
 * Without children it renders `length` cells (6 by default); its size,
 * color, and variant reach every cell.
 */
export const CodeInput = setup<CodeInputProps>((props) => {
  const code = aria(CODE_INPUT_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CODE_INPUT, { className: props.className }, auiConfig.codeInput);

  codeInputScope.provide(props);

  return () => (
    <div ref={code.ref} {...code.restProps(['children', 'className', ...STYLE_KEYS])} className={className()}>
      {props.children ?? (
        <For each={() => Array.from({ length: props.length ?? DEFAULT_LENGTH }, (_, index) => index)}>
          {(index) => <CodeInputCell index={index} />}
        </For>
      )}
    </div>
  );
}, 'CodeInput');

/**
 * One character slot. It shows the character the group holds at its index and
 * hands every edit back to the group rather than keeping a copy.
 */
export const CodeInputCell = setup<CodeInputCellProps>((props) => {
  const styles = codeInputScope.inherit(props);
  const cell = aria(CODE_INPUT_CELL_ROLE, props as AnyType, { native: true });
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, AUI_CLASS.CODE_INPUT_CELL], styles, auiConfig.codeInputCell);

  return () => {
    const { value, ...rest } = cell.restProps(['className', ...STYLE_KEYS]) as Record<string, unknown>;

    return <input ref={cell.ref} {...withInputAttributes({ ...rest, defaultValue: value })} className={className()} />;
  };
}, 'CodeInputCell');
