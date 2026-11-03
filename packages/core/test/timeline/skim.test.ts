/**
 * BLIND journey: skim at double speed — app perspective.
 * Editor skims a long cut at 2x to find the moment, steps
 * frame-by-frame to land it, then drops back to 1x.
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

function buildSkim() {
  const timeline = new Timeline({ frameRate: 30, speed: 2 });
  const track = timeline.addTrack({ name: 'video' });
  track.addSegment({ name: 'rough', duration: 10, startFrame: 0 });
  timeline.refresh();
  return timeline;
}

describe('skim at double speed journey', () => {
  it('starts at 2x for skimming', () => {
    const timeline = buildSkim();
    expect(timeline.speed).toBe(2);
    timeline.destroy();
  });

  it('step lands exact frames while skimming', () => {
    const timeline = buildSkim();
    timeline.scrub(uiFrame(100));
    timeline.step();
    expect(timeline.frame).toBe(uiFrame(101));
    timeline.step(-1);
    expect(timeline.frame).toBe(uiFrame(100));
    timeline.destroy();
  });

  it('drop to 1x keeps same frame for fine cut', () => {
    const timeline = buildSkim();
    timeline.scrub(uiFrame(120));
    timeline.speed = 1;
    expect(timeline.speed).toBe(1);
    expect(timeline.frame).toBe(uiFrame(120));
    expect(timeline.time).toBe(4);
    timeline.destroy();
  });
});
