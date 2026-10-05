/**
 * BLIND journey: save-load-continue — app perspective.
 * Editor saves mid-cut, reopens tomorrow, keeps cutting from sameoty frame.
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

function buildCut() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'video', type: 'video' });
  const segment = track.addSegment({ name: 'story', duration: 4, startFrame: uiFrame(1) });
  segment.addScene({ atFrame: uiFrame(1), name: 'wide' }, { shot: 'wide' });
  segment.addScene({ atFrame: uiFrame(60), name: 'close' }, { shot: 'close' });
  timeline.addMarker({ atFrame: uiFrame(90), name: 'ending' });
  timeline.refresh();
  timeline.scrub(uiFrame(45));
  return timeline;
}

describe('save-load-continue journey', () => {
  it('reopened project lands on same preview frame with same active key', () => {
    const saved = buildCut();
    const snap = saved.snapshot();
    const frame = saved.frame;
    saved.destroy();

    const reopened = new Timeline({ frameRate: 30 });
    reopened.hydrate(snap);
    reopened.scrub(frame);
    const [track] = Array.from(reopened.tracks);
    const [segment] = Array.from(track.segments);
    expect(reopened.frame).toBe(uiFrame(45));
    expect(segment.activeScene?.name).toBe('wide');
    expect(segment.nextScene?.name).toBe('close');
    reopened.destroy();
  });

  it('reopened project keeps cue for chapter render', () => {
    const saved = buildCut();
    const snap = saved.snapshot();
    saved.destroy();

    const reopened = new Timeline({ frameRate: 30 });
    reopened.hydrate(snap);
    expect(reopened.getLandmarks()).toContain(uiFrame(90));
    reopened.destroy();
  });
});
