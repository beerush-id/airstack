import type { Orientation } from '../types.js';

/**
 * Constrains a numeric value to an inclusive range, ignoring bounds left undefined.
 *
 * Shared by the range widgets (movable splitters, number-steppers) so a value
 * clamps identically whether it arrives from a parent assignment or keyboard stepping.
 *
 * @param value - Requested numeric value
 * @param min - Inclusive lower bound, or undefined when unbounded below
 * @param max - Inclusive upper bound, or undefined when unbounded above
 * @returns The nearest value inside the declared bounds
 */
export function clampRange(value: number, min?: number, max?: number): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

/**
 * Measurable track geometry for drag resolution along a single axis.
 */
export interface TrackGeometry {
  /**
   * Distance from the viewport left edge to the track start.
   */
  left: number;

  /**
   * Distance from the viewport top edge to the track bottom.
   */
  bottom: number;

  /**
   * Horizontal track extent.
   */
  width: number;

  /**
   * Vertical track extent.
   */
  height: number;
}

/**
 * Resolves a pointer position to a unitless ratio along the track axis,
 * measured from the left edge horizontally or the bottom edge vertically.
 *
 * Shared by draggable roles (sliders, splitters) so every drag maps geometry
 * identically; roles own bounds, snapping, and commits from the ratio.
 *
 * @param rect - Measured track geometry
 * @param orientation - Stepping axis selecting the measured span
 * @param clientX - Pointer horizontal viewport coordinate
 * @param clientY - Pointer vertical viewport coordinate
 * @returns The axis ratio, or null when the measured span is zero
 */
export function axisRatio(
  rect: TrackGeometry,
  orientation: Orientation,
  clientX: number,
  clientY: number
): number | null {
  const span = orientation === 'vertical' ? rect.height : rect.width;
  if (span <= 0) return null;
  const offset = orientation === 'vertical' ? rect.bottom - clientY : clientX - rect.left;
  return offset / span;
}
