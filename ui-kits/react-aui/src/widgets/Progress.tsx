import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, setup } from '@airlib/react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type ProgressProps = ComponentStyles & {
  value?: number | null;
  min?: number;
  max?: number;
  label?: string;
  valuetext?: string;
};

const PROGRESS_ROLE = 'progress';

const progressStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
};

register('progress', progressStyles);

/**
 * Task completion inside a declared interval. The host publishes the
 * fraction, the fill reads it, and nothing is focusable.
 */
export const Progress = setup<ProgressProps>((props) => {
  const progress = aria(PROGRESS_ROLE, props as AnyType, { native: false });
  const className = () => $families(AUI_CLASS.PROGRESS, props, auiConfig.progress);

  return () => (
    <div ref={progress.ref} {...progress.restProps(OMIT_KEYS)} className={className()}>
      <span className={AUI_CLASS.PROGRESS_FILL} />
    </div>
  );
}, 'Progress');
