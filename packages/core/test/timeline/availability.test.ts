/**
 * BLIND availability tests — app perspective.
 *
 * Oracle: track.d.ts / segment.d.ts disabled, timeline.d.ts repeat,
 * segment status / active / reset / destroy ONLY.
 * App concern: mute a lane, loop a clip, and tear down the composition
 * without leaking playback.
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

describe('disabled — muting lanes and clips', () => {
  it('track disabled round-trips', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'music' });
    expect(track.disabled).toBeFalsy();
    track.disabled = true;
    expect(track.disabled).toBe(true);
    track.disabled = false;
    expect(track.disabled).toBe(false);
    timeline.destroy();
  });

  it('segment disabled round-trips', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'clip', duration: 2, startFrame: 0 });
    expect(segment.disabled).toBe(false);
    segment.disabled = true;
    expect(segment.disabled).toBe(true);
    timeline.destroy();
  });

  it('disabled segment stays idle when playhead moves inside its window', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'muted', duration: 2, startFrame: 0, disabled: true });
    timeline.scrub(uiFrame(30));
    expect(segment.disabled).toBe(true);
    expect(segment.status).toBe('idle');
    timeline.destroy();
  });

  it('enabled segment is active when playhead moves inside its window', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'live', duration: 2, startFrame: 0 });
    timeline.scrub(uiFrame(30));
    expect(segment.active).toBe(true);
    expect(timeline.status).toBe('idle');
    timeline.destroy();
  });

  it('segment outside its window is idle', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'later', duration: 1, startFrame: uiFrame(60) });
    timeline.scrub(uiFrame(10));
    expect(segment.active).toBe(false);
    expect(segment.status).toBe('idle');
    timeline.destroy();
  });
});

describe('timeline repeat — looping the master ruler', () => {
  it('repeat round-trips for single, count and infinite', () => {
    const timeline = new Timeline({ frameRate: 30 });
    expect(timeline.repeat).toBeFalsy();
    timeline.repeat = 2;
    expect(timeline.repeat).toBe(2);
    timeline.repeat = true;
    expect(timeline.repeat).toBe(true);
    timeline.repeat = false;
    expect(timeline.repeat).toBe(false);
    timeline.destroy();
  });
});

describe('reset and destroy lifecycle', () => {
  it('segment.reset() returns local playhead to 0 and idle', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment({ name: 'clip', duration: 2, startFrame: 0 });
    timeline.scrub(uiFrame(30));
    segment.reset();
    expect(segment.frame).toBe(0);
    expect(segment.time).toBe(0);
    expect(segment.status).toBe('idle');
    timeline.destroy();
  });

  it('destroy() clears tracks and markers', () => {
    const timeline = new Timeline({ frameRate: 30 });
    timeline.addTrack({ name: 'video' });
    timeline.addMarker({ atFrame: uiFrame(10), name: 'cue' });
    timeline.destroy();
    expect(timeline.tracks.size).toBe(0);
    expect(timeline.markers.size).toBe(0);
  });

  it('track.destroy() clears its segments', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'a', duration: 1, startFrame: 0 });
    track.addSegment({ name: 'b', duration: 1, startFrame: uiFrame(30) });
    track.destroy();
    expect(track.segments.size).toBe(0);
    timeline.destroy();
  });
});
