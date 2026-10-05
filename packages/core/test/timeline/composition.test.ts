/**
 * BLIND composition tests — app perspective.
 *
 * Oracle: timeline.d.ts, track.d.ts, segment.d.ts, scene.d.ts, marker.d.ts ONLY.
 * App concern: an editor builds lanes (tracks), clips (segments),
 * keyframes (scenes) and cue points (markers), labels them for drivers
 * and the editor UI, then removes them.
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

describe('tracks — editor lanes', () => {
  it('addTrack registers a lane with a unique id', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const a = timeline.addTrack({ name: 'video', type: 'video' });
    const b = timeline.addTrack({ name: 'audio', type: 'audio' });
    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
    expect(timeline.tracks.size).toBe(2);
    timeline.destroy();
  });

  it('track type / name / meta round-trip for driver routing and editor labels', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ type: 'webgl', name: 'hero-fx', meta: { lane: 'hero' } });
    expect(track.type).toBe('webgl');
    expect(track.name).toBe('hero-fx');
    expect(track.meta).toEqual({ lane: 'hero' });
    track.type = 'html';
    track.name = 'hero-dom';
    track.meta = { lane: 'fallback' };
    expect(track.type).toBe('html');
    expect(track.name).toBe('hero-dom');
    expect(track.meta).toEqual({ lane: 'fallback' });
    timeline.destroy();
  });

  it('removeTrack detaches the lane', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'temp' });
    expect(timeline.tracks.size).toBe(1);
    timeline.removeTrack(track);
    expect(timeline.tracks.size).toBe(0);
    timeline.destroy();
  });

  it('track.remove() detaches itself from the timeline', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'self-remove' });
    track.remove();
    expect(timeline.tracks.size).toBe(0);
    timeline.destroy();
  });
});

describe('segments — clips on a lane', () => {
  it('addSegment registers a clip on its track', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'intro', duration: 2, startFrame: uiFrame(1) });
    expect(segment.id).toBeTruthy();
    expect(track.segments.size).toBe(1);
    expect(track.segments.has(segment)).toBe(true);
    timeline.destroy();
  });

  it('segment type / name / meta round-trip', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({
      name: 'intro',
      type: 'video',
      meta: { src: 'intro.mp4' },
      duration: 2,
      startFrame: uiFrame(1),
    });
    expect(segment.type).toBe('video');
    expect(segment.name).toBe('intro');
    expect(segment.meta).toEqual({ src: 'intro.mp4' });
    timeline.destroy();
  });

  it('removeSegment detaches the clip', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'drop-me', duration: 1, startFrame: uiFrame(1) });
    track.removeSegment(segment);
    expect(track.segments.size).toBe(0);
    timeline.destroy();
  });

  it('segment.remove() detaches itself from its track', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'self-drop', duration: 1, startFrame: uiFrame(1) });
    segment.remove();
    expect(track.segments.size).toBe(0);
    timeline.destroy();
  });
});

describe('scenes — keyframes inside a clip', () => {
  it('addScene registers keyframes ordered by atFrame', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'webgl' });
    const segment = track.addSegment({ name: 'fx', duration: 4, startFrame: uiFrame(1) });
    const first = segment.addScene({ atFrame: uiFrame(30), name: 'mid' });
    const zero = segment.addScene({ atFrame: uiFrame(1), name: 'start' });
    segment.sortScenes();
    expect(segment.scenes.length).toBe(2);
    expect(segment.scenes[0].id).toBe(zero.id);
    expect(segment.scenes[1].id).toBe(first.id);
    timeline.destroy();
  });

  it('scene type / name / meta / data round-trip as driver payload', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'webgl' });
    const segment = track.addSegment({ name: 'fx', duration: 2, startFrame: uiFrame(1) });
    const scene = segment.addScene({ atFrame: uiFrame(10), type: 'shader', name: 'glow' }, { intensity: 0.8 });
    expect(scene.type).toBe('shader');
    expect(scene.name).toBe('glow');
    expect(scene.data).toEqual({ intensity: 0.8 });
    scene.type = 'gsap';
    scene.name = 'fade';
    scene.meta = { ease: 'power2.out' };
    scene.data = { opacity: 0 };
    expect(scene.type).toBe('gsap');
    expect(scene.name).toBe('fade');
    expect(scene.meta).toEqual({ ease: 'power2.out' });
    expect(scene.data).toEqual({ opacity: 0 });
    timeline.destroy();
  });

  it('removeScene detaches the keyframe', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'webgl' });
    const segment = track.addSegment({ name: 'fx', duration: 2, startFrame: uiFrame(1) });
    const scene = segment.addScene({ atFrame: uiFrame(5), name: 'drop' });
    expect(segment.scenes.length).toBe(1);
    segment.removeScene(scene);
    expect(segment.scenes.length).toBe(0);
    timeline.destroy();
  });

  it('scene.remove() detaches itself from its segment', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'webgl' });
    const segment = track.addSegment({ name: 'fx', duration: 2, startFrame: uiFrame(1) });
    const scene = segment.addScene({ atFrame: uiFrame(5), name: 'self-drop' });
    scene.remove();
    expect(segment.scenes.length).toBe(0);
    timeline.destroy();
  });
});

describe('markers — cue points on the master ruler', () => {
  it('addMarker registers a cue with a unique id', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const a = timeline.addMarker({ atFrame: uiFrame(30), name: 'chapter-1', type: 'chapter' });
    const b = timeline.addMarker({ atFrame: uiFrame(60), name: 'chapter-2', type: 'chapter' });
    expect(a.id).not.toBe(b.id);
    expect(timeline.markers.size).toBe(2);
    timeline.destroy();
  });

  it('marker type / name / meta round-trip', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = timeline.addMarker({ atFrame: uiFrame(30), type: 'cue', name: 'beat', meta: { bar: 4 } });
    expect(marker.type).toBe('cue');
    expect(marker.name).toBe('beat');
    expect(marker.meta).toEqual({ bar: 4 });
    timeline.destroy();
  });

  it('removeMarker detaches the cue', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = timeline.addMarker({ atFrame: uiFrame(30), name: 'temp-cue' });
    timeline.removeMarker(marker);
    expect(timeline.markers.size).toBe(0);
    timeline.destroy();
  });

  it('marker.remove() detaches itself from the timeline', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = timeline.addMarker({ atFrame: uiFrame(30), name: 'self-drop' });
    marker.remove();
    expect(timeline.markers.size).toBe(0);
    timeline.destroy();
  });
});
