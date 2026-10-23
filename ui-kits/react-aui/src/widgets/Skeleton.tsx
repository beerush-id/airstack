import { AUI_CLASS, branded, register, SIZES } from '@airlib/aui/utils';
import { template } from '@airlib/react';
import type { ComponentProps } from 'react';
import { $families, auiConfig, type ComponentStyles } from '../config.js';

export type SkeletonShape = 'text' | 'circle' | 'rect';

export type SkeletonProps = Omit<ComponentProps<'span'>, 'className' | 'color'> &
  Pick<ComponentStyles, 'size' | 'className'> & {
    shape?: SkeletonShape;
    lines?: number;
  };

const SKELETON_CLASS = branded('skeleton');
const SKELETON_LINE = branded('skeleton-line');

register('skeleton', { size: SIZES.MD });

/**
 * A placeholder shaped like the content that is still loading. `text` draws
 * `lines` bars (the last one shorter), `circle` an avatar-sized disc, and
 * `rect` a block you size yourself. It is hidden from assistive tech: mark
 * the loading region itself busy so screen readers wait for the real content.
 */
export const Skeleton = template<SkeletonProps>((props) => {
  const shape = props.shape ?? 'text';
  const lines = props.lines ?? 1;
  const rest = props.$omit(['shape', 'lines', 'size', 'className']);
  const classes = $families(
    [SKELETON_CLASS, AUI_CLASS.SCALE],
    { size: props.size, className: props.className },
    auiConfig.skeleton
  );

  if (shape !== 'text' || lines <= 1) {
    return <span {...rest} data-shape={shape} aria-hidden="true" className={classes} />;
  }

  return (
    <span {...rest} data-shape="lines" aria-hidden="true" className={classes}>
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className={SKELETON_LINE} />
      ))}
    </span>
  );
}, 'Skeleton');
