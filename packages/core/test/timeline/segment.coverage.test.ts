/**
 * Coverage segment tests — setter round-trips, option fallbacks, guards, and
 * frameRate migration.
 *
 * Oracle: segment.d.ts ONLY.
 * App concern: an editor relabels clips, retimes them (speed / repeat / duration)
 * after keyframes exist, migrates a project between frame rates, and restores
 * partial project patches onto live clips without losing state.
 *
 * Full-snapshot hydrate and normal playback ticking are already covered by
 * persistence.test.ts and the transport/timing journeys.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineSegment } from '../../src/timeline/segment.js';
import { Timeline } from '../../src/timeline/timeline.js';
import { uiFrame } from './fixture.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function buildSegment(duration = 2) {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'video' });
  const segment = track.addSegment({ name: 'clip', duration, startFrame: uiFrame(1) });
  return { timeline, track, segment };
}

describe('segment construction defaults', () => {
  it('constructs a zero-length unlabeled clip when no options are provided', () => {
    const { timeline, track } = buildSegment(0);
    const segment = new TimelineSegment(track);

    expect(segment.startFrame).toBe(0);
    expect(segment.totalFrames).toBe(0);
    expect(segment.type).toBeUndefined();
    expect(segment.name).toBeUndefined();
    expect(segment.meta).toBeUndefined();
    expect(track.segments.has(segment)).toBe(true);

    timeline.destroy();
  });
});

describe('segment property setters', () => {
  it('type / name / meta setters update the clip for editor round-trips', () => {
    const { timeline, segment } = buildSegment();

    segment.type = 'webgl';
    segment.name = 'hero-fx';
    segment.meta = { src: 'hero.glb' };

    expect(segment.type).toBe('webgl');
    expect(segment.name).toBe('hero-fx');
    expect(segment.meta).toEqual({ src: 'hero.glb' });
    timeline.destroy();
  });

  it('repeat setter retimes the clip for looping', () => {
    const { timeline, segment } = buildSegment();

    segment.repeat = true;

    expect(segment.repeat).toBe(true);
    timeline.destroy();
  });

  it('speed of zero falls back to an unmultiplied cycle length', () => {
    const { timeline, segment } = buildSegment(1);

    segment.speed = 0;

    expect(segment.speed).toBe(0);
    // round((1s * 30fps) / fallback divisor 1) — speed 0 must not collapse the clip.
    expect(segment.totalFrames).toBe(30);
    timeline.destroy();
  });
});

describe('segment active window', () => {
  it('reports a disabled clip as inactive regardless of the playhead', () => {
    const { timeline, segment } = buildSegment();
    timeline.scrub(uiFrame(10));

    segment.disabled = true;

    expect(segment.disabled).toBe(true);
    expect(segment.active).toBe(false);
    timeline.destroy();
  });
});

describe('scene collection guards', () => {
  it('adds an unlabeled keyframe at frame zero when no options are provided', () => {
    const { timeline, segment } = buildSegment();
    const scene = segment.addScene();

    expect(scene.atFrame).toBe(0);
    expect(scene.data).toEqual({});
    expect(segment.scenes).toContain(scene);
    timeline.destroy();
  });

  it('ignores a keyframe that belongs to another clip', () => {
    const { timeline, track } = buildSegment();
    const segmentA = track.addSegment({ name: 'a', duration: 1 });
    const segmentB = track.addSegment({ name: 'b', duration: 1 });
    const sceneB = segmentB.addScene({ atFrame: uiFrame(5), name: 'keep' });

    segmentA.removeScene(sceneB);

    expect(segmentA.scenes.length).toBe(0);
    expect(segmentB.scenes.length).toBe(1);
    expect(segmentB.scenes).toContain(sceneB);
    timeline.destroy();
  });

  it('clamps existing keyframes when the clip is retimed shorter', () => {
    const { timeline, segment } = buildSegment(2);
    segment.addScene({ atFrame: uiFrame(31), name: 'edge' });
    segment.addScene({ atFrame: uiFrame(46), name: 'beyond' });

    segment.duration = 1; // totalFrames 30 — 'beyond' must clamp back onto the clip

    expect(segment.totalFrames).toBe(30);
    expect(segment.scenes.map((scene) => scene.atFrame)).toEqual([uiFrame(31), uiFrame(31)]);
    timeline.destroy();
  });
});

describe('frame rate migration', () => {
  it('rescales start frame and keyframes when the project frame rate changes', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'clip', duration: 2, startFrame: uiFrame(31) });
    segment.addScene({ atFrame: uiFrame(31), name: 'mid' });

    timeline.frameRate = 60;

    expect(segment.startFrame).toBe(uiFrame(61));
    expect(segment.scenes[0].atFrame).toBe(uiFrame(61));
    expect(segment.totalFrames).toBe(120);
    timeline.destroy();
  });
});

describe('segment hydrate partials', () => {
  it('ignores an empty snapshot without losing state', () => {
    const { timeline, segment } = buildSegment();
    segment.addScene({ atFrame: uiFrame(5), name: 'keep' });
    const idBefore = segment.id;

    segment.hydrate({});

    expect(segment.id).toBe(idBefore);
    expect(segment.name).toBe('clip');
    expect(segment.scenes.length).toBe(1);
    timeline.destroy();
  });

  it('applies an id-only snapshot without touching options or scenes', () => {
    const { timeline, segment } = buildSegment();
    segment.addScene({ atFrame: uiFrame(5), name: 'keep' });

    segment.hydrate({ id: 'restored-clip-id' });

    expect(segment.id).toBe('restored-clip-id');
    expect(segment.name).toBe('clip');
    expect(segment.scenes.length).toBe(1);
    timeline.destroy();
  });

  it('applies an options-only snapshot without touching identity or scenes', () => {
    const { timeline, segment } = buildSegment();
    segment.addScene({ atFrame: uiFrame(5), name: 'keep' });
    const idBefore = segment.id;

    segment.hydrate({ options: { name: 'renamed', type: 'audio' } });

    expect(segment.id).toBe(idBefore);
    expect(segment.name).toBe('renamed');
    expect(segment.type).toBe('audio');
    expect(segment.scenes.length).toBe(1);
    timeline.destroy();
  });

  it('keeps a freshly generated keyframe id when the snapshot has none', () => {
    const { timeline, segment } = buildSegment();
    const source = segment.addScene({ atFrame: uiFrame(5), name: 'keep' }, { opacity: 0 });
    const snap = source.snapshot();
    // An empty id is treated as "no id" by the hydrate contract.
    snap.id = '';

    segment.hydrate({ scenes: [snap] });

    expect(segment.scenes.length).toBe(1);
    expect(segment.scenes[0].id).not.toBe('');
    expect(segment.scenes[0].atFrame).toBe(uiFrame(5));
    expect(segment.scenes[0].data).toEqual({ opacity: 0 });
    timeline.destroy();
  });
});

describe('zero-length clip ticking', () => {
  it('stays reset when the playhead moves beyond a zero-length clip', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const rulerTrack = timeline.addTrack({ name: 'video' });
    rulerTrack.addSegment({ name: 'clip', duration: 2 }); // keeps the project ruler non-empty
    const emptyTrack = timeline.addTrack({ name: 'empty' });
    const zero = emptyTrack.addSegment({ name: 'empty-clip', duration: 0 });

    timeline.scrub(uiFrame(10));

    expect(zero.frame).toBe(0);
    expect(zero.status).toBe('idle');
    timeline.destroy();
  });
});
