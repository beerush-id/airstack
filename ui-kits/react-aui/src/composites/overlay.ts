/**
 * Shared overlay vocabulary consumed by the floating-panel components.
 * These are placement and gesture tokens, not styling decisions: each one
 * becomes an attribute or a data token that AUI CSS reads.
 */

export type OverlayTriggerMode = 'click' | 'hover' | 'focus' | 'rove' | 'combo';

export type OverlayXDirection = 'before' | 'after' | 'left' | 'between' | 'right';

export type OverlayYDirection = 'top' | 'bottom' | 'above' | 'below' | 'between';

export type PopoverRole = 'dialog' | 'menu' | 'tooltip' | 'listbox';

export type DialogModality = 'modal' | 'nonmodal';
