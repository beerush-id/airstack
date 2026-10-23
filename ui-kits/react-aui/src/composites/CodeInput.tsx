import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiProps, auiConfig } from '../config.js';
import { withInputAttributes } from './attributes.js';

export type CodeInputKind = 'numeric' | 'alphanumeric';

export type CodeInputProps = AuiProps<'div'> & {
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

register('codeInput', {});
register('codeInputCell', {});

/**
 * The code as a whole. It holds the one contiguous string and a single tab
 * stop; every cell finds it in scope, so the characters never drift apart.
 */
export const CodeInput = setup<CodeInputProps>((props) => {
  const code = aria(CODE_INPUT_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CODE_INPUT, props, auiConfig.codeInput);

  return () => (
    <div ref={code.ref} {...code.restProps(['children', 'className'])} className={className()}>
      {props.children}
    </div>
  );
}, 'CodeInput');

/**
 * One character slot. It shows the character the group holds at its index and
 * hands every edit back to the group rather than keeping a copy.
 */
export const CodeInputCell = setup<CodeInputCellProps>((props) => {
  const cell = aria(CODE_INPUT_CELL_ROLE, props as AnyType, { native: true });
  const className = () => $families(AUI_CLASS.CODE_INPUT_CELL, props, auiConfig.codeInputCell);

  return () => {
    const { value, ...rest } = cell.restProps(['className']) as Record<string, unknown>;

    return <input ref={cell.ref} {...withInputAttributes({ ...rest, defaultValue: value })} className={className()} />;
  };
}, 'CodeInputCell');
