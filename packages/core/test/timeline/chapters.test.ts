/**
 * BLIND journey: chapter skip — app perspective.
 * Viewer jumps between story beats with next/prev; editor ruler
 * renders those beats.
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

function buildChapters() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'video' });
  track.addSegment({ name: 'part-1', duration: 2, startFrame: uiFrame(1) });
  track.addSegment({ name: 'part-2', duration: 2, startFrame: uiFrame(60) });
  timeline.addMarker({ atFrame: uiFrame(30), name: 'verse' });
  timeline.addMarker({ atFrame: uiFrame(90), name: 'chorus' });
  timeline.refresh();
  return timeline;
}

describe('chapter skip journey', () => {
  it('viewer starts at 0 and skips to verse cue', () => {
    const timeline = buildChapters();
    timeline.scrub(uiFrame(1));
    timeline.next();
    expect(timeline.frame).toBe(uiFrame(30));
    timeline.destroy();
  });

  it('viewer at verse skips forward to part-2 edge', () => {
    const timeline = buildChapters();
    timeline.scrub(uiFrame(30));
    timeline.next();
    expect(timeline.frame).toBe(uiFrame(60));
    timeline.destroy();
  });

  it('viewer at chorus rewinds to part-2 edge', () => {
    const timeline = buildChapters();
    timeline.scrub(uiFrame(90));
    timeline.prev();
    expect(timeline.frame).toBe(uiFrame(60));
    timeline.destroy();
  });

  it('ruler contains both cues for rendering', () => {
    const timeline = buildChapters();
    const landmarks = timeline.getLandmarks();
    expect(landmarks).toContain(uiFrame(30));
    expect(landmarks).toContain(uiFrame(90));
    timeline.destroy();
  });
});
