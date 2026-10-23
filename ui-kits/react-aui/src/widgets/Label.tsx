import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $class, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type LabelProps = Omit<ComponentProps<'label'>, 'className' | 'color'> &
  Pick<ComponentStyles, 'className'> & {
    label?: string;
    children?: ReactNode;
  };

const LABEL_ROLE = 'label';

register('label', {});

/**
 * Names the control it wraps, the way a native `<label>` does: it shows `label` beside the
 * control, the control takes it as its name, and a click anywhere on the label activates it.
 */
export const Label = setup<LabelProps>((props) => {
  const label = aria(LABEL_ROLE, props as never);

  return () => (
    <label ref={label.ref} {...label.restProps(OMIT_KEYS as never)} className={$class(props, AUI_CLASS.LABEL)}>
      {props.children}
      {props.label && <span className={AUI_CLASS.LABEL_TEXT}>{props.label}</span>}
    </label>
  );
}, 'Label');
