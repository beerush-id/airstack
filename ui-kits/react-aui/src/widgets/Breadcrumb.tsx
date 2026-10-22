import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type BreadcrumbProps = Omit<ComponentProps<'nav'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'size' | 'variant' | 'color'> & {
    label?: string;
    children?: ReactNode;
  };

export type BreadcrumbSeparatorProps = Omit<ComponentProps<'span'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'size' | 'variant' | 'color'> & {
    children?: ReactNode;
  };

const BREADCRUMB_ROLE = 'breadcrumb';
const BREADCRUMB_SEPARATOR_ROLE = 'breadcrumb-separator';

const breadcrumbStyles: ComponentStyles = {};
const breadcrumbSeparatorStyles: ComponentStyles = {};

register('breadcrumb', breadcrumbStyles);
register('breadcrumbSeparator', breadcrumbSeparatorStyles);

/**
 * Trail of ancestor links holding one tab stop on the current crumb.
 * Arrows travel horizontally and wrap; separators are decorative only.
 */
export const Breadcrumb = setup<BreadcrumbProps>((props) => {
  const trail = aria(BREADCRUMB_ROLE, props);
  const className = () => $families(AUI_CLASS.BREADCRUMB, props, auiConfig.breadcrumb);

  return () => (
    <nav ref={trail.ref} {...trail.restProps([...OMIT_KEYS])} className={className()}>
      {props.children}
    </nav>
  );
}, 'Breadcrumb');

/**
 * Decorative delimiter between crumbs. Seen, never announced.
 */
export const BreadcrumbSeparator = setup<BreadcrumbSeparatorProps>((props) => {
  const separator = aria(BREADCRUMB_SEPARATOR_ROLE, props);
  const className = () => $families(AUI_CLASS.BREADCRUMB_SEPARATOR, props, auiConfig.breadcrumbSeparator);

  return () => (
    <span ref={separator.ref} {...separator.restProps([...OMIT_KEYS])} className={className()}>
      {props.children ?? '/'}
    </span>
  );
}, 'BreadcrumbSeparator');
