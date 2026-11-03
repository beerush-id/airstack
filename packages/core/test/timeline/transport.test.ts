/**
 * BLIND timeline transport tests — app perspective.
 *
 * Oracle: packages/core/dist/timeline/timeline.d.ts ONLY.
 * No src reads, no runs. Consumer promises only.
 *
 * App concern: transport controls an editor user walks:
 * play / pause / stop / seek(time) / scrub(frame) / step(delta).
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

function freshTransportTimeline() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'video', type: 'video' });
  track.addSegment({ name: 'main', duration: 4, startFrame: 0 });
  timeline.refresh();
  return timeline;
}

describe('timeline transport — play / pause / stop', () => {
  it('starts idle at frame 0 and time 0', () => {
    const timeline = freshTransportTimeline();
    expect(timeline.frame).toBe(0);
    expect(timeline.time).toBe(0);
    expect(timeline.status).toBe('idle');
    timeline.destroy();
  });

  it('play() moves status to playing and returns a pause teardown', () => {
    const timeline = freshTransportTimeline();
    const pause = timeline.play();
    expect(timeline.status).toBe('playing');
    expect(typeof pause).toBe('function');
    pause();
    timeline.destroy();
  });

  it('pause() returns status to idle without resetting playhead', () => {
    const timeline = freshTransportTimeline();
    timeline.scrub(uiFrame(30));
    timeline.play();
    timeline.pause();
    expect(timeline.status).toBe('idle');
    expect(timeline.frame).toBe(uiFrame(30));
    expect(timeline.time).toBe(1);
    timeline.destroy();
  });

  it('stop() resets playhead to 0 and status to idle', () => {
    const timeline = freshTransportTimeline();
    timeline.scrub(uiFrame(45));
    timeline.play();
    timeline.stop();
    expect(timeline.frame).toBe(0);
    expect(timeline.time).toBe(0);
    expect(timeline.status).toBe('idle');
    timeline.destroy();
  });

  it('play(startFrame) starts from the given frame', () => {
    const timeline = freshTransportTimeline();
    const pause = timeline.play(uiFrame(60));
    expect(timeline.frame).toBe(uiFrame(60));
    expect(timeline.time).toBe(2);
    pause();
    timeline.destroy();
  });
});

describe('timeline transport — seek / scrub / step', () => {
  it('seek(2) moves playhead to frame 60 at 30fps', () => {
    const timeline = freshTransportTimeline();
    timeline.seek(2);
    expect(timeline.frame).toBe(uiFrame(60));
    expect(timeline.time).toBe(2);
    timeline.destroy();
  });

  it('scrub(30) moves playhead to time 1 at 30fps', () => {
    const timeline = freshTransportTimeline();
    timeline.scrub(uiFrame(30));
    expect(timeline.frame).toBe(uiFrame(30));
    expect(timeline.time).toBe(1);
    timeline.destroy();
  });

  it('scrub(0) returns to start', () => {
    const timeline = freshTransportTimeline();
    timeline.scrub(uiFrame(90));
    timeline.scrub(0);
    expect(timeline.frame).toBe(0);
    expect(timeline.time).toBe(0);
    timeline.destroy();
  });

  it('step() advances by one frame by default', () => {
    const timeline = freshTransportTimeline();
    timeline.scrub(uiFrame(10));
    timeline.step();
    expect(timeline.frame).toBe(uiFrame(11));
    timeline.destroy();
  });

  it('step(5) advances by five frames', () => {
    const timeline = freshTransportTimeline();
    timeline.scrub(uiFrame(10));
    timeline.step(5);
    expect(timeline.frame).toBe(uiFrame(15));
    timeline.destroy();
  });

  it('step(-3) rewinds by three frames', () => {
    const timeline = freshTransportTimeline();
    timeline.scrub(uiFrame(10));
    timeline.step(-3);
    expect(timeline.frame).toBe(uiFrame(7));
    timeline.destroy();
  });

  it('setting frame updates time to match frameRate', () => {
    const timeline = freshTransportTimeline();
    timeline.frame = uiFrame(90);
    expect(timeline.time).toBe(3);
    timeline.destroy();
  });

  it('setting time updates frame to match frameRate', () => {
    const timeline = freshTransportTimeline();
    timeline.time = 3;
    expect(timeline.frame).toBe(uiFrame(90));
    timeline.destroy();
  });
});
