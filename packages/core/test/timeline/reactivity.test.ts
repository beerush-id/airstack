/**
 * BLIND reactivity tests — app perspective.
 *
 * Oracle: timeline.d.ts subscribe, segment.d.ts subscribe / onTransition ONLY.
 * App concern: the editor preview and the renderer stay in sync.
 * subscribe() drives the preview clock; onTransition() drives keyframe
 * blending between activeScene and nextScene with normalized progress.
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

describe('timeline.subscribe — preview clock', () => {
  it('receives frame 30 with time 1 after scrub(30) at 30fps', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'main', duration: 4, startFrame: uiFrame(1) });
    timeline.refresh();
    const seen: number[] = [];
    const off = timeline.subscribe((state) => {
      seen.push(state.frame);
    });
    timeline.scrub(uiFrame(30));
    expect(seen).toContain(uiFrame(30));
    off();
    timeline.destroy();
  });

  it('state carries time, frame, status, totalTime and totalFrames', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'main', duration: 4, startFrame: uiFrame(1) });
    timeline.refresh();
    let last: { time: number; frame: number; status: string; totalTime: number; totalFrames: number } | undefined;
    const off = timeline.subscribe((state) => {
      last = { ...state };
    });
    timeline.scrub(uiFrame(60));
    expect(last?.frame).toBe(uiFrame(60));
    expect(last?.time).toBe(2);
    expect(last?.status).toBe('idle');
    expect(typeof last?.totalTime).toBe('number');
    expect(typeof last?.totalFrames).toBe('number');
    off();
    timeline.destroy();
  });

  it('teardown stops further notifications', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'main', duration: 4, startFrame: uiFrame(1) });
    timeline.refresh();
    let calls = 0;
    const off = timeline.subscribe(() => {
      calls += 1;
    });
    timeline.scrub(uiFrame(10));
    const afterFirst = calls;
    off();
    timeline.scrub(uiFrame(20));
    expect(calls).toBe(afterFirst);
    timeline.destroy();
  });

  it('segment.subscribe receives local frame after seek into its window', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'clip', duration: 2, startFrame: uiFrame(1) });
    const frames: number[] = [];
    const off = segment.subscribe((state) => {
      frames.push(state.frame);
    });
    timeline.scrub(uiFrame(30));
    expect(frames.length).toBeGreaterThan(0);
    off();
    timeline.destroy();
  });
});

describe('segment.onTransition — keyframe blending', () => {
  it('between scenes at 0 and 30, scrub to 15 reports progress 0.5', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'webgl' });
    const segment = track.addSegment({ name: 'fx', duration: 2, startFrame: uiFrame(1) });
    segment.addScene({ atFrame: uiFrame(1), name: 'from' }, { opacity: 0 });
    segment.addScene({ atFrame: uiFrame(30), name: 'to' }, { opacity: 1 });

    let progress = -1;
    const off = segment.onTransition((state) => {
      progress = state.progress;
    });
    timeline.scrub(uiFrame(15));
    expect(progress).toBe(0.5);
    off();
    timeline.destroy();
  });

  it('exposes from at 0 and to at 30 with frame 15 and time 0.5', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'webgl' });
    const segment = track.addSegment({ name: 'fx', duration: 2, startFrame: uiFrame(1) });
    const from = segment.addScene({ atFrame: uiFrame(1), name: 'from' });
    const to = segment.addScene({ atFrame: uiFrame(30), name: 'to' });

    let snapshot: { fromFrame: number; toFrame?: number; frame: number; time: number } | undefined;
    const off = segment.onTransition((state) => {
      snapshot = {
        fromFrame: state.from.atFrame,
        toFrame: state.to?.atFrame,
        frame: state.frame,
        time: state.time,
      };
    });
    timeline.scrub(uiFrame(15));
    expect(snapshot?.fromFrame).toBe(from.atFrame);
    expect(snapshot?.toFrame).toBe(to.atFrame);
    expect(snapshot?.frame).toBe(uiFrame(15));
    expect(snapshot?.time).toBe(0.5);
    off();
    timeline.destroy();
  });

  it('activeScene is the keyframe at or before the playhead', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'webgl' });
    const segment = track.addSegment({ name: 'fx', duration: 3, startFrame: uiFrame(1) });
    const first = segment.addScene({ atFrame: uiFrame(1), name: 'first' });
    segment.addScene({ atFrame: uiFrame(60), name: 'second' });
    timeline.scrub(uiFrame(30));
    expect(segment.activeScene?.id).toBe(first.id);
    expect(segment.nextScene?.atFrame).toBe(uiFrame(60));
    timeline.destroy();
  });

  it('onTransition teardown stops blending callbacks', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'webgl' });
    const segment = track.addSegment({ name: 'fx', duration: 2, startFrame: uiFrame(1) });
    segment.addScene({ atFrame: uiFrame(1), name: 'a' });
    segment.addScene({ atFrame: uiFrame(30), name: 'b' });
    let calls = 0;
    const off = segment.onTransition(() => {
      calls += 1;
    });
    timeline.scrub(uiFrame(10));
    const afterFirst = calls;
    off();
    timeline.scrub(uiFrame(20));
    expect(calls).toBe(afterFirst);
    timeline.destroy();
  });
});
