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
  /** A frosted pane over what's behind: for a control floating over other content. */
  GLASS: 'glass',
} as const;

/** The surfaces a field can wear: press-only variants (`text`, `elevated`) have no boundary to type into. */
export const FIELD_VARIANTS = {
  TONAL: VARIANTS.TONAL,
  FILLED: VARIANTS.FILLED,
  OUTLINED: VARIANTS.OUTLINED,
} as const;

export type Size = (typeof SIZES)[keyof typeof SIZES];
export type Color = (typeof COLORS)[keyof typeof COLORS];
export type Variant = (typeof VARIANTS)[keyof typeof VARIANTS];
export type FieldVariant = (typeof FIELD_VARIANTS)[keyof typeof FIELD_VARIANTS];

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
  glass: 'glass',
};
export const VARIANT_LABELS: Record<Variant, string> = {
  text: 'Text',
  tonal: 'Tonal',
  filled: 'Filled',
  elevated: 'Elevated',
  outlined: 'Outlined',
  glass: 'Glass',
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

export const ICON_CONFIGS = {
  fill: 'currentColor',
  className: 'aui-icon',
};

export const ICON_SIZE = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
  icon: 256,
  thumbnail: 128,
};

const DEFAULT_CONFIG = {
  icon: ICON_CONFIGS,
  brand: 'aui',
  sizeMap: SIZE_MAP,
  colorMap: COLOR_MAP,
  iconSize: ICON_SIZE,
  overrides: false,
  variantMap: VARIANT_MAP,
};

/** Global Maui configuration. Mutated in place by `configure()`. */
export const auiConfig: MauiConfig = { ...DEFAULT_CONFIG };

export function resolveSize(role: string, size?: Size, fallback?: Size): string | undefined {
  const key = size ?? fallback;
  if (!key || !auiConfig.sizeMap?.[key]) return;
  return `${role}-${key}`;
}

export function resolveVariant(role: string, variant?: Variant, fallback?: Variant): string | undefined {
  const key = variant ?? fallback;
  if (!key || !auiConfig.variantMap?.[key]) return;
  return `${role}-${key}`;
}

export function resolveColor(role: string, color?: Color, fallback?: Color): string | undefined {
  const key = color ?? fallback;
  if (!key || !auiConfig.colorMap?.[key]) return;
  return `${role}-${key}`;
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

export function register(key: keyof MauiConfig, styles: ComponentStyles) {
  auiConfig[key as never] = styles as never;
  return auiConfig;
}

/**
 * Compose the Maui classes for a component.
 * When `auiConfig.overrides === true` only the consumer class is emitted
 */
export function resolveClass(props: ComponentStyles, ...defaults: ClassInput[]) {
  if (auiConfig.overrides && props.className) {
    return classx(props.className);
  }
  return classx(defaults, props.className);
}

export const $class = resolveClass;

export function resolveRoleClass(role: string, props: ComponentStyles, defaults?: ComponentStyles): string {
  if (auiConfig.overrides && props.className) {
    return classx(props.className);
  }

  const size = resolveSize(role, props.size, defaults?.size);
  const color = resolveColor(role, props.color, defaults?.color);
  const variant = resolveVariant(role, props.variant, defaults?.variant);

  return classx(defaults?.className, size, variant, color, props.className);
}

export function resolveFamilies(tokens: string | string[], props: ComponentStyles, defaults?: ComponentStyles) {
  if (!Array.isArray(tokens)) {
    tokens = [tokens];
  }

  if (auiConfig.overrides && props.className) {
    return classx(props.className);
  }

  const roleClasses = tokens.map((r) => resolveFamily(r, props, defaults));
  return classx(roleClasses, defaults?.className, props.className);
}

export function resolveFamily(token: string, props: ComponentStyles, defaults?: ComponentStyles): string {
  return classx([
    token,
    resolveSize(token, props.size, defaults?.size),
    resolveColor(token, props.color, defaults?.color),
    resolveVariant(token, props.variant, defaults?.variant),
  ]);
}

export const $families = resolveFamilies;

/* -- ADDITIONAL DECLARATIONS -- */
/* ----------------------------- */
export type MauiConfig = typeof DEFAULT_CONFIG & {
  button?: ComponentStyles;
  switch?: ComponentStyles;
  toggle?: ComponentStyles;
  toggleGroup?: ComponentStyles;
  label?: ComponentStyles;
  checkbox?: ComponentStyles;
  checkboxGroup?: ComponentStyles;
  radio?: ComponentStyles;
  radioGroup?: ComponentStyles;
  slider?: ComponentStyles;
  sliderThumb?: ComponentStyles;
  header?: ComponentStyles;
  main?: ComponentStyles;
  footer?: ComponentStyles;
  section?: ComponentStyles;
  sidebar?: ComponentStyles;
  link?: ComponentStyles;
  divider?: ComponentStyles;
  image?: ComponentStyles;
  imageContent?: ComponentStyles;
  imageFallback?: ComponentStyles;
  select?: ComponentStyles;
  selectPanel?: ComponentStyles;
  selectOption?: ComponentStyles;
  selectTrigger?: ComponentStyles;
  navigation?: ComponentStyles;
  breadcrumb?: ComponentStyles;
  breadcrumbSeparator?: ComponentStyles;
  toolbar?: ComponentStyles;
  floatingToolbar?: ComponentStyles;
  pagination?: ComponentStyles;
  field?: ComponentStyles;
  fieldLabel?: ComponentStyles;
  fieldControl?: ComponentStyles;
  fieldDescription?: ComponentStyles;
  fieldError?: ComponentStyles;
  textInput?: ComponentStyles;
  searchInput?: ComponentStyles;
  codeInput?: ComponentStyles;
  codeInputCell?: ComponentStyles;
  numberStepper?: ComponentStyles;
  form?: ComponentStyles;
  filePicker?: ComponentStyles;
  listbox?: ComponentStyles;
  listboxOption?: ComponentStyles;
  combobox?: ComponentStyles;
  comboboxInput?: ComponentStyles;
  comboboxPanel?: ComponentStyles;
  comboboxOption?: ComponentStyles;
  disclosure?: ComponentStyles;
  disclosureTrigger?: ComponentStyles;
  disclosurePanel?: ComponentStyles;
  accordion?: ComponentStyles;
  accordionButton?: ComponentStyles;
  accordionPanel?: ComponentStyles;
  tab?: ComponentStyles;
  tabList?: ComponentStyles;
  tabButton?: ComponentStyles;
  tabPanel?: ComponentStyles;
  popover?: ComponentStyles;
  tooltip?: ComponentStyles;
  dialog?: ComponentStyles;
  dialogTrigger?: ComponentStyles;
  dialogPanel?: ComponentStyles;
  dialogTitle?: ComponentStyles;
  dialogDescription?: ComponentStyles;
  dialogClose?: ComponentStyles;
  confirm?: ComponentStyles;
  confirmTrigger?: ComponentStyles;
  confirmPanel?: ComponentStyles;
  confirmTitle?: ComponentStyles;
  confirmDescription?: ComponentStyles;
  confirmAction?: ComponentStyles;
  confirmCancel?: ComponentStyles;
  menu?: ComponentStyles;
  menuButton?: ComponentStyles;
  menuPanel?: ComponentStyles;
  menuItem?: ComponentStyles;
  menuItemCheckbox?: ComponentStyles;
  menuItemRadio?: ComponentStyles;
  menuItemGroup?: ComponentStyles;
  menuBar?: ComponentStyles;
  contextMenu?: ComponentStyles;
  contextMenuPanel?: ComponentStyles;
  announcer?: ComponentStyles;
  progress?: ComponentStyles;
  meter?: ComponentStyles;
  toast?: ComponentStyles;
  toastClose?: ComponentStyles;
  datePicker?: ComponentStyles;
  timePicker?: ComponentStyles;
  datePickerInput?: ComponentStyles;
  datePickerTrigger?: ComponentStyles;
  datePickerCalendar?: ComponentStyles;
  datePickerDay?: ComponentStyles;
  datePickerNav?: ComponentStyles;
  datePickerYearInput?: ComponentStyles;
  dateRangePicker?: ComponentStyles;
  grid?: ComponentStyles;
  treeGrid?: ComponentStyles;
  gridRow?: ComponentStyles;
  gridCell?: ComponentStyles;
  gridColumnHeader?: ComponentStyles;
  gridRowHeader?: ComponentStyles;
  tree?: ComponentStyles;
  treeItem?: ComponentStyles;
  treeGroup?: ComponentStyles;
  feed?: ComponentStyles;
  feedArticle?: ComponentStyles;
  reorder?: ComponentStyles;
  reorderItem?: ComponentStyles;
  reorderHandle?: ComponentStyles;
  search?: ComponentStyles;
  carousel?: ComponentStyles;
  carouselViewport?: ComponentStyles;
  carouselSlide?: ComponentStyles;
  carouselNav?: ComponentStyles;
  carouselPicker?: ComponentStyles;
  carouselPlayer?: ComponentStyles;
  stepper?: ComponentStyles;
  stepperInput?: ComponentStyles;
  stepperButton?: ComponentStyles;
  splitter?: ComponentStyles;
  badge?: ComponentStyles;
  avatar?: ComponentStyles;
  avatarGroup?: ComponentStyles;
  appIcon?: ComponentStyles;
  chip?: ComponentStyles;
  tagInput?: ComponentStyles;
  card?: ComponentStyles;
  emptyState?: ComponentStyles;
  list?: ComponentStyles;
  descriptionList?: ComponentStyles;
  stat?: ComponentStyles;
  readout?: ComponentStyles;
  spinner?: ComponentStyles;
  alert?: ComponentStyles;
  drawer?: ComponentStyles;
  drawerTrigger?: ComponentStyles;
  drawerPanel?: ComponentStyles;
  drawerTitle?: ComponentStyles;
  drawerDescription?: ComponentStyles;
  commandPalette?: ComponentStyles;
  commandPaletteInput?: ComponentStyles;
  commandPaletteItem?: ComponentStyles;
  desktop?: ComponentStyles;
  window?: ComponentStyles;
  windowButton?: ComponentStyles;
  windowTaskbar?: ComponentStyles;
  dock?: ComponentStyles;
  dockButton?: ComponentStyles;
  dockWidgets?: ComponentStyles;
  gallery?: ComponentStyles;
  galleryItem?: ComponentStyles;
  imageViewer?: ComponentStyles;
  imageSegments?: ComponentStyles;
  fullscreenButton?: ComponentStyles;
};

export const AUI_CLASS = {
  FOCUSABLE: branded('focusable'),
  BUTTON: branded('button'),
  SWITCH: branded('switch'),
  SWITCH_THUMB: branded('switch-thumb'),
  SWITCH_TRACK: branded('switch-track'),
  TOGGLE: branded('toggle'),
  TOGGLE_GROUP: branded('toggle-group'),
  LABEL: branded('label'),
  LABEL_TEXT: branded('label-text'),
  CHECKBOX: branded('checkbox'),
  CHECKBOX_GROUP: branded('checkbox-group'),
  RADIO: branded('radio'),
  RADIO_LABEL: branded('radio-label'),
  RADIO_BOX: branded('radio-box'),
  RADIO_GROUP: branded('radio-group'),
  SLIDER: branded('slider'),
  SLIDER_THUMB: branded('slider-thumb'),
  SLIDER_TRACK: branded('slider-track'),
  HEADER: branded('header'),
  MAIN: branded('main'),
  FOOTER: branded('footer'),
  SECTION: branded('section'),
  SIDEBAR: branded('sidebar'),
  LINK: branded('link'),
  DIVIDER: branded('divider'),
  DIVIDER_INSET: branded('divider-inset'),
  IMAGE: branded('image'),
  IMAGE_CONTENT: branded('image-content'),
  IMAGE_FALLBACK: branded('image-fallback'),
  SELECT: branded('select'),
  CONTROL: branded('control'),
  CONTROL_ICON: branded('control-icon'),
  INPUT: branded('input'),
  PANEL: branded('panel'),
  ITEM: branded('item'),
  ITEM_HINT: branded('item-hint'),
  SCALE: branded('scale'),
  /** Light that follows the pointer over a glass surface; pair it with the part's `trackPointer`. */
  GLINT: branded('glint'),
  /** The outer glass pane: a tint over what's behind, blurred, edged, rounded, with a shadow. */
  GLASS_FRAME: branded('glass-frame'),
  /** A frosted pane on a glass frame. */
  GLASS_PANEL: branded('glass-panel'),
  /** A solid surface on a glass frame, for what people read and work on. */
  GLASS_SURFACE: branded('glass-surface'),
  COLLAPSIBLE: branded('collapsible'),
  COLLAPSIBLE_HEADER: branded('collapsible-header'),
  COLLAPSIBLE_BODY: branded('collapsible-body'),
  MODAL: branded('modal'),
  MODAL_SCRIM: branded('modal-scrim'),
  MODAL_PANEL: branded('modal-panel'),
  MODAL_CONTENT: branded('modal-content'),
  MODAL_TITLE: branded('modal-title'),
  MODAL_DESCRIPTION: branded('modal-description'),
  MENU_ITEM: branded('menu-item'),
  MENU_PANEL: branded('menu-panel'),
  SELECT_CARET: branded('select-caret'),
  SELECT_PANEL: branded('select-panel'),
  SELECT_PLACEHOLDER: branded('select-placeholder'),
  SELECT_TRIGGER: branded('select-trigger'),
  SELECT_VALUE: branded('select-value'),
  SELECT_COUNT: branded('select-count'),
  SELECT_OPTION: branded('select-option'),
  NAVIGATION: branded('navigation'),
  BREADCRUMB: branded('breadcrumb'),
  BREADCRUMB_SEPARATOR: branded('breadcrumb-separator'),
  TOOLBAR: branded('toolbar'),
  TOOLBAR_OPTIONS: branded('toolbar-options'),
  FLOATING_TOOLBAR: branded('floating-toolbar'),
  PAGINATION: branded('pagination'),
  PAGINATION_GAP: branded('pagination-gap'),
  PAGINATION_STEP: branded('pagination-step'),
  FIELD: branded('field'),
  FIELD_LABEL: branded('field-label'),
  FIELD_CONTROL: branded('field-control'),
  FIELD_DESCRIPTION: branded('field-description'),
  FIELD_ERROR: branded('field-error'),
  TEXT_INPUT: branded('text-input'),
  SEARCH_INPUT: branded('search-input'),
  CODE_INPUT: branded('code-input'),
  CODE_INPUT_CELL: branded('code-input-cell'),
  CODE_INPUT_SEPARATOR: branded('code-input-separator'),
  NUMBER_STEPPER: branded('number-stepper'),
  FORM: branded('form'),
  FILE_PICKER: branded('file-picker'),
  LISTBOX: branded('listbox'),
  LISTBOX_OPTION: branded('listbox-option'),
  GALLERY: branded('gallery'),
  GALLERY_ITEM: branded('gallery-item'),
  GALLERY_MEDIA: branded('gallery-media'),
  GALLERY_CAPTION: branded('gallery-caption'),
  IMAGE_VIEWER: branded('image-viewer'),
  IMAGE_SEGMENTS: branded('segments'),
  COMPOSER: branded('composer'),
  STAGE: branded('stage'),
  TIMELINE_EDITOR: branded('timeline'),
  COMBOBOX: branded('combobox'),
  COMBOBOX_INPUT: branded('combobox-input'),
  COMBOBOX_PANEL: branded('combobox-panel'),
  COMBOBOX_OPTION: branded('combobox-option'),
  DISCLOSURE: branded('disclosure'),
  DISCLOSURE_TRIGGER: branded('disclosure-trigger'),
  DISCLOSURE_PANEL: branded('disclosure-panel'),
  ACCORDION: branded('accordion'),
  ACCORDION_BUTTON: branded('accordion-button'),
  ACCORDION_PANEL: branded('accordion-panel'),
  TAB: branded('tab'),
  TAB_LIST: branded('tab-list'),
  TAB_BUTTON: branded('tab-button'),
  TAB_PANEL: branded('tab-panel'),
  POPOVER: branded('popover'),
  TOOLTIP: branded('tooltip'),
  DIALOG: branded('dialog'),
  DIALOG_TRIGGER: branded('dialog-trigger'),
  DIALOG_PANEL: branded('dialog-panel'),
  DIALOG_TITLE: branded('dialog-title'),
  DIALOG_DESCRIPTION: branded('dialog-description'),
  DIALOG_CLOSE: branded('dialog-close'),
  CONFIRM: branded('confirm'),
  CONFIRM_TRIGGER: branded('confirm-trigger'),
  CONFIRM_PANEL: branded('confirm-panel'),
  CONFIRM_TITLE: branded('confirm-title'),
  CONFIRM_DESCRIPTION: branded('confirm-description'),
  CONFIRM_ACTION: branded('confirm-action'),
  CONFIRM_CANCEL: branded('confirm-cancel'),
  MENU: branded('menu'),
  MENU_BUTTON: branded('menu-button'),
  MENU_ITEM_CHECKBOX: branded('menu-item-checkbox'),
  MENU_ITEM_RADIO: branded('menu-item-radio'),
  MENU_ITEM_GROUP: branded('menu-item-group'),
  MENU_BAR: branded('menu-bar'),
  CONTEXT_MENU: branded('context-menu'),
  CONTEXT_MENU_PANEL: branded('context-menu-panel'),
  ANNOUNCER: branded('announcer'),
  PROGRESS: branded('progress'),
  PROGRESS_FILL: branded('progress-fill'),
  METER: branded('meter'),
  METER_FILL: branded('meter-fill'),
  TOAST: branded('toast'),
  TOAST_CLOSE: branded('toast-close'),
  TOAST_HOST: branded('toast-host'),
  TOAST_FLOATING: branded('toast-floating'),
  DATE_PICKER: branded('date-picker'),
  DATE_PICKER_INPUT: branded('date-picker-input'),
  DATE_PICKER_TRIGGER: branded('date-picker-trigger'),
  DATE_PICKER_CALENDAR: branded('date-picker-calendar'),
  DATE_PICKER_INLINE: branded('date-picker-inline'),
  DATE_PICKER_HEADER: branded('date-picker-header'),
  DATE_PICKER_TITLE: branded('date-picker-title'),
  DATE_PICKER_FIELD: branded('date-picker-field'),
  DATE_PICKER_SEPARATOR: branded('date-picker-separator'),
  DATE_PICKER_GRID: branded('date-picker-grid'),
  DATE_PICKER_WEEKDAY: branded('date-picker-weekday'),
  DATE_PICKER_DAY: branded('date-picker-day'),
  DATE_PICKER_NAV: branded('date-picker-nav'),
  DATE_PICKER_YEAR: branded('date-picker-year'),
  DATE_RANGE_PICKER: branded('date-range-picker'),
  GRID: branded('grid'),
  TREE_GRID: branded('tree-grid'),
  GRID_ROW: branded('grid-row'),
  GRID_CELL: branded('grid-cell'),
  GRID_COLUMN_HEADER: branded('grid-column-header'),
  GRID_ROW_HEADER: branded('grid-row-header'),
  TREE: branded('tree'),
  TREE_ITEM: branded('tree-item'),
  TREE_TOGGLE: branded('tree-toggle'),
  TREE_GROUP: branded('tree-group'),
  FEED: branded('feed'),
  FEED_ARTICLE: branded('feed-article'),
  REORDER: branded('reorder'),
  REORDER_HORIZONTAL: branded('reorder-horizontal'),
  REORDER_ITEM: branded('reorder-item'),
  REORDER_CARD: branded('reorder-card'),
  REORDER_HANDLE: branded('reorder-handle'),
  SEARCH: branded('search'),
  CAROUSEL: branded('carousel'),
  CAROUSEL_VIEWPORT: branded('carousel-viewport'),
  CAROUSEL_SLIDE: branded('carousel-slide'),
  CAROUSEL_NAV: branded('carousel-nav'),
  CAROUSEL_PICKER: branded('carousel-picker'),
  CAROUSEL_PLAYER: branded('carousel-player'),
  STEPPER: branded('stepper'),
  STEPPER_INPUT: branded('stepper-input'),
  STEPPER_BUTTON: branded('stepper-button'),
  SPLITTER: branded('splitter'),
  SPLITTER_SEAM: branded('splitter-seam'),
};
