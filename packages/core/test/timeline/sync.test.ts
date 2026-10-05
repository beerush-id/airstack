/**
 * BLIND journey: multi-lane sync — app perspective.
 * Picture and sound start offset; preview in the overlap shows
 * both lanes active together.
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

function buildSync() {
  const timeline = new Timeline({ frameRate: 30 });
  const video = timeline.addTrack({ name: 'video' });
  const audio = timeline.addTrack({ name: 'audio' });
  const picture = video.addSegment({ name: 'picture', duration: 3, startFrame: uiFrame(1) });
  const song = audio.addSegment({ name: 'song', duration: 3, startFrame: uiFrame(30) });
  timeline.refresh();
  return { timeline, picture, song };
}

describe('multi-lane sync journey', () => {
  it('before overlap only picture is active', () => {
    const { timeline, picture, song } = buildSync();
    timeline.scrub(uiFrame(15));
    expect(picture.active).toBe(true);
    expect(song.active).toBe(false);
    timeline.destroy();
  });

  it('inside overlap both lanes are active', () => {
    const { timeline, picture, song } = buildSync();
    timeline.scrub(uiFrame(60));
    expect(picture.active).toBe(true);
    expect(song.active).toBe(true);
    timeline.destroy();
  });

  it('after picture ends only song stays active', () => {
    const { timeline, picture, song } = buildSync();
    timeline.scrub(uiFrame(100));
    expect(picture.active).toBe(false);
    expect(song.active).toBe(true);
    timeline.destroy();
  });
});
