import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ClassInput } from '@airlib/react/core';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type HeaderProps = Omit<ComponentProps<'header'>, 'className' | 'color'> & {
  className?: ClassInput;
  label?: string;
  labelledby?: string;
  children?: ReactNode;
};

const HEADER_ROLE = 'header';

const headerStyles: ComponentStyles = {};

register('header', headerStyles);

/**
 * Document header on a real `<header>`. The element supplies the
 * banner role itself; naming it keeps it apart when a page carries
 * two. Takes no focus and claims no keys.
 */
export const Header = setup<HeaderProps>((props) => {
  const header = aria(HEADER_ROLE, props, { native: true });
  const className = () => $families(AUI_CLASS.HEADER, props, auiConfig.header);

  return () => (
    <header ref={header.ref} {...header.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
    </header>
  );
}, 'Header');
