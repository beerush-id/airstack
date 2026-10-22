import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ClassInput } from '@airlib/react/core';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type MainProps = Omit<ComponentProps<'main'>, 'className' | 'color'> & {
  className?: ClassInput;
  label?: string;
  labelledby?: string;
  children?: ReactNode;
};

const MAIN_ROLE = 'main';

const mainStyles: ComponentStyles = {};

register('main', mainStyles);

/**
 * Primary content on a real `<main>`. The element supplies its own
 * role; the name is compiled only while set. Takes no tab stop and
 * claims no keys — point the skip link at its `id`.
 */
export const Main = setup<MainProps>((props) => {
  const main = aria(MAIN_ROLE, props, { native: true });
  const className = () => $families(AUI_CLASS.MAIN, props, auiConfig.main);

  return () => (
    <main ref={main.ref} {...main.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
    </main>
  );
}, 'Main');
