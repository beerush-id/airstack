import { branded, COLORS, register, SIZES } from '@airlib/aui/utils';
import { For, setup, uIndex } from '@airlib/react';
import { $families, type AuiProps, auiConfig } from '../config.js';
import { Badge } from './Badge.js';

export type ReadoutValue = string | number;

export type ReadoutProps = Omit<AuiProps<'div'>, 'variant' | 'children'> & {
  /** What the value is, e.g. "Open tab". */
  label: string;
  /** The current value, as it should read; a list shows one badge per entry. */
  value?: ReadoutValue | ReadoutValue[];
  /** What shows while there is no value, e.g. "Nothing yet". */
  empty?: string;
};

const CLASS = {
  READOUT: branded('readout'),
  LABEL: branded('readout-label'),
};

const OMIT: Array<keyof ReadoutProps> = ['label', 'value', 'empty', 'className', 'size', 'color'];
const READOUT_SYMBOL = Symbol('aui-readout');

register('readout', { size: SIZES.SM, color: COLORS.PRIMARY });

/**
 * The current value of something, read out under its label — the chosen
 * plan, the open tab, the filters applied. The value shows as a badge, one per
 * entry for a list, and a quiet badge while there is none. The label names the
 * group, so screen readers hear the value as the label's.
 */
export const Readout = setup<ReadoutProps>((props) => {
  // A counter in render order, the same on the server and in the browser, so the id hydrates.
  const labelId = `aui-readout-${uIndex(READOUT_SYMBOL, true)}`;
  const className = () => $families(CLASS.READOUT, props, auiConfig.readout);
  const values = () => [props.value ?? []].flat().filter((value) => value !== '');
  const size = () => props.size ?? auiConfig.readout?.size;

  return () => (
    <div {...props.$omit(OMIT)} role="group" aria-labelledby={labelId} className={className()}>
      <span id={labelId} className={CLASS.LABEL}>
        {props.label}
      </span>
      {values().length ? (
        <For each={values}>
          {(value) => (
            <Badge variant="tonal" size={size()} color={props.color}>
              {value}
            </Badge>
          )}
        </For>
      ) : (
        <Badge variant="tonal" size={size()} color="secondary">
          {props.empty ?? 'None'}
        </Badge>
      )}
    </div>
  );
}, 'Readout');
