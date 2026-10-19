import { type Color, COLOR_LABELS, type Size, SIZE_LABELS, type Variant, VARIANT_LABELS } from '@airlib/aui/utils';
import { $bind, type Bindable, template } from '@airlib/react';
import { Select, Toggle } from '@airlib/react-aui';
import type { ReactNode } from 'react';

export type DemoControlProps = {
  size: Bindable<Size>;
  color: Bindable<Color>;
  variant: Bindable<Variant>;
  disabled: Bindable<boolean>;
  children?: ReactNode;
};

export const DemoControl = template<DemoControlProps>((props) => (
  <div className="demo-controls">
    <Select label="Size" options={SIZE_LABELS} value={'x'} />
    <Select label="Color" options={COLOR_LABELS} value={$bind(props, 'color')} />
    <Select label="Variant" options={VARIANT_LABELS} value={$bind(props, 'variant')} />
    <Toggle pressed={$bind(props, 'disabled')}>{() => (props.disabled ? 'Set Enabled' : 'Set Disabled')}</Toggle>
    {props.children}
  </div>
));
