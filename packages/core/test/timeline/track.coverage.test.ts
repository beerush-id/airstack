/**
 * Coverage track tests — construction / addSegment defaults, removeSegment guards,
 * and hydrate branch paths.
 *
 * Oracle: track.d.ts ONLY.
 * App concern: an editor drops an empty lane and an empty clip onto it, drags clips
 * between lanes, removes clips from lanes that were already detached from the project,
 * and applies partial project patches to a lane without wiping it.
 *
 * Full-snapshot hydrate (all branches true) is already covered by persistence.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timeline } from '../../src/timeline/timeline.js';
import { TimelineTrack } from '../../src/timeline/track.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('track construction defaults', () => {
  it('constructs an unlabeled lane when no options are provided', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = new TimelineTrack(timeline);

    expect(track.id).toBeTruthy();
    expect(track.type).toBeUndefined();
    expect(track.name).toBeUndefined();
    expect(track.meta).toBeUndefined();
    expect(track.disabled).toBeUndefined();
    expect(track.segments.size).toBe(0);
    expect(timeline.tracks.has(track)).toBe(true);

    timeline.destroy();
  });
});

describe('track addSegment defaults', () => {
  it('adds a zero-length clip when no options are provided', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    const segment = track.addSegment();

    expect(segment.startFrame).toBe(0);
    expect(segment.totalFrames).toBe(0);
    expect(track.segments.size).toBe(1);
    expect(track.segments.has(segment)).toBe(true);

    timeline.destroy();
  });
});

describe('removeSegment guards', () => {
  it('ignores a segment that belongs to another lane', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const trackA = timeline.addTrack({ name: 'a' });
    const trackB = timeline.addTrack({ name: 'b' });
    const segmentB = trackB.addSegment({ name: 'b-clip', duration: 1 });

    trackA.removeSegment(segmentB);

    expect(trackA.segments.size).toBe(0);
    expect(trackB.segments.size).toBe(1);
    expect(trackB.segments.has(segmentB)).toBe(true);
    timeline.destroy();
  });

  it('recomputes the timeline when the lane is still attached', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'clip', duration: 2 });
    timeline.refresh();
    expect(timeline.totalFrames).toBe(59); // 2s @ 30fps → last 0-indexed frame 59

    const [segment] = Array.from(track.segments);
    track.removeSegment(segment);
    expect(track.segments.size).toBe(0);
    expect(timeline.totalFrames).toBe(0);

    timeline.destroy();
  });

  it('skips the timeline refresh when the lane is already detached from the project', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'video' });
    track.addSegment({ name: 'clip', duration: 2 });
    timeline.refresh();
    expect(timeline.totalFrames).toBe(59); // 2s @ 30fps → last 0-indexed frame 59

    // Detach without destroy: the stale-lane guard in removeSegment must
    // skip the refresh because the lane no longer belongs to the project.
    timeline.tracks.delete(track);

    const [segment] = Array.from(track.segments);
    track.removeSegment(segment);
    expect(track.segments.size).toBe(0);
    // No refresh ran, so the project totals keep their last computed values.
    expect(timeline.totalFrames).toBe(59);

    timeline.destroy();
  });
});

describe('track hydrate partials', () => {
  it('ignores an empty snapshot without losing state', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'keep', type: 'video' });
    track.addSegment({ name: 'clip', duration: 1 });
    const idBefore = track.id;

    track.hydrate({});

    expect(track.id).toBe(idBefore);
    expect(track.name).toBe('keep');
    expect(track.type).toBe('video');
    expect(track.segments.size).toBe(1);

    timeline.destroy();
  });

  it('applies an id-only snapshot without touching options or segments', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'keep' });
    track.addSegment({ name: 'clip', duration: 1 });

    track.hydrate({ id: 'restored-lane-id' });

    expect(track.id).toBe('restored-lane-id');
    expect(track.name).toBe('keep');
    expect(track.segments.size).toBe(1);

    timeline.destroy();
  });

  it('applies an options-only snapshot without touching identity or segments', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const track = timeline.addTrack({ name: 'before' });
    track.addSegment({ name: 'clip', duration: 1 });
    const idBefore = track.id;

    track.hydrate({ options: { name: 'renamed', type: 'audio' } });

    expect(track.id).toBe(idBefore);
    expect(track.name).toBe('renamed');
    expect(track.type).toBe('audio');
    expect(track.segments.size).toBe(1);

    timeline.destroy();
  });
});
