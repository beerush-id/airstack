import { classx, template } from '@airlib/react';

export type LogoProps = {
  className?: string;
};

/**
 * The AUI mark: a press rippling across a glass surface held in its frame. Painted from the
 * theme's primary tokens, so it follows the seed color and the light or dark scheme.
 *
 * @param props.className - Extra classes, such as a size for where it sits.
 */
export const Logo = template<LogoProps>(
  (props) => (
    <svg viewBox="0 0 140 140" aria-hidden="true" className={classx(['brand-logo', props.className])}>
      <rect className="brand-logo-frame" width="140" height="140" rx="40" />
      <rect className="brand-logo-surface" x="14" y="14" width="112" height="112" rx="26" />
      <circle className="brand-logo-ripple" cx="56" cy="84" r="32" opacity="0.16" />
      <circle className="brand-logo-ripple" cx="56" cy="84" r="19" opacity="0.3" />
      <circle className="brand-logo-ripple" cx="56" cy="84" r="7.5" />
    </svg>
  ),
  'Logo'
);
