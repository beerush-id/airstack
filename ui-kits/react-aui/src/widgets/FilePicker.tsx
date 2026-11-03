import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type Bindable, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
export type FilePickerProps = Omit<ComponentProps<'button'>, 'type' | 'disabled' | 'size' | 'className'> &
  ComponentStyles & {
    accept?: string;
    multiple?: boolean;
    capture?: 'user' | 'environment';
    disabled?: boolean | Bindable<boolean>;
    children?: ReactNode;
    onchange?: (event: CustomEvent<File[]>) => void;
    oncancel?: (event: CustomEvent<void>) => void;
  };

const FILE_PICKER_ROLE = 'file-picker';

const FILE_PICKER_OMIT_KEYS = [...OMIT_KEYS, 'accept', 'multiple', 'capture', 'onchange', 'oncancel'] as const;

const filePickerStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
  variant: VARIANTS.FILLED,
};

register('filePicker', filePickerStyles);

/**
 * File trigger on a real `<button>`. Bridges activation to a hidden
 * native input the controller creates, keeps `accept`/`multiple`/
 * `capture` in sync with it, and reports chosen files (`change`) or a
 * dismissal (`cancel`). Never submits the surrounding form.
 */
export const FilePicker = setup<FilePickerProps>((props) => {
  const picker = aria(FILE_PICKER_ROLE, props);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.FILE_PICKER], props, auiConfig.filePicker);

  return () => (
    <button ref={picker.ref} {...picker.restProps([...FILE_PICKER_OMIT_KEYS])} className={className()}>
      {props.children}
    </button>
  );
}, 'FilePicker');
