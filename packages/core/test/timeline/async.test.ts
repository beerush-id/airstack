/**
 * Async ticking — app perspective.
 *
 * App concern: a stage whose layers take time to draw a frame (a video seeking, a canvas or WebGL
 * render, an export encoding each frame). With async ticking on, the timeline waits for what the
 * handlers return before it moves on, so every frame is drawn; with a tolerance it waits only so
 * long, then follows the clock again; off, it never waits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timeline, type TimelineAsync } from '../../src/timeline/timeline.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function buildStage(async?: TimelineAsync) {
  const timeline = new Timeline({ frameRate: 30, async });
  const track = timeline.addTrack({ name: 'video' });
  const segment = track.addSegment({ name: 'shot', duration: 10, startFrame: 0 });
  timeline.refresh();
  return { timeline, segment };
}

/** A handler that takes `ms` to draw each frame, recording the frames it was given and finished. */
function slowLayer(ms: number) {
  const started: number[] = [];
  const finished: number[] = [];
  const aborted: number[] = [];
  const handler = (state: { frame: number }, signal: AbortSignal) => {
    const frame = state.frame;
    started.push(frame);
    signal.addEventListener('abort', () => aborted.push(frame), { once: true });
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        finished.push(frame);
        resolve();
      }, ms)
    );
  };
  return { handler, started, finished, aborted };
}

describe('async ticking — off', () => {
  it('is off unless asked for', () => {
    const { timeline } = buildStage();
    expect(timeline.async).toBe(false);
    timeline.destroy();
  });

  it('never waits: the frame counts as presented at once and scrub settles at once', async () => {
    const { timeline } = buildStage();
    const layer = slowLayer(500);
    timeline.subscribe(layer.handler);

    let settled = false;
    timeline.scrub(12).then(() => (settled = true));
    await Promise.resolve();

    expect(timeline.frame).toBe(12);
    expect(timeline.presented).toBe(12);
    expect(settled).toBe(true);
    timeline.destroy();
  });

  it('gives handlers a signal even when it never waits for them', () => {
    const { timeline } = buildStage();
    let signal: AbortSignal | undefined;
    timeline.subscribe((_, given) => {
      signal = given;
    });
    timeline.scrub(3);
    expect(signal).toBeInstanceOf(AbortSignal);
    timeline.destroy();
  });
});

describe('async ticking — on', () => {
  it('holds a scrub until the layer has drawn the frame', async () => {
    const { timeline } = buildStage(true);
    const layer = slowLayer(200);
    timeline.subscribe(layer.handler);

    let settled = false;
    const scrubbed = timeline.scrub(15).then(() => (settled = true));

    expect(timeline.frame).toBe(15); // the playhead moves at once
    expect(timeline.presented).toBe(0); // the stage hasn't drawn it yet
    await vi.advanceTimersByTimeAsync(199);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await scrubbed;
    expect(timeline.presented).toBe(15);
    timeline.destroy();
  });

  it('waits for segment subscribers and keyframe transitions too', async () => {
    const { timeline, segment } = buildStage(true);
    segment.addScene({ atFrame: 0, name: 'in' }, { opacity: 0 });
    segment.addScene({ atFrame: 30, name: 'out' }, { opacity: 1 });
    const drawn: string[] = [];
    segment.subscribe(() => new Promise<void>((resolve) => setTimeout(() => (drawn.push('segment'), resolve()), 50)));
    segment.onTransition(() => new Promise<void>((resolve) => setTimeout(() => (drawn.push('transition'), resolve()), 100)));

    const scrubbed = timeline.scrub(10);
    await vi.advanceTimersByTimeAsync(60);
    expect(timeline.presented).not.toBe(10); // the transition is still drawing

    await vi.advanceTimersByTimeAsync(40);
    await scrubbed;
    expect(drawn).toEqual(['segment', 'transition']);
    expect(timeline.presented).toBe(10);
    timeline.destroy();
  });

  it('lets the latest frame win: a newer scrub aborts the one still drawing', async () => {
    const { timeline } = buildStage(true);
    const layer = slowLayer(200);
    timeline.subscribe(layer.handler);

    let firstSettled = false;
    timeline.scrub(10).then(() => (firstSettled = true));
    await vi.advanceTimersByTimeAsync(50);
    const second = timeline.scrub(20);

    expect(layer.aborted).toContain(10);
    await vi.advanceTimersByTimeAsync(0);
    expect(firstSettled).toBe(true); // replaced, so it stops waiting

    await vi.advanceTimersByTimeAsync(200);
    await second;
    expect(timeline.presented).toBe(20); // never 10
    timeline.destroy();
  });

  it('reports a failing layer and still counts the frame as drawn', async () => {
    const { timeline } = buildStage(true);
    const failures: Array<[unknown, number]> = [];
    timeline.onError((error, frame) => failures.push([error, frame]));
    timeline.subscribe(() => Promise.reject(new Error('texture lost')));

    await timeline.scrub(8);

    expect(failures).toHaveLength(1);
    expect((failures[0][0] as Error).message).toBe('texture lost');
    expect(failures[0][1]).toBe(8);
    expect(timeline.presented).toBe(8);
    timeline.destroy();
  });

  it('ignores handlers that return plain values', async () => {
    const { timeline } = buildStage(true);
    timeline.subscribe((state) => state.frame * 2);
    await timeline.scrub(4);
    expect(timeline.presented).toBe(4);
    timeline.destroy();
  });

  it('plays every frame in order when drawing is slower than the frame rate', async () => {
    const { timeline } = buildStage(true);
    const layer = slowLayer(100); // three frames' worth of time per frame at 30fps
    timeline.subscribe(layer.handler);

    timeline.play();
    await vi.advanceTimersByTimeAsync(2000);
    timeline.pause();

    const drawn = layer.finished;
    expect(drawn.length).toBeGreaterThan(5);
    for (let i = 1; i < drawn.length; i++) {
      expect(drawn[i]).toBe(drawn[i - 1] + 1); // no frame skipped
    }
    timeline.destroy();
  });
});

describe('async ticking — tolerance', () => {
  it('stops waiting for a frame after its tolerance and aborts it', async () => {
    const { timeline } = buildStage({ tolerance: 50 });
    const layer = slowLayer(1000);
    timeline.subscribe(layer.handler);

    let settled = false;
    const scrubbed = timeline.scrub(6).then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(49);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await scrubbed;
    expect(layer.aborted).toContain(6);
    expect(timeline.presented).toBe(0); // it never finished drawing
    timeline.destroy();
  });

  it('follows the clock during playback, dropping frames a slow layer cannot keep up with', async () => {
    const { timeline } = buildStage({ tolerance: 40 });
    const layer = slowLayer(100);
    timeline.subscribe(layer.handler);

    timeline.play();
    await vi.advanceTimersByTimeAsync(1000);
    const reached = timeline.frame;
    timeline.pause();

    const started = layer.started;
    const skipped = started.some((frame, i) => i > 0 && frame > started[i - 1] + 1);
    expect(skipped).toBe(true);
    expect(reached).toBeGreaterThan(20); // kept close to the 30 frames a second of time holds
    timeline.destroy();
  });

  it('can be switched at runtime', async () => {
    const { timeline } = buildStage();
    timeline.async = { tolerance: 30 };
    expect(timeline.async).toEqual({ tolerance: 30 });

    const layer = slowLayer(500);
    timeline.subscribe(layer.handler);
    const scrubbed = timeline.scrub(2);
    await vi.advanceTimersByTimeAsync(30);
    await scrubbed;
    expect(layer.aborted).toContain(2);
    timeline.destroy();
  });
});
