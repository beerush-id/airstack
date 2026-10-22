import { classx, stylex } from '@airlib/react';
import type { FC, ReactNode, SVGAttributes } from 'react';
import { auiConfig, branded } from '../config.js';

export interface IconProps extends Omit<SVGAttributes<SVGElement>, 'width' | 'height'> {
  size?: number;
}

export function createIcon(content: (() => ReactNode) | ReactNode, name?: string, viewBox = '0 -960 960 960') {
  if (typeof content === 'function') {
    const IconFactory: FC<IconProps> = ({ className, size, fill, style, ...restProps }) => (
      <svg
        {...restProps}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        fill={fill ?? auiConfig.icon.fill ?? 'currentColor'}
        className={classx([className, auiConfig.icon.className])}
        style={stylex({
          [`--${branded('icon-size')}`]: size,
          ...style,
        })}
      >
        {content()}
      </svg>
    );
    IconFactory.displayName = name ? `${name}Icon` : 'Icon';
    return IconFactory;
  }

  const Icon: FC<IconProps> = ({ className, size, fill, style, ...restProps }) => (
    <svg
      {...restProps}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill={fill ?? auiConfig.icon.fill ?? 'currentColor'}
      className={classx([className, auiConfig.icon.className])}
      style={stylex({
        [`--${branded('icon-size')}`]: size,
        ...style,
      })}
    >
      {content}
    </svg>
  );
  Icon.displayName = name ? `${name}Icon` : 'Icon';
  return Icon;
}
