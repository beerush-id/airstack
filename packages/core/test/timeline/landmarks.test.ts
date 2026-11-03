/**
 * BLIND landmark tests — app perspective.
 *
 * Oracle: timeline.d.ts getLandmarks / next / prev ONLY.
 * App concern: chapter skip and snap navigation. A viewer presses
 * next/prev to jump between clip edges and cue points, and the editor
 * ruler renders every snap boundary.
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

function chapterTimeline() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'video' });
  track.addSegment({ name: 'intro', duration: 1, startFrame: 0 });
  track.addSegment({ name: 'main', duration: 2, startFrame: uiFrame(30) });
  timeline.addMarker({ atFrame: uiFrame(60), name: 'chorus' });
  timeline.refresh();
  return timeline;
}

describe('getLandmarks — ruler snap boundaries', () => {
  it('includes segment starts 0 and 30 and marker 60 in sorted order', () => {
    const timeline = chapterTimeline();
    const landmarks = timeline.getLandmarks();
    expect(landmarks).toContain(0);
    expect(landmarks).toContain(uiFrame(30));
    expect(landmarks).toContain(uiFrame(60));
    expect([...landmarks].sort((a, b) => a - b)).toEqual(landmarks);
    timeline.destroy();
  });

  it('returns unique frames with no duplicates', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'a', duration: 1, startFrame: 0 });
    track.addSegment({ name: 'b', duration: 1, startFrame: 0 });
    timeline.addMarker({ atFrame: 0, name: 'dup-cue' });
    timeline.refresh();
    const landmarks = timeline.getLandmarks();
    const unique = Array.from(new Set(landmarks));
    expect(landmarks).toEqual(unique);
    expect(landmarks).toContain(0);
    timeline.destroy();
  });

  it('grows when a new cue is added', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'main', duration: 3, startFrame: 0 });
    timeline.addMarker({ atFrame: uiFrame(30), name: 'existing' });
    timeline.refresh();
    const before = timeline.getLandmarks().length;
    timeline.addMarker({ atFrame: uiFrame(45), name: 'new-cue' });
    timeline.refresh();
    const after = timeline.getLandmarks();
    expect(after).toContain(uiFrame(45));
    expect(after.length).toBe(before + 1);
    timeline.destroy();
  });
});

describe('next / prev — chapter skip', () => {
  it('next() jumps from frame 0 to frame 30', () => {
    const timeline = chapterTimeline();
    timeline.scrub(0);
    timeline.next();
    expect(timeline.frame).toBe(uiFrame(30));
    timeline.destroy();
  });

  it('next() jumps from frame 31 to marker frame 60', () => {
    const timeline = chapterTimeline();
    timeline.scrub(uiFrame(31));
    timeline.next();
    expect(timeline.frame).toBe(uiFrame(60));
    timeline.destroy();
  });

  it('prev() jumps from frame 60 back to frame 30', () => {
    const timeline = chapterTimeline();
    timeline.scrub(uiFrame(60));
    timeline.prev();
    expect(timeline.frame).toBe(uiFrame(30));
    timeline.destroy();
  });

  it('prev() jumps from frame 29 back to frame 0', () => {
    const timeline = chapterTimeline();
    timeline.scrub(uiFrame(29));
    timeline.prev();
    expect(timeline.frame).toBe(0);
    timeline.destroy();
  });
});
