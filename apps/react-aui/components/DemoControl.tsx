import { type Color, COLOR_LABELS, type Size, SIZE_LABELS, type Variant, VARIANT_LABELS } from '@airlib/aui/utils';
import { $bind, type Bindable, template } from '@airlib/react';
import { Select, Toggle } from '@airlib/react-aui';
import type { ReactNode } from 'react';

export type DemoControlProps = {
  size: Bindable<Size>;
  color: Bindable<Color>;
  variant?: Bindable<Variant>;
  disabled: Bindable<boolean>;
  children?: ReactNode;
};

export const DemoControl = template<DemoControlProps>(
  (props) => (
    <div className="flex gap-xs w-full">
      <Select size="sm" placeholder="Size" options={SIZE_LABELS} value={$bind(props, 'size')} />
      <Select size="sm" placeholder="Color" options={COLOR_LABELS} value={$bind(props, 'color')} />
      {props.variant && <Select size="sm" placeholder="Variant" options={VARIANT_LABELS} value={$bind(props, 'variant')} />}
      <div className="flex-1"></div>
      <Toggle size="sm" pressed={$bind(props, 'disabled')}>
        {() => (props.disabled ? 'Set Enabled' : 'Set Disabled')}
      </Toggle>
      {props.children}
    </div>
  ),
  'DemoControl'
);
