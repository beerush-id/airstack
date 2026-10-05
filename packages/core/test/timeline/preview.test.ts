/**
 * BLIND journey: build-then-preview — app perspective.
 * Oracle: timeline/track/segment/scene/marker .d.ts ONLY.
 * Editor builds a real project then scrubs through it to preview.
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

function buildPreviewProject() {
  const timeline = new Timeline({ frameRate: 30 });
  const video = timeline.addTrack({ name: 'video', type: 'video' });
  const clip = video.addSegment({ name: 'intro', duration: 3, startFrame: uiFrame(1) });
  clip.addScene({ atFrame: uiFrame(1), name: 'open' }, { opacity: 0 });
  clip.addScene({ atFrame: uiFrame(60), name: 'reveal' }, { opacity: 1 });
  timeline.addMarker({ atFrame: uiFrame(30), name: 'beat' });
  timeline.refresh();
  return { timeline, clip };
}

describe('build-then-preview journey', () => {
  it('scrub to start shows first keyframe active', () => {
    const { timeline, clip } = buildPreviewProject();
    timeline.scrub(uiFrame(1));
    expect(clip.activeScene?.name).toBe('open');
    expect(timeline.status).toBe('idle');
    timeline.destroy();
  });

  it('scrub mid-clip advances active span toward reveal', () => {
    const { timeline, clip } = buildPreviewProject();
    timeline.scrub(uiFrame(45));
    expect(clip.activeScene?.name).toBe('open');
    expect(clip.nextScene?.name).toBe('reveal');
    expect(clip.active).toBe(true);
    timeline.destroy();
  });

  it('scrub past second key shows reveal active', () => {
    const { timeline, clip } = buildPreviewProject();
    timeline.scrub(uiFrame(75));
    expect(clip.activeScene?.name).toBe('reveal');
    timeline.destroy();
  });
});
