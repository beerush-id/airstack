import { aria } from '@airlib/aria';
import { AUI_CLASS } from '@airlib/aui/utils';
import { type AnyType, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type AuiProps, OMIT_KEYS } from '../config.js';
import { toggleGroupScope } from './context.js';

export interface SegmentGroupProps extends Omit<AuiProps<'div'>, 'variant'> {
  /** The object whose keys the members own, live: pressing a member assigns its key. */
  value?: Record<string, AnyType>;
  disabled?: boolean;
  children?: ReactNode;
  onchange?: (event: CustomEvent<Record<string, AnyType>>) => void;
}

const SEGMENT_GROUP_ROLE = 'segment-group';

/**
 * One control over several independent values. Each member owns a key of the group's object:
 * `<Toggle name="fontWeight" value="bold" />` is pressed while `fontWeight` is `bold`, and pressing
 * it assigns or clears that key. It wears a toggle group's track, and takes its keyboard travel.
 */
export const SegmentGroup = setup<SegmentGroupProps>((props) => {
  const group = aria(SEGMENT_GROUP_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.SCALE, AUI_CLASS.TOGGLE_GROUP], props, auiConfig.toggleGroup);

  toggleGroupScope.provide(props);

  return () => (
    <div ref={group.ref} {...group.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'SegmentGroup');
