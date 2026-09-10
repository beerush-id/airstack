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
