/**
 * BLIND journey: live playback under time — app perspective.
 * Viewer presses play and the cut actually advances; pause
 * freezes it, stop returns to head. Uses fake timers so the
 * rAF/setTimeout loop advances without real waiting.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timeline } from '../../src/timeline/timeline.js';
import { uiFrame } from './fixture.js';

function buildFeature() {
  const timeline = new Timeline({ frameRate: 30 });
  const video = timeline.addTrack({ name: 'video' });
  video.addSegment({ name: 'feature', duration: 10, startFrame: 0 });
  timeline.refresh();
  return timeline;
}

describe('live playback journey', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('play advances frames as time passes', () => {
    const timeline = buildFeature();
    timeline.play();
    expect(timeline.status).toBe('playing');
    const start = timeline.frame;
    vi.advanceTimersByTime(500);
    expect(timeline.frame).toBeGreaterThan(start);
    timeline.stop();
    timeline.destroy();
  });

  it('pause freezes advancement', () => {
    const timeline = buildFeature();
    timeline.play();
    vi.advanceTimersByTime(300);
    timeline.pause();
    const frozen = timeline.frame;
    vi.advanceTimersByTime(500);
    expect(timeline.frame).toBe(frozen);
    expect(timeline.status).toBe('idle');
    timeline.destroy();
  });

  it('subscribers hear advancement while playing', () => {
    const timeline = buildFeature();
    const frames: number[] = [];
    const off = timeline.subscribe((s) => frames.push(s.frame));
    timeline.play();
    vi.advanceTimersByTime(400);
    off();
    timeline.stop();
    expect(frames.length).toBeGreaterThan(2);
    timeline.destroy();
  });

  it('play advances exact rate at 30fps', () => {
    const timeline = buildFeature();
    timeline.play();
    vi.advanceTimersByTime(1000);
    expect(timeline.frame).toBe(uiFrame(30));
    timeline.stop();
    timeline.destroy();
  });

  it('speed 2 advances double frames', () => {
    const timeline = buildFeature();
    timeline.speed = 2;
    timeline.play();
    vi.advanceTimersByTime(1000);
    expect(timeline.frame).toBe(uiFrame(60));
    timeline.stop();
    timeline.destroy();
  });

  it('segments stay in sync while playing', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'feature', duration: 10, startFrame: 0 });
    timeline.refresh();
    timeline.play();
    vi.advanceTimersByTime(1000);
    expect(timeline.frame).toBe(uiFrame(30));
    expect(segment.frame).toBe(uiFrame(30));
    expect(segment.active).toBe(true);
    timeline.stop();
    timeline.destroy();
  });
});
