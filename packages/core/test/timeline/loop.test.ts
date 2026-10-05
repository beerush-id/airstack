/**
 * BLIND journey: loop to practice — app perspective.
 * Musician loops the chorus clip to rehearse; editor sets
 * repeat on the clip and checks laid-out cycles.
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

function buildLoop() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'music' });
  const chorus = track.addSegment({ name: 'chorus', duration: 2, startFrame: uiFrame(60), repeat: 2 });
  timeline.refresh();
  return { timeline, chorus };
}

describe('loop to practice journey', () => {
  it('repeat 2 lays out 3 cycles for practice', () => {
    const { timeline, chorus } = buildLoop();
    expect(chorus.cycles).toBe(3);
    timeline.destroy();
  });

  it('scrub into second cycle still shows clip active', () => {
    const { timeline, chorus } = buildLoop();
    timeline.scrub(uiFrame(90));
    expect(chorus.active).toBe(true);
    timeline.destroy();
  });

  it('infinite loop stays single laid-out cycle for endless jam', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'drums' });
    const jam = track.addSegment({ name: 'groove', duration: 1, startFrame: uiFrame(1), repeat: true });
    expect(jam.cycles).toBe(1);
    timeline.destroy();
  });
});
