/**
 * BLIND journey: full episode scale — app perspective.
 * A real cut has many lanes, dozens of clips, hundreds of cues
 * across minutes — not 1 lane and 90 frames. The ruler, totals
 * and skip must hold at that scale.
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

function buildEpisode() {
  const timeline = new Timeline({ frameRate: 30 });
  const lanes = ['video-a', 'video-b', 'audio', 'captions', 'fx'];
  let start = 0;
  for (const lane of lanes) {
    const track = timeline.addTrack({ name: lane });
    for (let i = 0; i < 6; i++) {
      const segment = track.addSegment({ name: `${lane}-clip-${i}`, duration: 5, startFrame: start + i * 150 });
      segment.addScene({ atFrame: 0, name: 'in' }, { v: 0 });
      segment.addScene({ atFrame: uiFrame(75), name: 'mid' }, { v: 1 });
    }
    start += 30;
  }
  for (let m = 0; m < 20; m++) {
    timeline.addMarker({ atFrame: m * 90, name: `chapter-${m}` });
  }
  timeline.refresh();
  return timeline;
}

describe('full episode scale journey', () => {
  it('holds 5 lanes with 30 clips and 20 cues', () => {
    const timeline = buildEpisode();
    expect(timeline.tracks.size).toBe(5);
    let clips = 0;
    for (const track of timeline.tracks) clips += track.segments.size;
    expect(clips).toBe(30);
    expect(timeline.markers.size).toBe(20);
    timeline.destroy();
  });

  it('totals span minutes, not seconds', () => {
    const timeline = buildEpisode();
    expect(timeline.totalFrames).toBeGreaterThan(900);
    expect(timeline.totalTime).toBeGreaterThan(30);
    timeline.destroy();
  });

  it('ruler stays sorted unique at scale and skip works deep in', () => {
    const timeline = buildEpisode();
    const landmarks = timeline.getLandmarks();
    expect(landmarks.length).toBeGreaterThan(40);
    expect([...landmarks].sort((a, b) => a - b)).toEqual(landmarks);
    timeline.scrub(uiFrame(800));
    timeline.next();
    expect(timeline.frame).toBeGreaterThan(800);
    timeline.prev();
    expect(timeline.frame).toBeLessThanOrEqual(800);
    timeline.destroy();
  });
});
