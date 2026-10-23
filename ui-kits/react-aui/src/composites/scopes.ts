import { createContext } from '@airlib/react';
import { createStyleScope } from '../utils/common.js';

/*
 * Internal pieces shared across composite modules. Not re-exported from the
 * package entry, so nothing here becomes public API by accident.
 */

/** Style scope shared by every menu root — Menu, MenuBar, ContextMenu — so menu parts style the same under any of them. */
export const menuScope = createStyleScope();

/** Style scope shared by the modal roots — Dialog, Confirm — so a sheet's buttons follow the root that opened it. */
export const modalScope = createStyleScope();

/** Style scope shared by DatePicker and DateRangePicker, whose parts are the same components. */
export const datePickerScope = createStyleScope();

/** Set inside a `DatePickerField`: its input goes bare and its trigger goes quiet, since the field draws the box. */
export const datePickerInField = createContext<boolean>();

/** The enclosing picker's live month view, for parts that print it (the default calendar header). */
export const datePickerView = createContext<{ range: { monthStr: string } }>();
