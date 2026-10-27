import type { AnyType } from '@airlib/react';
import type { Timeline } from '@airlib/react/timeline';

/**
 * A length of time as a clock reads it: `m:ss`, or `h:mm:ss` past an hour.
 *
 * @param seconds - The time, in seconds; below zero reads as zero.
 * @returns The time as text, e.g. `1:05`.
 */
export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * A slider's props for a timeline's playhead: its value is where the timeline is, and moving it
 * seeks there. The arrows step a frame, Page Up and Page Down a second, and the value reads as a time.
 *
 * @param timeline - Reads the timeline the playhead moves.
 * @returns Props for `aria('slider', …)`.
 */
export function playheadSlider(timeline: () => Timeline): AnyType {
  return {
    min: 0,
    page: 1,
    valuetext: formatTime,
    get value() {
      return timeline().state.time;
    },
    set value(time: number) {
      timeline().seek(Math.max(0, time));
    },
    get max() {
      return timeline().state.totalTime;
    },
    get step() {
      return 1 / (timeline().frameRate ?? 30);
    },
  };
}
