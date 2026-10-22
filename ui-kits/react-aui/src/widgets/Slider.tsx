import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, type Bindable, type ComponentProps, createContext, renderDynamic, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiProps, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { DragHandle } from '../icons/DragHandle.js';

export type SliderValue = number | [number, number];

export interface SliderProps extends Omit<AuiProps<'div'>, 'variant' | 'value'> {
  value?: Bindable<SliderValue>;
  min?: number;
  max?: number;
  step?: number;
  page?: number;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  valuetext?: string | ((val: number) => string);
  children?: ReactNode;
  oninput?: (event: CustomEvent<SliderValue>) => void;
  onchange?: (event: CustomEvent<SliderValue>) => void;
}

export interface SliderThumbProps extends Omit<AuiProps<'div'>, 'variant' | 'value'> {
  children?: ReactNode | ((endpoint: number) => ReactNode);
}

const SLIDER_ROLE = 'slider';
const SLIDER_THUMB_ROLE = 'slider-thumb';

const sliderStyles: ComponentStyles = {
  size: SIZES.SM,
  color: COLORS.PRIMARY,
  className: AUI_CLASS.FOCUSABLE,
};

export const sliderProps = createContext<ComponentProps<ComponentStyles>>();

register('slider', sliderStyles);
register('sliderThumb', sliderStyles);

/**
 * Number you point at. The track owns bounds, stepping, and the
 * value; thumbs claim endpoints in creation order. A single value
 * makes the track the focusable slider, a pair hands the role to
 * each thumb. The thumb publishes its stand as
 * `--aria-slider-thumb-offset` — position it in CSS, never in JS.
 */
export const Slider = setup<SliderProps>((props) => {
  const slider = aria(SLIDER_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.SLIDER, props, auiConfig.slider);

  sliderProps.set(props);

  return () => {
    if (!props.children) {
      return (
        <div ref={slider.ref} {...slider.restProps([...OMIT_KEYS])} className={className()}>
          <SliderThumb />
          {slider.isDual && <SliderThumb />}
        </div>
      );
    }

    return (
      <div ref={slider.ref} {...slider.restProps([...OMIT_KEYS])} className={className()}>
        {renderDynamic(props.children, slider.value)}
      </div>
    );
  };
}, 'Slider');

export const SliderThumb = setup<SliderThumbProps>((props) => {
  const group = sliderProps.get();
  const thumb = aria(SLIDER_THUMB_ROLE, props);
  const className = () =>
    $families(
      AUI_CLASS.SLIDER_THUMB,
      {
        size: props.size ?? group?.size,
        color: props.color ?? group?.color,
        className: props.className,
      },
      auiConfig.sliderThumb
    );

  return () => (
    <div ref={thumb.ref} {...thumb.restProps([...OMIT_KEYS])} className={className()}>
      <DragHandle />
      {renderDynamic(props.children, thumb.endpoint)}
    </div>
  );
}, 'SliderThumb');
