/**
 * BLIND persistence tests — app perspective.
 *
 * Oracle: snapshot / hydrate on timeline, track, segment, scene, marker ONLY.
 * App concern: save the editor project to disk and restore it later.
 * Every snapshot is plain serializable data; hydrate restores identity,
 * options and children.
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

function buildProject() {
  const timeline = new Timeline({ frameRate: 30, speed: 1 });
  const track = timeline.addTrack({ type: 'video', name: 'main', meta: { lane: 1 } });
  const segment = track.addSegment({
    type: 'video',
    name: 'intro',
    meta: { src: 'intro.mp4' },
    duration: 2,
    startFrame: uiFrame(30),
  });
  segment.addScene({ atFrame: 0, type: 'fade', name: 'in' }, { opacity: 0 });
  segment.addScene({ atFrame: uiFrame(30), type: 'fade', name: 'out' }, { opacity: 1 });
  timeline.addMarker({ atFrame: uiFrame(60), type: 'chapter', name: 'chorus', meta: { bar: 8 } });
  timeline.refresh();
  return timeline;
}

describe('timeline snapshot', () => {
  it('captures id, options, tracks and markers', () => {
    const timeline = buildProject();
    const snap = timeline.snapshot();
    expect(snap.id).toBe(timeline.id);
    expect(snap.options.frameRate).toBe(30);
    expect(snap.tracks.length).toBe(1);
    expect(snap.markers?.length).toBe(1);
    expect(snap.tracks[0].segments.length).toBe(1);
    expect(snap.tracks[0].segments[0].scenes?.length).toBe(2);
    timeline.destroy();
  });

  it('snapshot is JSON serializable', () => {
    const timeline = buildProject();
    const snap = timeline.snapshot();
    const revived = JSON.parse(JSON.stringify(snap));
    expect(revived.id).toBe(timeline.id);
    expect(revived.tracks[0].options.name).toBe('main');
    timeline.destroy();
  });
});

describe('timeline hydrate — restore a saved project', () => {
  it('restores tracks, segments, scenes and markers into a fresh timeline', () => {
    const saved = buildProject();
    const snap = saved.snapshot();
    saved.destroy();

    const restored = new Timeline({ frameRate: 30 });
    restored.hydrate(snap);
    expect(restored.id).toBe(snap.id);
    expect(restored.tracks.size).toBe(1);
    expect(restored.markers.size).toBe(1);

    const [track] = Array.from(restored.tracks);
    expect(track.name).toBe('main');
    expect(track.type).toBe('video');
    expect(track.segments.size).toBe(1);

    const [segment] = Array.from(track.segments);
    expect(segment.name).toBe('intro');
    expect(segment.startFrame).toBe(uiFrame(30));
    expect(segment.scenes.length).toBe(2);
    expect(segment.scenes[0].name).toBe('in');
    expect(segment.scenes[1].name).toBe('out');

    const [marker] = Array.from(restored.markers);
    expect(marker.name).toBe('chorus');
    expect(marker.atFrame).toBe(uiFrame(60));
    restored.destroy();
  });

  it('restores scene data payloads verbatim', () => {
    const saved = buildProject();
    const snap = saved.snapshot();
    saved.destroy();

    const restored = new Timeline({ frameRate: 30 });
    restored.hydrate(snap);
    const [track] = Array.from(restored.tracks);
    const [segment] = Array.from(track.segments);
    expect(segment.scenes[0].data).toEqual({ opacity: 0 });
    expect(segment.scenes[1].data).toEqual({ opacity: 1 });
    restored.destroy();
  });
});

describe('leaf snapshots', () => {
  it('segment snapshot captures identity and options', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'clip', type: 'video', duration: 2, startFrame: uiFrame(10) });
    const snap = segment.snapshot();
    expect(snap.id).toBe(segment.id);
    expect(snap.options.name).toBe('clip');
    expect(snap.options.startFrame).toBe(uiFrame(10));
    expect(snap.options.duration).toBe(2);
    timeline.destroy();
  });

  it('scene snapshot captures identity, options and data', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'webgl' });
    const segment = track.addSegment({ name: 'fx', duration: 2, startFrame: 0 });
    const scene = segment.addScene({ atFrame: uiFrame(12), name: 'glow', type: 'shader' }, { bloom: 1 });
    const snap = scene.snapshot();
    expect(snap.id).toBe(scene.id);
    expect(snap.options.atFrame).toBe(uiFrame(12));
    expect(snap.data).toEqual({ bloom: 1 });
    timeline.destroy();
  });

  it('marker snapshot captures identity and options', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = timeline.addMarker({ atFrame: uiFrame(25), name: 'hit', type: 'cue' });
    const snap = marker.snapshot();
    expect(snap.id).toBe(marker.id);
    expect(snap.options.atFrame).toBe(uiFrame(25));
    expect(snap.options.name).toBe('hit');
    timeline.destroy();
  });

  it('track snapshot captures identity, options and segments', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'lanes', type: 'video' });
    track.addSegment({ name: 's1', duration: 1, startFrame: 0 });
    const snap = track.snapshot();
    expect(snap.id).toBe(track.id);
    expect(snap.options.name).toBe('lanes');
    expect(snap.segments.length).toBe(1);
    timeline.destroy();
  });
});
