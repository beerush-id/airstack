import { AUI_CLASS, branded, COLORS, register, SIZES } from '@airlib/aui/utils';
import { setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiProps, auiConfig } from '../config.js';

export type EmptyStateHeadingLevel = 2 | 3 | 4 | 5 | 6;

export type EmptyStateSlots = {
  icon: () => ReactNode;
  action: () => ReactNode;
};

export type EmptyStateProps = Omit<AuiProps<'div'>, 'title' | 'variant'> & {
  title?: string;
  description?: string;
  level?: EmptyStateHeadingLevel;
  children?: ReactNode;
};

const EMPTY_CLASS = {
  ROOT: branded('empty-state'),
  ICON: branded('empty-state-icon'),
  TITLE: branded('empty-state-title'),
  DESCRIPTION: branded('empty-state-description'),
  ACTION: branded('empty-state-action'),
};

const EMPTY_OMIT: Array<keyof EmptyStateProps> = ['title', 'description', 'level', 'children', 'className', 'size', 'color'];

register('emptyState', { size: SIZES.MD, color: COLORS.PRIMARY });

/**
 * The placeholder for a list, search, or inbox with nothing in it yet: an
 * icon, a heading, one line on why it is empty, and the action that fills it.
 * Children render between the description and the action.
 */
export const EmptyState = setup<EmptyStateProps, EmptyStateSlots>((props, slots) => {
  const className = () =>
    $families([EMPTY_CLASS.ROOT, AUI_CLASS.SCALE], props, auiConfig.emptyState);

  return () => {
    const Heading = `h${props.level ?? 3}` as 'h3';
    return (
      <div {...props.$omit(EMPTY_OMIT)} className={className()}>
        {slots.icon && (
          <span className={EMPTY_CLASS.ICON} aria-hidden="true">
            {slots.icon()}
          </span>
        )}
        {props.title && <Heading className={EMPTY_CLASS.TITLE}>{props.title}</Heading>}
        {props.description && <p className={EMPTY_CLASS.DESCRIPTION}>{props.description}</p>}
        {props.children}
        {slots.action && <div className={EMPTY_CLASS.ACTION}>{slots.action()}</div>}
      </div>
    );
  };
}, 'EmptyState');
