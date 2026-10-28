/**
 * Coverage marker tests — setter round-trips, construction defaults, and hydrate branches.
 *
 * Oracle: marker.d.ts ONLY.
 * App concern: the editor renames / retypes / repositions cue points after creation,
 * drops a cue with no configuration at all, and restores saved cues from a project
 * file into live marker instances without losing state on partial snapshots.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineMarker } from '../../src/timeline/marker.js';
import { Timeline } from '../../src/timeline/timeline.js';
import { uiFrame } from './fixture.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('marker property setters', () => {
  it('type / name / meta setters update the cue for editor round-trips', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = timeline.addMarker({ atFrame: uiFrame(30), type: 'cue', name: 'beat', meta: { bar: 4 } });

    marker.type = 'chapter';
    marker.name = 'chorus';
    marker.meta = { bar: 8, section: 'bridge' };

    expect(marker.type).toBe('chapter');
    expect(marker.name).toBe('chorus');
    expect(marker.meta).toEqual({ bar: 8, section: 'bridge' });
    timeline.destroy();
  });

  it('atTime setter converts seconds to the 0-indexed frame at the timeline frame rate', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = timeline.addMarker({ atFrame: 0 });

    marker.atTime = 2;
    expect(marker.atFrame).toBe(uiFrame(60));
    expect(marker.atTime).toBe(2);

    timeline.destroy();
  });
});

describe('marker construction defaults', () => {
  it('constructs at frame zero with no labels when no options are provided', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = new TimelineMarker(timeline);

    expect(marker.atFrame).toBe(0);
    expect(marker.type).toBeUndefined();
    expect(marker.name).toBeUndefined();
    expect(marker.meta).toBeUndefined();
    expect(timeline.markers.size).toBe(1);

    timeline.destroy();
  });
});

describe('marker hydrate', () => {
  it('restores identity and options from a full snapshot', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = timeline.addMarker({ atFrame: uiFrame(30), type: 'cue', name: 'beat' });
    const snap = marker.snapshot();
    snap.id = 'restored-cue-id';
    snap.options = { atFrame: uiFrame(90), type: 'chapter', name: 'bridge', meta: { bar: 16 } };

    marker.hydrate(snap);

    expect(marker.id).toBe('restored-cue-id');
    expect(marker.atFrame).toBe(uiFrame(90));
    expect(marker.type).toBe('chapter');
    expect(marker.name).toBe('bridge');
    expect(marker.meta).toEqual({ bar: 16 });
    timeline.destroy();
  });

  it('applies a snapshot with only an id and keeps current options', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = timeline.addMarker({ atFrame: uiFrame(45), name: 'keep' });

    marker.hydrate({ id: 'renamed-cue-id' });

    expect(marker.id).toBe('renamed-cue-id');
    expect(marker.atFrame).toBe(uiFrame(45));
    expect(marker.name).toBe('keep');
    timeline.destroy();
  });

  it('ignores an empty snapshot without losing state', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const marker = timeline.addMarker({ atFrame: uiFrame(45), name: 'keep' });
    const idBefore = marker.id;

    marker.hydrate({});

    expect(marker.id).toBe(idBefore);
    expect(marker.atFrame).toBe(uiFrame(45));
    expect(marker.name).toBe('keep');
    timeline.destroy();
  });
});
