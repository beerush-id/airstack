/**
 * BLIND helper tests — app perspective.
 *
 * Oracle: helper.d.ts animationFrame / cancelFrame ONLY.
 * App concern: the preview clock ticks in the browser via rAF and still
 * ticks in SSR / Node via a frameRate-budgeted fallback. The editor can
 * schedule a frame and cancel it before it fires.
 */
import { describe, expect, it, vi } from 'vitest';
import { animationFrame, cancelFrame } from '../../src/timeline/helper.js';
import { uiFrame } from './fixture.js';

describe('animationFrame / cancelFrame', () => {
  it('invokes the callback with a timestamp', async () => {
    const timestamp = await new Promise<number>((resolve) => {
      animationFrame((t) => resolve(t), 60);
    });
    expect(typeof timestamp).toBe('number');
  });

  it('cancelFrame prevents a scheduled callback', () => {
    vi.useFakeTimers();
    let fired = false;
    const id = animationFrame(() => {
      fired = true;
    }, 30);
    cancelFrame(id);
    vi.advanceTimersByTime(200);
    expect(fired).toBe(false);
    vi.useRealTimers();
  });

  it('returns an id that cancelFrame accepts without throwing', () => {
    const id = animationFrame(() => {}, 30);
    expect(() => cancelFrame(id)).not.toThrow();
  });
});
