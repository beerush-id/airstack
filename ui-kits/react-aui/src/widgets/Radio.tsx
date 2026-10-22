import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type Bindable, renderDynamic, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiPrimitive, type AuiProps, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { radioGroupProps } from './RadioGroup.js';

export type RadioValue = AuiPrimitive;

export interface RadioProps extends Omit<AuiProps<'input'>, 'variant' | 'type' | 'value'> {
  checked?: Bindable<boolean>;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean | 'grammar' | 'spelling';
  name?: string;
  value?: RadioValue;
  children?: ReactNode | ((checked?: boolean) => ReactNode);
  onchange?: (event: CustomEvent<boolean | RadioValue>) => void;
}

const RADIO_ROLE = 'radio';

const radioStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
};

register('radio', radioStyles);

/**
 * One answer out of several. A native input wrapped in a label,
 * so the name text marks the option and the control joins forms;
 * the controller drives checked and disabled on the input itself.
 * Select-only: re-activating the holder commits nothing.
 */
export const Radio = setup<RadioProps>((props) => {
  const group = radioGroupProps.get();
  const radio = aria(RADIO_ROLE, props);
  const className = () =>
    $families(
      AUI_CLASS.RADIO_BOX,
      {
        size: props.size ?? group?.size,
        color: props.color ?? group?.color,
        className: props.className,
      },
      auiConfig.radio
    );

  return () => (
    <label className={AUI_CLASS.RADIO}>
      <input
        ref={radio.ref}
        {...radio.restProps([...OMIT_KEYS])}
        type="radio"
        name={props.name ?? group?.name}
        value={props.value}
        className={className()}
      />
      <span className={AUI_CLASS.RADIO_LABEL}>{renderDynamic(props.children, radio.checked)}</span>
    </label>
  );
}, 'Radio');
