/**
 * Source tests — app perspective.
 *
 * App concern: an editor opens a saved composition and edits it in place. Given its storage as
 * `source`, the timeline acts on it rather than copying it, so every edit lands in the document;
 * without one, it owns storage it made itself. Closing the editor never wipes the document.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mutable } from '../../src/reactive/index.js';
import { Timeline, type TimelineSnapshot } from '../../src/timeline/timeline.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A saved composition, as a document keeps it: one video track with a keyed clip, and a chapter marker. */
function savedComposition(): TimelineSnapshot {
  return {
    id: 'promo',
    options: { frameRate: 24, speed: 1 },
    props: { width: 1920, height: 1080 },
    tracks: [
      {
        id: 'video',
        options: { type: 'video', name: 'Video' },
        props: {},
        segments: [
          {
            id: 'hero',
            options: { type: 'svg', name: 'Hero', speed: 1, duration: 2, startFrame: 0 },
            props: { href: 'hero.png' },
            scenes: [
              { id: 'k1', options: { atFrame: 0 }, data: { opacity: 0 } },
              { id: 'k2', options: { atFrame: 12 }, data: { opacity: 1 } },
              { id: 'k3', options: { atFrame: 24 }, data: { opacity: 0.5 } },
            ],
          },
        ],
      },
      { id: 'titles', options: { type: 'text', name: 'Titles' }, props: {}, segments: [] },
    ],
    markers: [{ id: 'chorus', options: { atFrame: 36, name: 'Chorus' } }],
  };
}

describe('a timeline over a given source', () => {
  it('reads its options and builds its instances from what the source holds', () => {
    const source = mutable(savedComposition());
    const timeline = new Timeline({ source });

    expect(timeline.frameRate).toBe(24);
    expect(timeline.id).toBe('promo');
    expect(timeline.props).toMatchObject({ width: 1920, height: 1080 });
    expect([...timeline.tracks].map((track) => track.id)).toEqual(['video', 'titles']);

    const [segment] = [...[...timeline.tracks][0].segments];
    expect(segment.id).toBe('hero');
    expect(segment.props).toMatchObject({ href: 'hero.png' });
    expect(segment.scenes.map((scene) => scene.id)).toEqual(['k1', 'k2', 'k3']);
    expect([...timeline.markers].map((marker) => marker.name)).toEqual(['Chorus']);
  });

  it('keeps every keyframe of the source while building them one by one', () => {
    const source = mutable(savedComposition());
    new Timeline({ source });

    expect(source.tracks[0].segments[0].scenes?.map((scene) => scene.id)).toEqual(['k1', 'k2', 'k3']);
  });

  it('writes edits into the source', () => {
    const source = mutable(savedComposition());
    const timeline = new Timeline({ source });
    const [video] = [...timeline.tracks];
    const [segment] = [...video.segments];

    segment.startFrame = 12;
    segment.props.href = 'hero-2.png';
    video.disabled = true;
    segment.scenes[1].data.opacity = 0.8;

    expect(source.tracks[0].segments[0].options.startFrame).toBe(12);
    expect(source.tracks[0].segments[0].props?.href).toBe('hero-2.png');
    expect(source.tracks[0].options.disabled).toBe(true);
    expect(source.tracks[0].segments[0].scenes?.[1].data.opacity).toBe(0.8);
  });

  it('adds and removes nodes in the source as instances are added and removed', () => {
    const source = mutable(savedComposition());
    const timeline = new Timeline({ source });
    const [video, titles] = [...timeline.tracks];

    const audio = timeline.addTrack({ type: 'audio', name: 'Music' });
    const title = titles.addSegment({ type: 'html', name: 'Saturday', duration: 1, startFrame: 24 });
    const [segment] = [...video.segments];
    segment.removeScene(segment.scenes[0]);
    timeline.removeMarker([...timeline.markers][0]);

    expect(source.tracks.map((track) => track.id)).toEqual(['video', 'titles', audio.id]);
    expect(source.tracks[1].segments.map((each) => each.id)).toEqual([title.id]);
    expect(source.tracks[0].segments[0].scenes?.map((scene) => scene.id)).toEqual(['k2', 'k3']);
    expect(source.markers).toEqual([]);

    timeline.removeTrack(audio);
    titles.removeSegment(title);
    expect(source.tracks.map((track) => track.id)).toEqual(['video', 'titles']);
    expect(source.tracks[1].segments).toEqual([]);
  });

  it('keeps keyframes in the source in time order as they move', () => {
    const source = mutable(savedComposition());
    const timeline = new Timeline({ source });
    const [segment] = [...[...timeline.tracks][0].segments];

    segment.scenes[0].atFrame = 18;

    expect(source.tracks[0].segments[0].scenes?.map((scene) => scene.id)).toEqual(['k2', 'k1', 'k3']);
  });

  it('puts tracks in a new order in the instances and the source together', () => {
    const source = mutable(savedComposition());
    const timeline = new Timeline({ source });
    const [video, titles] = [...timeline.tracks];

    timeline.orderTracks([titles, video]);

    expect([...timeline.tracks]).toEqual([titles, video]);
    expect(source.tracks.map((track) => track.id)).toEqual(['titles', 'video']);
    // A track still acts on its own node after the move.
    video.name = 'Footage';
    expect(source.tracks[1].options.name).toBe('Footage');
  });

  it('leaves the source whole when the timeline is destroyed', () => {
    const source = mutable(savedComposition());
    const timeline = new Timeline({ source });

    timeline.destroy();

    expect(source.tracks.map((track) => track.id)).toEqual(['video', 'titles']);
    expect(source.tracks[0].segments[0].scenes).toHaveLength(3);
    expect(source.markers).toHaveLength(1);
  });

  it('opens again with the edits a timeline before it made', () => {
    const source = mutable(savedComposition());
    const first = new Timeline({ source });
    const [segment] = [...[...first.tracks][0].segments];
    segment.startFrame = 6;
    first.addTrack({ type: 'audio', name: 'Music' });
    first.destroy();

    const reopened = new Timeline({ source });

    expect([...reopened.tracks].map((track) => track.name)).toEqual(['Video', 'Titles', 'Music']);
    expect([...[...reopened.tracks][0].segments][0].startFrame).toBe(6);
  });

  it('takes a plain source as its storage, made reactive', () => {
    const plain = savedComposition();
    const timeline = new Timeline({ source: plain });

    timeline.addTrack({ type: 'audio', name: 'Music' });

    expect(timeline.source.tracks).toHaveLength(3);
    expect(timeline.source.id).toBe('promo');
  });
});

describe('a timeline owning its storage', () => {
  it('makes its storage from its options', () => {
    const timeline = new Timeline({ frameRate: 30 }, { width: 1280 });
    const track = timeline.addTrack({ type: 'video' });
    const segment = track.addSegment({ duration: 1, startFrame: 3 });
    segment.addScene({ atFrame: 0 }, { opacity: 0 });

    expect(timeline.source.options.frameRate).toBe(30);
    expect(timeline.source.props).toMatchObject({ width: 1280 });
    expect(timeline.source.tracks[0].id).toBe(track.id);
    expect(timeline.source.tracks[0].segments[0].options.startFrame).toBe(3);
    expect(timeline.source.tracks[0].segments[0].scenes?.[0].data).toMatchObject({ opacity: 0 });
  });

  it('hands out snapshots detached from its storage', () => {
    const timeline = new Timeline({ frameRate: 30 });
    timeline.addTrack({ type: 'video', name: 'Video' });

    const snapshot = timeline.snapshot();
    snapshot.tracks[0].options.name = 'Changed';
    snapshot.tracks.push({ id: 'extra', options: {}, segments: [] });

    expect([...timeline.tracks][0].name).toBe('Video');
    expect(timeline.source.tracks).toHaveLength(1);
  });

  it('copies a hydrated snapshot into its storage rather than taking it over', () => {
    const snapshot = savedComposition();
    const timeline = new Timeline({ frameRate: 30 });

    timeline.hydrate(snapshot);
    [...timeline.tracks][0].name = 'Footage';

    expect(snapshot.tracks[0].options.name).toBe('Video');
    expect(timeline.source.tracks.map((track) => track.id)).toEqual(['video', 'titles']);
    expect(timeline.source.tracks[0].segments[0].scenes).toHaveLength(3);
  });
});
