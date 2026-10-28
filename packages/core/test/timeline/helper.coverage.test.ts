/**
 * Coverage helper tests — branch completion for SSR fallbacks and edge cases.
 *
 * Oracle: helper.d.ts animationFrame / cancelFrame / frameToTime / timeToFrame ONLY.
 * App concern: the preview clock still schedules and cancels frames in non-browser
 * (SSR / Node) environments, and invalid frame / time inputs clamp at the boundary
 * instead of producing NaN or negative positions.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { animationFrame, cancelFrame, frameToTime, timeToFrame } from '../../src/timeline/helper.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('animationFrame SSR fallback', () => {
  it('falls back to a frameRate-budgeted setTimeout when requestAnimationFrame is unavailable', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', undefined);

    const callback = vi.fn();
    animationFrame(callback); // default frameRate (30fps → ~33.33ms budget)

    vi.advanceTimersByTime(32);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(Number.isFinite(callback.mock.calls[0][0])).toBe(true);
  });

  it('cancelFrame clears the fallback timer when cancelAnimationFrame is unavailable', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('cancelAnimationFrame', undefined);

    let fired = false;
    const id = animationFrame(() => {
      fired = true;
    }, 60);
    cancelFrame(id);

    vi.advanceTimersByTime(100);
    expect(fired).toBe(false);
  });
});

describe('frame / time conversion edge cases', () => {
  it('clamps negative frames to zero time', () => {
    expect(frameToTime(-1, 30)).toBe(0);
    expect(frameToTime(-100, 30)).toBe(0);
  });

  it('converts 0-indexed frames to the time the frame starts at', () => {
    expect(frameToTime(0, 30)).toBe(0);
    expect(frameToTime(30, 30)).toBe(1);
    expect(frameToTime(60, 30)).toBe(2);
  });

  it('clamps non-positive times to frame zero', () => {
    expect(timeToFrame(0, 30)).toBe(0);
    expect(timeToFrame(-1, 30)).toBe(0);
  });

  it('converts continuous time to the 0-indexed frame starting at that time', () => {
    expect(timeToFrame(1, 30)).toBe(30);
    expect(timeToFrame(2, 30)).toBe(60);
  });
});
