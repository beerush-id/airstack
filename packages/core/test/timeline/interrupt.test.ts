/**
 * BLIND journey: interrupt — app perspective.
 * Viewer starts playback, seeks mid-play, pauses to inspect,
 * stops to return to head.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timeline } from '../../src/timeline/timeline.js';
import { uiFrame } from './fixture.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function buildWatch() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'video' });
  track.addSegment({ name: 'feature', duration: 5, startFrame: uiFrame(1) });
  timeline.refresh();
  return timeline;
}

describe('interrupt journey', () => {
  it('play then seek keeps playing at new position', () => {
    const timeline = buildWatch();
    const pause = timeline.play();
    timeline.seek(2);
    expect(timeline.frame).toBe(uiFrame(60));
    expect(timeline.status).toBe('playing');
    pause();
    timeline.destroy();
  });

  it('pause freezes on current frame as idle', () => {
    const timeline = buildWatch();
    timeline.play();
    timeline.scrub(uiFrame(45));
    timeline.pause();
    expect(timeline.frame).toBe(uiFrame(45));
    expect(timeline.status).toBe('idle');
    timeline.destroy();
  });

  it('stop returns to head as idle', () => {
    const timeline = buildWatch();
    timeline.play();
    timeline.scrub(uiFrame(90));
    timeline.stop();
    expect(timeline.frame).toBe(uiFrame(1));
    expect(timeline.time).toBe(0);
    expect(timeline.status).toBe('idle');
    timeline.destroy();
  });
});
