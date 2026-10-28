/**
 * Head trims — editor perspective.
 *
 * App concern: trimming a clip at its head moves its start later and shortens it, but what it
 * shows must stay where it was in time: the footage and the animation keep playing from the point
 * the trim cut to, not from their beginning. The segment's `offsetFrame` is how far into its
 * content it begins.
 */
import { describe, expect, it } from 'vitest';
import { sampleSegment, segmentTime } from '../../src/timeline/motion.js';
import { Timeline } from '../../src/timeline/timeline.js';

/** A 3s title at 1s that fades in over its first second, trimmed at its head by half a second. */
function buildTrimmed() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'titles' });
  const title = track.addSegment({ name: 'Harbor at dawn', duration: 3, startFrame: 30 }, { opacity: 1 });
  title.addScene({ atFrame: 0, meta: { ease: 'linear' } }, { opacity: 0 });
  title.addScene({ atFrame: 30 }, { opacity: 1 });
  timeline.refresh();

  title.startFrame = 45;
  title.duration = 2.5;
  title.offsetFrame = 15;
  return { timeline, title };
}

describe('a clip trimmed at its head', () => {
  it('shows its content from where the trim cut to, not from its beginning', () => {
    const { timeline, title } = buildTrimmed();
    expect(sampleSegment(title, 45).opacity).toBeCloseTo(0.5);
    expect(sampleSegment(title, 60).opacity).toBe(1);
    expect(segmentTime(title, 45)).toBeCloseTo(0.5);
    timeline.destroy();
  });

  it('keeps its own end where it was', () => {
    const { timeline, title } = buildTrimmed();
    expect(title.endFrame).toBe(119);
    timeline.destroy();
  });

  it("reports its clock in its content's frames", async () => {
    const { timeline, title } = buildTrimmed();
    await timeline.scrub(45);
    expect(title.frame).toBe(15);
    expect(title.time).toBeCloseTo(0.5);
    timeline.destroy();
  });

  it('keeps keyframes within the content it shows', () => {
    const { timeline, title } = buildTrimmed();
    const late = title.addScene({ atFrame: 999 }, { opacity: 0.2 });
    expect(late.atFrame).toBe(15 + 75);
    timeline.destroy();
  });

  it('keeps the trim through a save and a reload, and an untrimmed clip saves none', () => {
    const { timeline, title } = buildTrimmed();
    const restored = new Timeline({ frameRate: 30 });
    restored.hydrate(timeline.snapshot());
    const [segment] = [...[...restored.tracks][0].segments];
    expect(segment.offsetFrame).toBe(15);

    const plain = new Timeline({ frameRate: 30 });
    const clip = plain.addTrack({ name: 'video' }).addSegment({ duration: 2 });
    expect('offsetFrame' in clip.snapshot().options).toBe(false);
    expect(clip.offsetFrame).toBe(0);

    timeline.destroy();
    restored.destroy();
    plain.destroy();
  });

  it('keeps how long its content runs through a save and a reload, and has no limit unless told', () => {
    const { timeline, title } = buildTrimmed();
    expect(title.contentFrames).toBeUndefined();
    expect('contentFrames' in title.snapshot().options).toBe(false);

    title.contentFrames = 120.4;
    expect(title.contentFrames).toBe(120);
    const restored = new Timeline({ frameRate: 30 });
    restored.hydrate(timeline.snapshot());
    const [segment] = [...[...restored.tracks][0].segments];
    expect(segment.contentFrames).toBe(120);

    title.contentFrames = undefined;
    expect(title.contentFrames).toBeUndefined();

    timeline.destroy();
    restored.destroy();
  });

  it('takes whole frames, never before its content', () => {
    const { timeline, title } = buildTrimmed();
    title.offsetFrame = 4.6;
    expect(title.offsetFrame).toBe(5);
    title.offsetFrame = -3;
    expect(title.offsetFrame).toBe(0);
    timeline.destroy();
  });
});
