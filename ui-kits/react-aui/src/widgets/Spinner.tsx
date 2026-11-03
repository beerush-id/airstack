import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, setup } from '@airlib/react';
import { $families, type AuiProps, auiConfig, OMIT_KEYS } from '../config.js';

export type SpinnerProps = Omit<AuiProps<'div'>, 'variant'> & {
  label: string;
};

const SPINNER_CLASS = branded('spinner');
const PROGRESS_ROLE = 'progress';

register('spinner', { size: SIZES.MD, color: COLORS.PRIMARY });

/**
 * Something is happening and you can't say how long it takes. Announces as
 * a progress indicator with no reading, named by `label` — say what is
 * loading ("Loading invoices"). For work with a known amount, use Progress.
 */
export const Spinner = setup<SpinnerProps>((props) => {
  const spinner = aria(PROGRESS_ROLE, props as AnyType, { native: false });
  const className = () => $families([SPINNER_CLASS, AUI_CLASS.SCALE], props, auiConfig.spinner);

  return () => (
    <div ref={spinner.ref} {...spinner.restProps(OMIT_KEYS)} className={className()}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" />
      </svg>
    </div>
  );
}, 'Spinner');
