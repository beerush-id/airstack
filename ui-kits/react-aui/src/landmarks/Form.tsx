import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ClassInput } from '@airlib/react/core';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type FormProps = Omit<ComponentProps<'form'>, 'className' | 'color'> & {
  className?: ClassInput;
  label?: string;
  labelledby?: string;
  children?: ReactNode;
};

const FORM_ROLE = 'form';

const formStyles: ComponentStyles = {};

register('form', formStyles);

/**
 * Named form landmark on a real `<form>`. Compiles `role="form"` only
 * while `label` or `labelledby` names it; unnamed it stays a plain
 * container. Never touches submission — wiring stays yours.
 */
export const Form = setup<FormProps>((props) => {
  const form = aria(FORM_ROLE, props);
  const className = () => $families(AUI_CLASS.FORM, props, auiConfig.form);

  return () => (
    <form ref={form.ref} {...form.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
    </form>
  );
}, 'Form');
