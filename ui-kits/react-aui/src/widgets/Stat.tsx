import { branded, COLORS, register, SIZES } from '@airlib/aui/utils';
import { Show, setup, template } from '@airlib/react';
import type { ReactNode } from 'react';
import { $class, $families, type AuiProps, auiConfig } from '../config.js';
import { ArrowDown, ArrowUp } from '../icons/index.js';

/** Which way a number moved since it was last looked at. */
export type StatTrend = 'up' | 'down' | 'flat';

export type StatProps = Omit<AuiProps<'div'>, 'variant' | 'children'> & {
  /** What the number counts, e.g. "Unread". */
  label: string;
  /** The number itself, as it should read: `12`, `3.4k`, `98%`. */
  value: string | number;
  /** How much it moved, as it should read, e.g. "+4". */
  change?: string;
  /** Which way it moved, which colors the change. */
  trend?: StatTrend;
  /** What the change is measured against, e.g. "since yesterday". */
  caption?: string;
};

export type StatGroupProps = Omit<AuiProps<'div'>, 'variant' | 'size' | 'color'> & {
  /** Names the group for screen readers, e.g. "This week". */
  label?: string;
  children?: ReactNode;
};

const CLASS = {
  STAT: branded('stat'),
  GROUP: branded('stat-group'),
  LABEL: branded('stat-label'),
  VALUE: branded('stat-value'),
  TREND: branded('stat-trend'),
  CHANGE: branded('stat-change'),
  CAPTION: branded('stat-caption'),
};

const OMIT: Array<keyof StatProps> = ['label', 'value', 'change', 'trend', 'caption', 'className', 'size', 'color'];
const GROUP_OMIT: Array<keyof StatGroupProps> = ['label', 'className'];

register('stat', { size: SIZES.MD, color: COLORS.PRIMARY });

/**
 * A number at a glance: what it counts, the number, and how it moved — "12
 * unread, +4 since yesterday". The change sits in a pill colored by its trend,
 * with the caption it's measured against beside it. Both are read out as
 * written, so the change's wording carries the direction; the arrow and color
 * repeat it for the eye.
 */
export const Stat = setup<StatProps>((props) => {
  const className = () => $families(CLASS.STAT, props, auiConfig.stat);

  return () => (
    <div {...props.$omit(OMIT)} className={className()}>
      <span className={CLASS.LABEL}>{props.label}</span>
      <span className={CLASS.VALUE}>{props.value}</span>
      <Show when={() => props.change || props.caption}>
        {() => (
          <span className={CLASS.TREND}>
            <Show when={() => props.change}>
              {(change) => (
                <span className={CLASS.CHANGE} data-trend={props.trend ?? 'flat'}>
                  {props.trend === 'up' && <ArrowUp aria-hidden="true" />}
                  {props.trend === 'down' && <ArrowDown aria-hidden="true" />}
                  <span>{change}</span>
                </span>
              )}
            </Show>
            <Show when={() => props.caption}>{(caption) => <span className={CLASS.CAPTION}>{caption}</span>}</Show>
          </span>
        )}
      </Show>
    </div>
  );
}, 'Stat');

/**
 * A row of stats read together — a dashboard header, a summary strip. Each
 * stat takes an equal column, set apart from the next by an inset divider.
 */
export const StatGroup = template<StatGroupProps>(
  (props) => (
    <div
      {...props.$omit(GROUP_OMIT)}
      role="group"
      aria-label={props.label}
      className={$class(props, CLASS.GROUP)}
    />
  ),
  'StatGroup'
);
