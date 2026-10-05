/**
 * BLIND journey: work-area bounds — app perspective.
 * Editor sets in/out bounds to focus the verse, ruler snaps
 * to those bounds, skip stays inside them.
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

function buildWorkArea() {
  const timeline = new Timeline({ frameRate: 30, startFrame: uiFrame(30), endFrame: uiFrame(150) });
  const track = timeline.addTrack({ name: 'video' });
  track.addSegment({ name: 'verse', duration: 4, startFrame: uiFrame(30) });
  timeline.addMarker({ atFrame: uiFrame(90), name: 'hook' });
  timeline.refresh();
  return timeline;
}

describe('work-area bounds journey', () => {
  it('ruler includes in/out bounds for snapping', () => {
    const timeline = buildWorkArea();
    const landmarks = timeline.getLandmarks();
    expect(landmarks).toContain(uiFrame(30));
    expect(landmarks).toContain(uiFrame(150));
    timeline.destroy();
  });

  it('skip from start lands on hook cue', () => {
    const timeline = buildWorkArea();
    timeline.scrub(uiFrame(30));
    timeline.next();
    expect(timeline.frame).toBe(uiFrame(90));
    timeline.destroy();
  });

  it('rewind from hook returns to in-point', () => {
    const timeline = buildWorkArea();
    timeline.scrub(uiFrame(90));
    timeline.prev();
    expect(timeline.frame).toBe(uiFrame(30));
    timeline.destroy();
  });
});
