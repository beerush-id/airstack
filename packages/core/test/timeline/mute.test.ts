/**
 * BLIND journey: mute-then-preview — app perspective.
 * Editor mutes the music lane, previews the cut, unmutes to restore.
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

function buildMuteProject() {
  const timeline = new Timeline({ frameRate: 30 });
  const video = timeline.addTrack({ name: 'video' });
  const music = timeline.addTrack({ name: 'music' });
  const clip = video.addSegment({ name: 'picture', duration: 3, startFrame: 0 });
  const song = music.addSegment({ name: 'song', duration: 3, startFrame: 0 });
  timeline.refresh();
  return { timeline, clip, song, music };
}

describe('mute-then-preview journey', () => {
  it('both lanes active during normal preview', () => {
    const { timeline, clip, song } = buildMuteProject();
    timeline.scrub(uiFrame(30));
    expect(clip.active).toBe(true);
    expect(song.active).toBe(true);
    timeline.destroy();
  });

  it('muted music stays idle while picture stays active', () => {
    const { timeline, clip, song, music } = buildMuteProject();
    music.disabled = true;
    song.disabled = true;
    timeline.scrub(uiFrame(30));
    expect(clip.active).toBe(true);
    expect(song.status).toBe('idle');
    timeline.destroy();
  });

  it('unmute restores music activity', () => {
    const { timeline, song, music } = buildMuteProject();
    music.disabled = true;
    song.disabled = true;
    timeline.scrub(uiFrame(30));
    music.disabled = false;
    song.disabled = false;
    timeline.scrub(uiFrame(45));
    expect(song.active).toBe(true);
    timeline.destroy();
  });
});
