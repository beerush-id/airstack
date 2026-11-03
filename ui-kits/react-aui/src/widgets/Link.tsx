import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ComponentProps } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type LinkProps = ComponentProps<'a'> &
  Omit<ComponentStyles, 'size' | 'variant'> & {
    disabled?: boolean;
    current?: boolean;
    page?: number;
  };

const LINK_ROLE = 'link';
const LINK_OMIT_KEYS = [...OMIT_KEYS, 'current', 'page'] as const;

const linkStyles: ComponentStyles = {
  color: COLORS.PRIMARY,
};

register('link', linkStyles);

/**
 * Anchor that navigates to its destination. A native anchor keeps the
 * browser's own activation; disabling keeps the `href` on the element,
 * cancels the click, and announces `aria-disabled`.
 */
export const Link = setup<LinkProps>((props) => {
  const link = aria(LINK_ROLE, props);
  const className = () => $families(AUI_CLASS.LINK, props, auiConfig.link);

  return () => (
    <a ref={link.ref} {...link.restProps([...LINK_OMIT_KEYS])} className={className()}>
      {props.children}
    </a>
  );
}, 'Link');
