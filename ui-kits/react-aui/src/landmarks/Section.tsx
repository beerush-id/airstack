import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ClassInput } from '@airlib/react/core';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type SectionProps = Omit<ComponentProps<'section'>, 'className' | 'color'> & {
  className?: ClassInput;
  label?: string;
  labelledby?: string;
  children?: ReactNode;
};

const SECTION_ROLE = 'section';

const sectionStyles: ComponentStyles = {};

register('section', sectionStyles);

/**
 * Named page region on a real `<section>`. The region role is
 * published only while the section carries a name and withdraws
 * when the name is cleared. Takes no tab stop and claims no keys.
 */
export const Section = setup<SectionProps>((props) => {
  const section = aria(SECTION_ROLE, props);
  const className = () => $families(AUI_CLASS.SECTION, props, auiConfig.section);

  return () => (
    <section ref={section.ref} {...section.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
    </section>
  );
}, 'Section');
