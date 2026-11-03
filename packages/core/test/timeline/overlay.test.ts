/**
 * BLIND journey: b-roll overlay — app perspective.
 * Main interview rolls underneath while b-roll covers on a
 * higher lane; both stay active in the overlap so the switcher
 * can cut between them. No same-track stacking — overlap lives
 * across lanes, the way editors actually work.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timeline } from '../../src/timeline/timeline.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function buildOverlay() {
  const timeline = new Timeline({ frameRate: 30 });
  const main = timeline.addTrack({ name: 'interview' });
  const cover = timeline.addTrack({ name: 'b-roll' });
  const base = main.addSegment({ name: 'answer', duration: 6, startFrame: 0 });
  const cutaway = cover.addSegment({ name: 'hands', duration: 2, startFrame: 60 });
  timeline.refresh();
  return { timeline, base, cutaway };
}

describe('b-roll overlay journey', () => {
  it('before cover only base is active', () => {
    const { timeline, base, cutaway } = buildOverlay();
    timeline.scrub(30);
    expect(base.active).toBe(true);
    expect(cutaway.active).toBe(false);
    timeline.destroy();
  });

  it('inside cover both lanes stay active for the switch', () => {
    const { timeline, base, cutaway } = buildOverlay();
    timeline.scrub(90);
    expect(base.active).toBe(true);
    expect(cutaway.active).toBe(true);
    timeline.destroy();
  });

  it('after cover only base stays active', () => {
    const { timeline, base, cutaway } = buildOverlay();
    timeline.scrub(150);
    expect(base.active).toBe(true);
    expect(cutaway.active).toBe(false);
    timeline.destroy();
  });
});
