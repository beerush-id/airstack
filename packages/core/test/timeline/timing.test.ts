/**
 * BLIND timeline timing tests — app perspective.
 *
 * Oracle: timeline.d.ts, segment.d.ts, scene.d.ts, marker.d.ts ONLY.
 * App concern: an editor thinks in seconds, the engine thinks in frames.
 * frameRate is the single bridge. All conversions below are spec literals.
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

describe('timeline frameRate bridge', () => {
  it('defaults are observable and frameRate round-trips', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'main', duration: 4, startFrame: 0 });
    timeline.refresh();
    expect(timeline.frameRate).toBe(30);
    timeline.frameRate = 60;
    expect(timeline.frameRate).toBe(60);
    timeline.destroy();
  });

  it('at 60fps frame 60 means 1 second', () => {
    const timeline = new Timeline({ frameRate: 60 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'main', duration: 4, startFrame: 0 });
    timeline.refresh();
    timeline.scrub(uiFrame(60));
    expect(timeline.time).toBe(1);
    timeline.destroy();
  });

  it('at 30fps time 1 means frame 30', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'main', duration: 4, startFrame: 0 });
    timeline.refresh();
    timeline.seek(1);
    expect(timeline.frame).toBe(uiFrame(30));
    timeline.destroy();
  });

  it('speed round-trips as a plain property', () => {
    const timeline = new Timeline({ frameRate: 30, speed: 1 });
    expect(timeline.speed).toBe(1);
    timeline.speed = 2;
    expect(timeline.speed).toBe(2);
    timeline.destroy();
  });

  it('startFrame and endFrame round-trip as bounds', () => {
    const timeline = new Timeline({ frameRate: 30, startFrame: uiFrame(10), endFrame: uiFrame(100) });
    expect(timeline.startFrame).toBe(uiFrame(10));
    expect(timeline.endFrame).toBe(uiFrame(100));
    timeline.startFrame = 0;
    timeline.endFrame = uiFrame(90);
    expect(timeline.startFrame).toBe(0);
    expect(timeline.endFrame).toBe(uiFrame(90));
    timeline.destroy();
  });
});

describe('segment timing — duration / start / totals', () => {
  it('segment startFrame 30 at 30fps exposes startTime 1', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'clip-a', duration: 2, startFrame: uiFrame(30) });
    expect(segment.startFrame).toBe(uiFrame(30));
    expect(segment.startTime).toBe(1);
    timeline.destroy();
  });

  it('segment startTime 2 at 30fps exposes startFrame 60', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'clip-b', duration: 2, startFrame: 0 });
    segment.startTime = 2;
    expect(segment.startFrame).toBe(uiFrame(60));
    expect(segment.startTime).toBe(2);
    timeline.destroy();
  });

  it('2 second segment at 30fps totals 60 frames and 2 seconds', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'clip-c', duration: 2, startFrame: 0 });
    expect(segment.totalTime).toBe(2);
    expect(segment.totalFrames).toBe(60);
    timeline.destroy();
  });

  it('duration round-trips and refresh keeps totals in sync', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'clip-d', duration: 1, startFrame: 0 });
    expect(segment.duration).toBe(1);
    segment.duration = 3;
    segment.refresh();
    expect(segment.duration).toBe(3);
    expect(segment.totalTime).toBe(3);
    expect(segment.totalFrames).toBe(90);
    timeline.destroy();
  });
});

describe('scene and marker timing', () => {
  it('scene atFrame 15 at 30fps exposes atTime 0.5', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'webgl' });
    const segment = track.addSegment({ name: 'fx', duration: 4, startFrame: 0 });
    const scene = segment.addScene({ atFrame: uiFrame(15), name: 'key-a' });
    expect(scene.atFrame).toBe(uiFrame(15));
    expect(scene.atTime).toBe(0.5);
    timeline.destroy();
  });

  it('scene atTime 1 at 30fps exposes atFrame 30', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'webgl' });
    const segment = track.addSegment({ name: 'fx', duration: 4, startFrame: 0 });
    const scene = segment.addScene({ atFrame: 0, name: 'key-b' });
    scene.atTime = 1;
    expect(scene.atFrame).toBe(uiFrame(30));
    expect(scene.atTime).toBe(1);
    timeline.destroy();
  });

  it('marker atFrame 60 at 30fps exposes atTime 2', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = timeline.addMarker({ atFrame: uiFrame(60), name: 'chapter-1' });
    expect(marker.atFrame).toBe(uiFrame(60));
    expect(marker.atTime).toBe(2);
    timeline.destroy();
  });

  it('marker atTime 3 at 30fps exposes atFrame 90', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = timeline.addMarker({ atFrame: 0, name: 'chapter-2' });
    marker.atTime = 3;
    expect(marker.atFrame).toBe(uiFrame(90));
    expect(marker.atTime).toBe(3);
    timeline.destroy();
  });
});

describe('repeat cycles', () => {
  it('single-play segment reports 1 cycle', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'once', duration: 1, startFrame: 0 });
    expect(segment.cycles).toBe(1);
    timeline.destroy();
  });

  it('repeat 2 reports 3 cycles', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'thrice', duration: 1, startFrame: 0, repeat: 2 });
    expect(segment.repeat).toBe(2);
    expect(segment.cycles).toBe(3);
    timeline.destroy();
  });

  it('infinite repeat counts as a single laid-out cycle', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'audio' });
    const segment = track.addSegment({ name: 'loop', duration: 1, startFrame: 0, repeat: true });
    expect(segment.repeat).toBe(true);
    expect(segment.cycles).toBe(1);
    timeline.destroy();
  });
});
