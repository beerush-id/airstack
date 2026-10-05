/**
 * BLIND journey: blend for renderer — app perspective.
 * Renderer needs from/to payloads plus normalized progress to
 * interpolate between two keys while the editor scrubs.
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

function buildBlend() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'fx' });
  const segment = track.addSegment({ name: 'move', duration: 3, startFrame: uiFrame(1) });
  segment.addScene({ atFrame: uiFrame(1), name: 'left' }, { x: 0 });
  segment.addScene({ atFrame: uiFrame(60), name: 'right' }, { x: 100 });
  timeline.refresh();
  return { timeline, segment };
}

describe('blend for renderer journey', () => {
  it('quarter scrub reports progress 0.25 with both payloads', () => {
    const { timeline, segment } = buildBlend();
    let progress = -1;
    let fromX = -1;
    let toX = -1;
    const off = segment.onTransition((s) => {
      progress = s.progress;
      fromX = (s.from.data as { x: number }).x;
      toX = (s.to?.data as { x: number } | undefined)?.x ?? -1;
    });
    timeline.scrub(uiFrame(15));
    expect(progress).toBe(0.25);
    expect(fromX).toBe(0);
    expect(toX).toBe(100);
    off();
    timeline.destroy();
  });

  it('mid scrub reports halfway blend', () => {
    const { timeline, segment } = buildBlend();
    let progress = -1;
    const off = segment.onTransition((s) => {
      progress = s.progress;
    });
    timeline.scrub(uiFrame(30));
    expect(progress).toBe(0.5);
    off();
    timeline.destroy();
  });
});
