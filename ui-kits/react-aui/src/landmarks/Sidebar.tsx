import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ClassInput } from '@airlib/react/core';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type SidebarProps = Omit<ComponentProps<'aside'>, 'className' | 'color'> & {
  className?: ClassInput;
  label?: string;
  labelledby?: string;
  children?: ReactNode;
};

const SIDEBAR_ROLE = 'sidebar';

const sidebarStyles: ComponentStyles = {};

register('sidebar', sidebarStyles);

/**
 * Supporting content beside main on a real `<aside>`. The element
 * supplies the complementary role itself; naming it keeps it apart
 * when a page carries two. Takes no tab stop and owns nothing
 * inside.
 */
export const Sidebar = setup<SidebarProps>((props) => {
  const sidebar = aria(SIDEBAR_ROLE, props, { native: true });
  const className = () => $families(AUI_CLASS.SIDEBAR, props, auiConfig.sidebar);

  return () => (
    <aside ref={sidebar.ref} {...sidebar.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
    </aside>
  );
}, 'Sidebar');
