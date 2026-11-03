/**
 * Coverage scene tests — construction defaults, clamping, and hydrate branches.
 *
 * Oracle: scene.d.ts ONLY.
 * App concern: an editor drops keyframes onto a clip without configuration
 * (clamped to the clip length) and restores saved keyframes into live scene
 * instances without losing state on partial snapshots.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineScene } from '../../src/timeline/scene.js';
import { Timeline } from '../../src/timeline/timeline.js';
import { uiFrame } from './fixture.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function buildSegment() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'webgl' });
  const segment = track.addSegment({ name: 'fx', duration: 2, startFrame: 0 });
  return { timeline, segment };
}

describe('scene construction defaults', () => {
  it('constructs at frame zero with empty data when no options or data are provided', () => {
    const { timeline, segment } = buildSegment();
    const scene = new TimelineScene(segment);

    expect(scene.atFrame).toBe(0);
    expect(scene.type).toBeUndefined();
    expect(scene.name).toBeUndefined();
    expect(scene.meta).toBeUndefined();
    expect(scene.data).toEqual({});
    expect(segment.scenes).toContain(scene);

    timeline.destroy();
  });
});

describe('scene atFrame clamping', () => {
  it('clamps negative and beyond-segment frames on construction and via the setter', () => {
    const { timeline, segment } = buildSegment();
    const negative = new TimelineScene(segment, { atFrame: -5 });
    const beyond = new TimelineScene(segment, { atFrame: 999 });

    expect(negative.atFrame).toBe(0);
    expect(beyond.atFrame).toBe(60); // duration 2 @ 30fps → totalFrames 60

    beyond.atFrame = -3;
    expect(beyond.atFrame).toBe(0);
    beyond.atFrame = 999;
    expect(beyond.atFrame).toBe(60);

    timeline.destroy();
  });
});

describe('scene hydrate', () => {
  it('restores identity, options and data from a full snapshot', () => {
    const { timeline, segment } = buildSegment();
    const scene = new TimelineScene(segment, { atFrame: uiFrame(10), type: 'shader', name: 'glow' }, { bloom: 1 });
    const snap = scene.snapshot();
    snap.id = 'restored-scene-id';
    snap.options = { atFrame: uiFrame(20), type: 'gsap', name: 'fade', meta: { ease: 'linear' } };
    snap.data = { opacity: 0.5 };

    scene.hydrate(snap);

    expect(scene.id).toBe('restored-scene-id');
    expect(scene.atFrame).toBe(uiFrame(20));
    expect(scene.type).toBe('gsap');
    expect(scene.name).toBe('fade');
    expect(scene.meta).toEqual({ ease: 'linear' });
    // assign() merges data keys: existing bloom stays, opacity is overwritten.
    expect(scene.data).toEqual({ bloom: 1, opacity: 0.5 });
    timeline.destroy();
  });

  it('restores options without atFrame by keeping the current frame position', () => {
    const { timeline, segment } = buildSegment();
    const scene = new TimelineScene(segment, { atFrame: uiFrame(12), name: 'glow' });

    scene.hydrate({ options: { name: 'renamed' } });

    expect(scene.atFrame).toBe(uiFrame(12));
    expect(scene.name).toBe('renamed');
    timeline.destroy();
  });

  it('restores data payloads only when present and ignores an empty snapshot', () => {
    const { timeline, segment } = buildSegment();
    const scene = new TimelineScene(segment, { atFrame: uiFrame(5) }, { bloom: 1 });
    const idBefore = scene.id;

    scene.hydrate({ data: { bloom: 4, enabled: true } });
    expect(scene.data).toEqual({ bloom: 4, enabled: true });

    scene.hydrate({});
    expect(scene.id).toBe(idBefore);
    expect(scene.atFrame).toBe(uiFrame(5));
    expect(scene.data).toEqual({ bloom: 4, enabled: true });
    timeline.destroy();
  });
});
