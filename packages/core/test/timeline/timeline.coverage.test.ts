/**
 * Coverage timeline tests — public factory entry, transport edges, end-of-timeline
 * playback handling, frameRate / speed setter migrations, and hydrate partial branches.
 *
 * Oracle: timeline.d.ts ONLY.
 * App concern: a viewer idly taps play after the cut finished, re-times the
 * project (frame rate / speed) mid-flight, plays projects that loop or run
 * once, and applies partial project patches (frame rate changes, track swaps)
 * onto a live timeline.
 *
 * Normal playback, scrubbing, landmarks and full-snapshot hydrate are already
 * covered by the transport / playback / persistence journeys.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frameToTime } from '../../src/timeline/helper.js';
import { createTimeline, Timeline } from '../../src/timeline/timeline.js';
import { uiFrame } from './fixture.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function buildTimeline(duration = 2) {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'video' });
  track.addSegment({ name: 'clip', duration, startFrame: 0 });
  timeline.refresh();
  return timeline;
}

describe('construction defaults', () => {
  it('defaults to 30fps single playback when no options are provided', () => {
    const timeline = new Timeline();

    expect(timeline.frameRate).toBe(30);
    expect(timeline.repeat).toBeUndefined();
    expect(timeline.frame).toBe(0);
    expect(timeline.status).toBe('idle');

    timeline.destroy();
  });

  it('builds a coordinator that honours every factory option', () => {
    const timeline = createTimeline({ frameRate: 24, speed: 2, startFrame: 0, endFrame: 24, repeat: true });

    expect(timeline).toBeInstanceOf(Timeline);
    expect(timeline.frameRate).toBe(24);
    expect(timeline.speed).toBe(2);
    expect(timeline.startFrame).toBe(0);
    expect(timeline.endFrame).toBe(24);
    expect(timeline.repeat).toBe(true);
    expect(timeline.totalFrames).toBe(0);

    timeline.destroy();
  });

  it('falls back to class defaults when the factory is called without options', () => {
    const timeline = createTimeline();

    expect(timeline.frameRate).toBe(30);
    expect(timeline.speed).toBe(1);
    expect(timeline.startFrame).toBeUndefined();
    expect(timeline.endFrame).toBeUndefined();
    expect(timeline.repeat).toBeUndefined();
    expect(timeline.status).toBe('idle');

    timeline.destroy();
  });
});

describe('frameRate setter', () => {
  it('ignores a frame rate that matches the current one', () => {
    const timeline = buildTimeline();
    const marker = timeline.addMarker({ atFrame: 30, name: 'cue' });

    timeline.frameRate = 30;

    expect(timeline.frameRate).toBe(30);
    expect(marker.atFrame).toBe(30);
    timeline.destroy();
  });

  it('rescales playhead, workarea bounds and markers when the rate changes', () => {
    const timeline = new Timeline({ frameRate: 30, startFrame: 30, endFrame: 90 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'clip', duration: 2 });
    const marker = timeline.addMarker({ atFrame: 30, name: 'cue' });
    timeline.scrub(45); // within [startFrame 30, endFrame 90]

    timeline.frameRate = 60;

    expect(timeline.startFrame).toBe(60);
    expect(timeline.endFrame).toBe(180);
    expect(timeline.frame).toBe(90);
    expect(timeline.time).toBe(frameToTime(90, 60));
    expect(marker.atFrame).toBe(60);
    timeline.destroy();
  });

  it('keeps playing when the rate changes mid-flight', () => {
    const timeline = buildTimeline();
    timeline.play();
    vi.advanceTimersByTime(100);
    expect(timeline.status).toBe('playing');

    timeline.frameRate = 60;

    expect(timeline.status).toBe('playing');
    expect(timeline.frame).toBeGreaterThan(0);
    timeline.stop();
    timeline.destroy();
  });
});

describe('speed', () => {
  it('falls back to speed 1 when constructed with an explicit undefined', () => {
    const timeline = new Timeline({ frameRate: 30, speed: undefined });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'clip', duration: 2 });

    expect(timeline.speed).toBe(1);

    timeline.play();
    vi.advanceTimersByTime(1000);
    expect(timeline.frame).toBe(29); // fallback speed advances at the normal rate; frame 30 starts at 1s
    timeline.stop();
    timeline.destroy();
  });

  it('reschedules playback when speed changes mid-flight', () => {
    const timeline = buildTimeline(10);
    timeline.play();
    vi.advanceTimersByTime(100);
    const before = timeline.frame;

    timeline.speed = 2;

    expect(timeline.status).toBe('playing');
    vi.advanceTimersByTime(500);
    expect(timeline.frame).toBeGreaterThan(before);
    timeline.stop();
    timeline.destroy();
  });
});

describe('track and marker registry', () => {
  it('adds an unlabeled track and an unpositioned marker when no options are provided', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack();
    const marker = timeline.addMarker();

    expect(track.name).toBeUndefined();
    expect(timeline.tracks.has(track)).toBe(true);
    expect(marker.atFrame).toBe(0);
    expect(timeline.markers.has(marker)).toBe(true);
    timeline.destroy();
  });

  it('ignores a track that belongs to another timeline', () => {
    const host = new Timeline({ frameRate: 30 });
    const donor = new Timeline({ frameRate: 30 });
    const donorTrack = donor.addTrack({ name: 'donor' });
    donorTrack.addSegment({ name: 'clip', duration: 1 });

    host.removeTrack(donorTrack);

    expect(host.tracks.size).toBe(0);
    expect(donor.tracks.size).toBe(1);
    expect(donorTrack.segments.size).toBe(1); // untouched — no destroy, no refresh
    host.destroy();
    donor.destroy();
  });
});

describe('play transport edges', () => {
  it('returns a pause teardown without restarting when already playing', () => {
    const timeline = buildTimeline();
    const first = timeline.play();
    const before = timeline.frame;

    const second = timeline.play();

    expect(timeline.status).toBe('playing');
    expect(timeline.frame).toBe(before);
    second(); // teardown pauses the running playback
    expect(timeline.status).toBe('idle');
    first();
    timeline.destroy();
  });

  it('clamps to the end and stays idle when starting beyond the cut', () => {
    const timeline = buildTimeline();

    const teardown = timeline.play(9999);

    expect(timeline.status).toBe('idle');
    expect(timeline.frame).toBe(59); // duration 2 @ 30fps → last frame 59
    expect(timeline.time).toBe(frameToTime(59, 30));
    teardown();
    timeline.destroy();
  });

  it('restarts from the head after the cut has finished', () => {
    const timeline = buildTimeline();
    timeline.play();
    vi.advanceTimersByTime(2200);
    expect(timeline.status).toBe('idle');
    expect(timeline.frame).toBe(59);

    timeline.play();

    expect(timeline.status).toBe('playing');
    expect(timeline.frame).toBe(0);
    timeline.stop();
    timeline.destroy();
  });
});

describe('end-of-timeline handling', () => {
  it('ends idle at the last frame for a single play', () => {
    const timeline = buildTimeline();

    timeline.play();
    vi.advanceTimersByTime(2200);

    expect(timeline.status).toBe('idle');
    expect(timeline.frame).toBe(59);
    timeline.destroy();
  });

  it('wraps continuously while repeat is true', () => {
    const timeline = buildTimeline();
    timeline.repeat = true;

    timeline.play();
    vi.advanceTimersByTime(2200);

    expect(timeline.status).toBe('playing'); // wrapped instead of ending
    expect(timeline.frame).toBeLessThan(uiFrame(60));
    timeline.stop();
    timeline.destroy();
  });

  it('wraps a fixed number of times then ends for numeric repeat', () => {
    const timeline = buildTimeline();
    timeline.repeat = 2;

    timeline.play();
    vi.advanceTimersByTime(2100);
    expect(timeline.status).toBe('playing'); // first wrap consumed

    vi.advanceTimersByTime(2200);
    expect(timeline.status).toBe('playing'); // second wrap consumed

    vi.advanceTimersByTime(2200);
    expect(timeline.status).toBe('idle'); // third cycle exhausted
    expect(timeline.frame).toBe(59);
    timeline.destroy();
  });

  it('ends immediately when the ruler collapses to the head mid-play', () => {
    const timeline = buildTimeline();
    timeline.play();
    vi.advanceTimersByTime(100);
    expect(timeline.status).toBe('playing');

    timeline.endFrame = 0; // degenerate ruler: maxFrame === minFrame

    vi.advanceTimersByTime(100);
    expect(timeline.status).toBe('idle');
    expect(timeline.frame).toBe(0);
    timeline.destroy();
  });

  it('stops ticking when a subscriber pauses during a clock update', () => {
    const timeline = buildTimeline();
    let paused = false;
    const off = timeline.subscribe(() => {
      if (!paused) {
        paused = true;
        timeline.pause();
      }
    });

    timeline.play();
    vi.advanceTimersByTime(500);

    expect(timeline.status).toBe('idle');
    expect(timeline.frame).toBe(0);
    off();
    timeline.destroy();
  });
});

describe('hydrate partials', () => {
  it('ignores an empty snapshot without losing state', () => {
    const timeline = buildTimeline();
    const marker = timeline.addMarker({ atFrame: 30, name: 'cue' });
    const idBefore = timeline.id;

    timeline.hydrate({});

    expect(timeline.id).toBe(idBefore);
    expect(timeline.frameRate).toBe(30);
    expect(timeline.tracks.size).toBe(1);
    expect(marker.atFrame).toBe(30);
    timeline.destroy();
  });

  it('rescales playhead, segments and markers when a snapshot changes the frame rate', () => {
    const timeline = buildTimeline();
    const marker = timeline.addMarker({ atFrame: 30, name: 'cue' });
    const [track] = Array.from(timeline.tracks);

    timeline.hydrate({ options: { frameRate: 60 } });
    expect(timeline.frame).toBe(0); // playhead at head stays at head
    expect(marker.atFrame).toBe(60);
    expect(timeline.totalFrames).toBe(119); // 2s @ 60fps → last frame 119

    timeline.scrub(18);
    timeline.hydrate({ options: { frameRate: 30 } });
    expect(timeline.frame).toBe(9); // 18 @ 60fps → 9 @ 30fps
    expect(marker.atFrame).toBe(30);
    expect(timeline.totalFrames).toBe(59);
    expect(track.segments.size).toBe(1);
    timeline.destroy();
  });

  it('destroys existing tracks before restoring snapshot tracks', () => {
    const donor = buildTimeline();
    donor.addMarker({ atFrame: 30, name: 'cue' });
    const snap = donor.snapshot();
    donor.destroy();

    const host = buildTimeline();
    const [oldTrack] = Array.from(host.tracks);
    expect(oldTrack.segments.size).toBe(1);

    host.hydrate(snap);

    expect(oldTrack.segments.size).toBe(0); // destroyed during replacement
    expect(host.tracks.size).toBe(1);
    const [restoredTrack] = Array.from(host.tracks);
    expect(restoredTrack.id).toBe(snap.tracks[0].id);
    expect(restoredTrack.segments.size).toBe(1);
    expect(host.markers.size).toBe(1);
    host.destroy();
  });

  it('keeps fresh identities when snapshots omit track or marker ids', () => {
    const donor = buildTimeline();
    donor.addMarker({ atFrame: 30, name: 'cue' });
    const snap = donor.snapshot();
    donor.destroy();

    snap.tracks[0].id = '';
    if (snap.markers) {
      snap.markers[0].id = '';
    }

    const host = new Timeline({ frameRate: 30 });
    host.hydrate(snap);

    const [track] = Array.from(host.tracks);
    expect(track.id).not.toBe('');
    const [marker] = Array.from(host.markers);
    expect(marker.id).not.toBe('');
    host.destroy();
  });
});
