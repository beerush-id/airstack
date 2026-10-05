/**
 * BLIND journey: edges — app perspective.
 * Editors constantly overshoot: scrub past end, step back past
 * head, hammer next at the last cue and prev at the first.
 * The ruler must hold, never crash, never lose position.
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

function buildEdgeCut() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'video' });
  track.addSegment({ name: 'cut', duration: 3, startFrame: uiFrame(1) });
  timeline.addMarker({ atFrame: uiFrame(45), name: 'mid' });
  timeline.refresh();
  return timeline;
}

describe('edges journey', () => {
  it('scrub past end clamps inside totals', () => {
    const timeline = buildEdgeCut();
    timeline.scrub(uiFrame(9999));
    expect(timeline.frame).toBeLessThanOrEqual(timeline.totalFrames);
    timeline.destroy();
  });

  it('step back past head stays at head', () => {
    const timeline = buildEdgeCut();
    timeline.scrub(uiFrame(2));
    timeline.step(-10);
    expect(timeline.frame).toBeGreaterThanOrEqual(0);
    timeline.destroy();
  });

  it('next at last cue stays put, prev at first stays put', () => {
    const timeline = buildEdgeCut();
    const landmarks = timeline.getLandmarks();
    const last = landmarks[landmarks.length - 1];
    timeline.scrub(last);
    timeline.next();
    expect(timeline.frame).toBe(last);
    timeline.scrub(landmarks[0]);
    timeline.prev();
    expect(timeline.frame).toBe(landmarks[0]);
    timeline.destroy();
  });

  it('single-scene clip blends with no next key', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'fx' });
    const segment = track.addSegment({ name: 'hold', duration: 2, startFrame: uiFrame(1) });
    segment.addScene({ atFrame: uiFrame(1), name: 'only' }, { v: 1 });
    timeline.refresh();
    timeline.scrub(uiFrame(30));
    expect(segment.activeScene?.name).toBe('only');
    expect(segment.nextScene).toBeUndefined();
    timeline.destroy();
  });
});
