import { branded, register } from '@airlib/aui/utils';
import { classx, template } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles } from '../config.js';

export type BadgeVariant = 'filled' | 'tonal';
export type BadgePosition = 'top-end' | 'bottom-end';

export type BadgeProps = Omit<ComponentProps<'span'>, 'color' | 'className'> &
  Omit<ComponentStyles, 'variant'> & {
    variant?: BadgeVariant;
    /** A number pinned to the element the badge sits in; above `max` it reads `max+`. */
    count?: number;
    /** Ceiling for `count` before it collapses to `max+`. */
    max?: number;
    /** A small dot pinned to the element the badge sits in, instead of a number. */
    dot?: boolean;
    /** Keep a `count` of 0 visible instead of hiding the indicator. */
    showZero?: boolean;
    /** Where the indicator sits on the element. */
    position?: BadgePosition;
    /** What the indicator means for screen readers, e.g. "3 unread messages". */
    label?: string;
    children?: ReactNode;
  };

const BADGE = branded('badge');
const BADGE_INDICATOR = branded('badge-indicator');
const BADGE_DOT = branded('badge-dot');
const BADGE_LABEL = branded('badge-label');
const SCALE = branded('scale');

const DEFAULT_MAX = 99;
const OWN_KEYS: Array<keyof BadgeProps> = [
  'count',
  'max',
  'dot',
  'showZero',
  'position',
  'label',
  'size',
  'color',
  'variant',
  'className',
  'children',
];

register('badge', { size: 'md', color: 'primary', variant: 'filled' });

/**
 * A short label or a count. Without `count` or `dot` it is a standalone
 * label pill around its children ("New", "Beta"). With `count` or `dot` it
 * goes inside the element it marks — an avatar, an icon button — and pins
 * itself to that element's corner, sized from it unless given its own `size`.
 */
export const Badge = template<BadgeProps>((props) => {
  const attached = props.count !== undefined || props.dot;

  if (!attached) {
    const className = $families([SCALE, BADGE], props as ComponentStyles, auiConfig.badge);
    return (
      <span {...props.$omit(OWN_KEYS)} className={className}>
        {props.children}
      </span>
    );
  }

  const count = props.count ?? 0;
  const max = props.max ?? DEFAULT_MAX;

  if (!props.dot && count <= 0 && !props.showZero) return null;

  // Without its own size the indicator takes the scale of the element it marks.
  const className = classx(
    $families([SCALE, BADGE], props as ComponentStyles, { ...auiConfig.badge, size: undefined }),
    BADGE_INDICATOR,
    props.dot && BADGE_DOT
  );

  return (
    <span {...props.$omit(OWN_KEYS)} className={className} data-position={props.position ?? 'top-end'}>
      {/* The label speaks for the number; a bare dot without one is decoration. */}
      {!props.dot && (
        <span aria-hidden={props.label ? 'true' : undefined}>{count > max ? `${max}+` : String(count)}</span>
      )}
      {props.label && <span className={BADGE_LABEL}>{props.label}</span>}
    </span>
  );
}, 'Badge');
