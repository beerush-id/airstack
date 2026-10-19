import { type AnyType, type ClassInput, classx, isObjectLike } from '@airlib/core';

/**
 * @airlib/material utils — framework-agnostic presentation vocabulary.
 */

export const SIZES = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
  XXL: 'xxl',
} as const;

export const COLORS = {
  INFO: 'info',
  ERROR: 'error',
  SUCCESS: 'success',
  WARNING: 'warning',
  PRIMARY: 'primary',
  TERTIARY: 'tertiary',
  SECONDARY: 'secondary',
} as const;

export const VARIANTS = {
  TEXT: 'text',
  TONAL: 'tonal',
  FILLED: 'filled',
  ELEVATED: 'elevated',
  OUTLINED: 'outlined',
} as const;

export type Size = (typeof SIZES)[keyof typeof SIZES];
export type Color = (typeof COLORS)[keyof typeof COLORS];
export type Variant = (typeof VARIANTS)[keyof typeof VARIANTS];

/** Fallback values only — explicit props always win. No mode flags here. */
export interface ComponentStyles {
  size?: Size;
  color?: Color;
  variant?: Variant;
  className?: ClassInput;
}

export const SIZE_MAP: Record<Size, string> = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  xxl: 'xxl',
};
export const SIZE_LABELS = {
  xs: 'Extra Small',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra Large',
  xxl: 'Double Extra Large',
};

export const VARIANT_MAP: Record<Variant, string> = {
  text: 'text',
  tonal: 'tonal',
  filled: 'filled',
  elevated: 'elevated',
  outlined: 'outlined',
};
export const VARIANT_LABELS = {
  text: 'Text',
  tonal: 'Tonal',
  filled: 'Filled',
  elevated: 'Elevated',
  outlined: 'Outlined',
};

export const COLOR_MAP: Record<Color, string> = {
  info: 'info',
  error: 'error',
  success: 'success',
  warning: 'warning',
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
};

export const COLOR_LABELS = {
  info: 'Info',
  error: 'Error',
  success: 'Success',
  warning: 'Warning',
  primary: 'Primary',
  secondary: 'Secondary',
  tertiary: 'Tertiary',
};

const DEFAULT_CONFIG = {
  brand: 'aui',
  sizeMap: SIZE_MAP,
  colorMap: COLOR_MAP,
  overrides: false,
  variantMap: VARIANT_MAP,
};

/** Global Maui configuration. Mutated in place by `configure()`. */
export const auiConfig: MauiConfig = { ...DEFAULT_CONFIG };

export function resolveSize(role: string, size?: Size, fallback?: Size): string | undefined {
  const key = size ?? fallback;
  if (!key || !auiConfig.sizeMap?.[key]) return;
  return branded(`${role}-${key}`);
}

export function resolveVariant(role: string, variant?: Variant, fallback?: Variant): string | undefined {
  const key = variant ?? fallback;
  if (!key || !auiConfig.variantMap?.[key]) return;
  return branded(`${role}-${key}`);
}

export function resolveColor(role: string, color?: Color, fallback?: Color): string | undefined {
  const key = color ?? fallback;
  if (!key || !auiConfig.colorMap?.[key]) return;
  return branded(`${role}-${key}`);
}

export function branded(name: string) {
  return `${auiConfig.brand}-${name}`;
}

/**
 * Update the global Maui configuration.
 * React is only a renderer: no provider, no context, no React imports here.
 */
export function configure(input: Partial<MauiConfig>): MauiConfig {
  for (const [key, value] of Object.entries(input)) {
    if (isObjectLike(value)) {
      if (!isObjectLike((auiConfig as AnyType)[key])) {
        (auiConfig as AnyType)[key] = value;
      } else {
        Object.assign((auiConfig as AnyType)[key], value);
      }
    } else {
      (auiConfig as AnyType)[key] = value;
    }
  }

  return auiConfig;
}

export function resetConfig(): MauiConfig {
  Object.assign(auiConfig, DEFAULT_CONFIG);
  return auiConfig;
}

export function register(key: keyof MauiConfig, styles: ComponentStyles) {
  auiConfig[key as never] = styles as never;
  DEFAULT_CONFIG[key as never] = styles as never;
  return auiConfig;
}

/**
 * Compose the Maui classes for a component.
 *
 * The replacement flag lives in the global config, not in the caller and
 * not in the fallback values: when `auiConfig.overrides === true` only
 * the consumer class is emitted (nothing generated, no restoration when it
 * is absent). Otherwise explicit props resolve over fallback defaults and
 * compose additively with the consumer class.
 */
export function resolveClass(role: string, props: ComponentStyles, defaults?: ComponentStyles): string {
  if (auiConfig.overrides && props.className) {
    return classx(props.className);
  }

  const size = resolveSize(role, props.size, defaults?.size);
  const color = resolveColor(role, props.color, defaults?.color);
  const variant = resolveVariant(role, props.variant, defaults?.variant);

  return classx(defaults?.className, size, variant, color, props.className);
}

export const $class = resolveClass;

/* -- ADDITIONAL DECLARATIONS -- */
/* ----------------------------- */
export type MauiConfig = typeof DEFAULT_CONFIG & {
  button?: ComponentStyles;
  toggle?: ComponentStyles;
  select?: ComponentStyles;
  selectTrigger?: ComponentStyles;
  selectPanel?: ComponentStyles;
  selectOption?: ComponentStyles;
};

export const MAUI_CLASS = {
  ACTION: branded('action'),
  BUTTON: branded('button'),
  TOGGLE: branded('toggle'),
  SELECT: branded('select'),
  SELECT_CARET: branded('select-caret'),
  SELECT_PANEL: branded('select-panel'),
  SELECT_PLACEHOLDER: branded('select-placeholder'),
  SELECT_TRIGGER: branded('select-trigger'),
  SELECT_OPTION: branded('select-option'),
};
