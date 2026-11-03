/**
 * Pages — app perspective.
 *
 * App concern: one composition plays through as a video, or as a presentation a page at a time.
 * A page is a marker of type `page`; it runs from the page before it, or the start, to its own
 * marker. Playing a page plays that stretch and holds at the marker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timeline } from '../../src/timeline/timeline.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A 6-second deck at 30fps with pages ending at 1s, 3s and 5s, and a plain cue between them. */
function buildDeck() {
  const timeline = new Timeline({ frameRate: 30 });
  timeline.addTrack({ type: 'title' }).addSegment({ duration: 6, startFrame: 0 });
  timeline.addMarker({ atFrame: 90, type: 'page', name: 'Problem' });
  timeline.addMarker({ atFrame: 30, type: 'page', name: 'Hook' });
  timeline.addMarker({ atFrame: 60, type: 'cue', name: 'Beat' });
  timeline.addMarker({ atFrame: 150, type: 'page', name: 'Answer' });
  timeline.refresh();
  return timeline;
}

describe('pages', () => {
  it('lists its page markers in time order, leaving other markers out', () => {
    const timeline = buildDeck();
    expect(timeline.pages.map((page) => page.name)).toEqual(['Hook', 'Problem', 'Answer']);
    timeline.destroy();
  });

  it('knows which page the playhead is on', async () => {
    const timeline = buildDeck();
    expect(timeline.page).toBe(-1);
    await timeline.scrub(30);
    expect(timeline.page).toBe(0);
    await timeline.scrub(100);
    expect(timeline.page).toBe(1);
    timeline.destroy();
  });

  it('plays a page from the page before it to its own marker, and holds there', async () => {
    const timeline = buildDeck();
    const held = timeline.goto(1);
    expect(timeline.status).toBe('playing');
    expect(timeline.frame).toBe(30);

    vi.advanceTimersByTime(4000);
    await held;
    expect(timeline.frame).toBe(90);
    expect(timeline.status).toBe('idle');
    expect(timeline.page).toBe(1);
    timeline.destroy();
  });

  it('plays the first page from the start', () => {
    const timeline = buildDeck();
    void timeline.goto(0);
    expect(timeline.frame).toBe(0);
    vi.advanceTimersByTime(2000);
    expect(timeline.frame).toBe(30);
    timeline.destroy();
  });

  it('moves a page on, then a page back, each playing its own stretch', async () => {
    const timeline = buildDeck();
    await timeline.scrub(90);

    void timeline.nextPage();
    expect(timeline.frame).toBe(90);
    vi.advanceTimersByTime(3000);
    expect(timeline.frame).toBe(150);
    expect(timeline.page).toBe(2);

    void timeline.prevPage();
    expect(timeline.frame).toBe(30);
    vi.advanceTimersByTime(3000);
    expect(timeline.frame).toBe(90);
    expect(timeline.page).toBe(1);
    timeline.destroy();
  });

  it('skips to the end of a page still playing when asked for the next one', async () => {
    const timeline = buildDeck();
    void timeline.goto(1);
    vi.advanceTimersByTime(300);
    expect(timeline.frame).toBeLessThan(90);

    await timeline.nextPage();
    expect(timeline.frame).toBe(90);
    expect(timeline.status).toBe('idle');
    timeline.destroy();
  });

  it('settles a page left playing once playback is paused', async () => {
    const timeline = buildDeck();
    const held = timeline.goto(2);
    vi.advanceTimersByTime(300);
    timeline.pause();
    await held;
    expect(timeline.frame).toBeLessThan(150);
    timeline.destroy();
  });

  it('does nothing past the last page or before the first', async () => {
    const timeline = buildDeck();
    await timeline.scrub(150);
    await timeline.nextPage();
    expect(timeline.frame).toBe(150);

    await timeline.scrub(10);
    await timeline.prevPage();
    expect(timeline.frame).toBe(10);
    timeline.destroy();
  });

  it('plays through its pages as a video when played on its own', () => {
    const timeline = buildDeck();
    timeline.play(0);
    vi.advanceTimersByTime(7000);
    expect(timeline.frame).toBe(timeline.totalFrames);
    timeline.destroy();
  });
});
