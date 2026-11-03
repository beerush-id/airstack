import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ClassInput } from '@airlib/react/core';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type FooterProps = Omit<ComponentProps<'footer'>, 'className' | 'color'> & {
  className?: ClassInput;
  label?: string;
  labelledby?: string;
  children?: ReactNode;
};

const FOOTER_ROLE = 'footer';

const footerStyles: ComponentStyles = {};

register('footer', footerStyles);

/**
 * Document footer on a real `<footer>`. The element supplies the
 * contentinfo role itself; naming it keeps it apart when a document
 * carries two. Takes no focus and claims no keys.
 */
export const Footer = setup<FooterProps>((props) => {
  const footer = aria(FOOTER_ROLE, props, { native: true });
  const className = () => $families(AUI_CLASS.FOOTER, props, auiConfig.footer);

  return () => (
    <footer ref={footer.ref} {...footer.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
    </footer>
  );
}, 'Footer');
