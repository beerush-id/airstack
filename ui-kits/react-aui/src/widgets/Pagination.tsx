import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type Bindable, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type PaginationProps = Omit<ComponentProps<'nav'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'size' | 'variant' | 'color'> & {
    label?: string;
    page?: Bindable<number>;
    total?: number;
    children?: ReactNode;
  };

const PAGINATION_ROLE = 'pagination';

const paginationStyles: ComponentStyles = {};

register('pagination', paginationStyles);

/**
 * Named page run holding position and a single tab stop on the current page.
 * Page links commit the position; previous/next guard the bounds.
 */
export const Pagination = setup<PaginationProps>((props) => {
  const pager = aria(PAGINATION_ROLE, props);
  const className = () => $families(AUI_CLASS.PAGINATION, props, auiConfig.pagination);

  return () => (
    <nav ref={pager.ref} {...pager.restProps([...OMIT_KEYS, 'page', 'total'])} className={className()}>
      {props.children}
    </nav>
  );
}, 'Pagination');
