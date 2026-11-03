import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, setup } from '@airlib/react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type MeterProps = ComponentStyles & {
  value?: number;
  min?: number;
  max?: number;
  label: string;
  valuetext?: string;
};

const METER_ROLE = 'meter';

const meterStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
};

register('meter', meterStyles);

/**
 * Gauge reporting a reading inside its declared bounds, in the units the
 * reading already uses. It has no completion semantics and no input.
 */
export const Meter = setup<MeterProps>((props) => {
  const meter = aria(METER_ROLE, props as AnyType, { native: false });
  const className = () => $families(AUI_CLASS.METER, props, auiConfig.meter);

  return () => (
    <div ref={meter.ref} {...meter.restProps(OMIT_KEYS)} className={className()}>
      <span className={AUI_CLASS.METER_FILL} />
    </div>
  );
}, 'Meter');
