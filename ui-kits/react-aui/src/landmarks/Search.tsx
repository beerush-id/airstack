import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ClassInput } from '@airlib/react/core';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type SearchProps = Omit<ComponentProps<'div'>, 'className' | 'color'> & {
  className?: ClassInput;
  label?: string;
  labelledby?: string;
  children?: ReactNode;
};

const SEARCH_ROLE = 'search';

register('search', {});

/**
 * The search landmark. It marks the facility as its own destination and names
 * it when a page holds more than one. The query, the submit, and the focus
 * inside stay with the fields you compose.
 */
export const Search = setup<SearchProps>((props) => {
  const search = aria(SEARCH_ROLE, props);
  const className = () => $families(AUI_CLASS.SEARCH, props as ComponentStyles, auiConfig.search);

  return () => (
    <div ref={search.ref} {...search.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
    </div>
  );
}, 'Search');
