/**
 * BLIND journey: retake from head — app perspective.
 * Actor flubs the take; editor resets the clip to head and
 * previews again from the first key. A clip with no keys
 * previews with no active key but stays active in-window.
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

function buildRetake() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'video' });
  const clip = track.addSegment({ name: 'take', duration: 3, startFrame: 0 });
  clip.addScene({ atFrame: 0, name: 'slate' }, { take: 1 });
  clip.addScene({ atFrame: uiFrame(45), name: 'action' }, { take: 1 });
  timeline.refresh();
  return { timeline, clip };
}

describe('retake from head journey', () => {
  it('reset returns clip to head for another take', () => {
    const { timeline, clip } = buildRetake();
    timeline.scrub(uiFrame(60));
    clip.reset();
    expect(clip.frame).toBe(0);
    expect(clip.time).toBe(0);
    timeline.destroy();
  });

  it('preview after reset shows slate key again', () => {
    const { timeline, clip } = buildRetake();
    timeline.scrub(uiFrame(60));
    clip.reset();
    timeline.scrub(0);
    expect(clip.activeScene?.name).toBe('slate');
    timeline.destroy();
  });

  it('keyless clip previews active with no active key', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'b-roll' });
    const ambient = track.addSegment({ name: 'room-tone', duration: 2, startFrame: 0 });
    timeline.refresh();
    timeline.scrub(uiFrame(30));
    expect(ambient.active).toBe(true);
    expect(ambient.activeScene).toBeUndefined();
    timeline.destroy();
  });
});
