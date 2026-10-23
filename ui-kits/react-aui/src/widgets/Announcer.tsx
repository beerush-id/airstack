import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type AnnouncerProps = ComponentStyles & {
  politeness?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  busy?: boolean;
  relevant?: string;
  children?: ReactNode;
};

const ANNOUNCER_ROLE = 'announcer';

register('announcer', {});

/**
 * Live region for messages that have no visible surface. It stays out of
 * the layout and the tab order; writing its children writes the message.
 */
export const Announcer = setup<AnnouncerProps>((props) => {
  const announcer = aria(ANNOUNCER_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.ANNOUNCER, props, auiConfig.announcer);

  return () => (
    <div ref={announcer.ref} {...announcer.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'Announcer');
