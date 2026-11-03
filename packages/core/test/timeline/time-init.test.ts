/**
 * Coverage timeline tests — building markers, scenes and segments by seconds
 * instead of frames (the `atTime` / `startTime` init aliases).
 *
 * Oracle: marker.d.ts / scene.d.ts / segment.d.ts ONLY.
 * App concern: an editor drops in a chapter list, a keyframe sheet and an EDL
 * that all speak seconds, and the project frame rate alone decides where each
 * one lands on the ruler.
 *
 * Plain frame-number construction is already covered by the marker / scene /
 * segment journeys.
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

function buildTrack() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'video' });
  return { timeline, track };
}

describe('init by seconds', () => {
  it('places a cue from atTime at the project frame rate', () => {
    const { timeline } = buildTrack();
    const marker = timeline.addMarker({ atTime: 3, name: 'hook' });

    expect(marker.atFrame).toBe(uiFrame(90));
    expect(marker.atTime).toBe(3);

    timeline.destroy();
  });

  it('keeps an explicit frame ahead of the atTime alias', () => {
    const { timeline } = buildTrack();
    const marker = timeline.addMarker({ atFrame: uiFrame(30), atTime: 3, name: 'hook' });

    expect(marker.atFrame).toBe(uiFrame(30));
    expect(marker.atTime).toBe(1);

    timeline.destroy();
  });

  it('places a keyframe from atTime inside the parent clip', () => {
    const { timeline, track } = buildTrack();
    const segment = track.addSegment({ name: 'verse', duration: 2 });
    const scene = segment.addScene({ atTime: 1, name: 'pose' });

    expect(scene.atFrame).toBe(uiFrame(30));
    expect(scene.atTime).toBe(1);

    timeline.destroy();
  });

  it('opens the project work-area from startTime and endTime', () => {
    const timeline = new Timeline({ frameRate: 30, startTime: 1, endTime: 5 });

    expect(timeline.startFrame).toBe(uiFrame(30));
    expect(timeline.endFrame).toBe(uiFrame(150));
    expect(timeline.startTime).toBe(1);
    expect(timeline.endTime).toBe(5);

    timeline.destroy();
  });

  it('offsets a clip from startTime at the project frame rate', () => {
    const { timeline, track } = buildTrack();
    const segment = track.addSegment({ name: 'verse', duration: 1, startTime: 3 });

    expect(segment.startFrame).toBe(uiFrame(90));
    expect(segment.startTime).toBe(3);
    expect(timeline.getLandmarks()).toContain(uiFrame(90));

    timeline.destroy();
  });
});
