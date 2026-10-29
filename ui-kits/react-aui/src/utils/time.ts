import { type AnyType, proxyProps } from '@airlib/react';
import { animationFrame, type FrameId, type Timeline } from '@airlib/react/timeline';

/**
 * How much of a frame's time must pass before the playhead seeks again: a little under all of it,
 * since screen refreshes land a touch early or late, and waiting for the whole of it would miss one.
 */
const FRAME_SLACK = 0.85;

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
 * Holds a playing timeline while its playhead is dragged, and plays it on from wherever it's let
 * go. Seeking while playing restarts playback at every move, and with it everything that follows
 * playback — sound rescheduled, media read afresh — so a drag would stutter and fall behind. Give
 * it to the playhead's `onPointerDownCapture`, ahead of the slider's own handling.
 *
 * @param timeline - Reads the timeline the playhead moves.
 * @returns The handler for a press on the playhead.
 */
export function holdWhileDragging(timeline: () => Timeline): (event: { button: number }) => void {
  return (event) => {
    const held = timeline();
    if (event.button !== 0 || held.state.status !== 'playing') return;
    held.pause();
    const resume = () => {
      window.removeEventListener('pointerup', resume);
      window.removeEventListener('pointercancel', resume);
      held.play();
    };
    window.addEventListener('pointerup', resume);
    window.addEventListener('pointercancel', resume);
  };
}

/**
 * A slider's props for a timeline's playhead: its value is where the timeline is, and moving it
 * seeks there. A drag moves faster than the timeline ticks, so the playhead seeks on screen
 * refreshes, at most once a timeline frame — to where it was moved last, and last of all to where
 * it comes to rest — as evenly as playback moves it; every move in between is let go, rather than
 * each asking the stage for a frame it would only throw away. The arrows step a frame, Page Up and
 * Page Down a second, and the value reads as a time.
 *
 * @param timeline - Reads the timeline the playhead moves.
 * @param land - Where a move to a time lands instead, e.g. a point it snaps to; the time itself without it.
 * @returns Props for `aria('slider', …)`, as component props, so the slider can leave out its own.
 */
export function playheadSlider(timeline: () => Timeline, land?: (time: number) => number): AnyType {
  // Where the playhead was moved last and not yet sought, the frame waiting to seek it, and the last seek's moment.
  let moved: number | undefined;
  let waiting: FrameId | undefined;
  let sought = -Infinity;
  // On each screen refresh, seeks to the latest move once a timeline frame has passed since the last seek.
  const tick = (now: number) => {
    waiting = undefined;
    if (moved === undefined) return;
    if (now - sought < (1000 / timeline().frameRate) * FRAME_SLACK) {
      waiting = animationFrame(tick);
      return;
    }
    const time = moved;
    moved = undefined;
    sought = now;
    timeline().seek(Math.max(0, land ? land(time) : time));
  };

  return proxyProps({
    min: 0,
    page: 1,
    valuetext: formatTime,
    get value() {
      return timeline().state.time;
    },
    set value(time: number) {
      moved = time;
      waiting ??= animationFrame(tick);
    },
    get max() {
      return timeline().state.totalTime;
    },
    get step() {
      return 1 / (timeline().frameRate ?? 30);
    },
  });
}
