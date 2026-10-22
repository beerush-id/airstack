import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type NavigationProps = Omit<ComponentProps<'nav'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'size' | 'variant' | 'color'> & {
    label?: string;
    labelledby?: string;
    children?: ReactNode;
  };

const NAVIGATION_ROLE = 'navigation';

const navigationStyles: ComponentStyles = {};

register('navigation', navigationStyles);

/**
 * Named landmark holding one tab stop across its links.
 * Arrows travel vertically and wrap; activation stays with the links.
 */
export const Navigation = setup<NavigationProps>((props) => {
  const nav = aria(NAVIGATION_ROLE, props);
  const className = () => $families(AUI_CLASS.NAVIGATION, props, auiConfig.navigation);

  return () => (
    <nav ref={nav.ref} {...nav.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
    </nav>
  );
}, 'Navigation');
