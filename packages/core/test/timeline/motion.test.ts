/**
 * Motion sampling — renderer perspective.
 *
 * App concern: a stage draws each layer from its segment: the layer's own values, moved by its
 * keyframes. The renderer asks "what does this layer look like at this frame?" and "is it on?".
 */
import { describe, expect, it } from 'vitest';
import { EASES, isSegmentOn, sampleSegment, segmentTime } from '../../src/timeline/motion.js';
import { Timeline } from '../../src/timeline/timeline.js';

function buildTitle() {
  const timeline = new Timeline({ frameRate: 30 });
  const track = timeline.addTrack({ name: 'titles' });
  const title = track.addSegment(
    { name: 'Harbor at dawn', duration: 3, startFrame: 30 },
    { text: 'Harbor at dawn', x: 160, y: 760, opacity: 1, color: '#fff' }
  );
  title.addScene({ atFrame: 0, meta: { ease: 'linear' } }, { opacity: 0, y: 800 });
  title.addScene({ atFrame: 30 }, { opacity: 1, y: 760, color: '#fc0' });
  timeline.refresh();
  return { timeline, title };
}

describe('sampleSegment', () => {
  it('holds the first keyframe at the segment start', () => {
    const { timeline, title } = buildTitle();
    expect(sampleSegment(title, 30)).toMatchObject({ opacity: 0, y: 800, x: 160, text: 'Harbor at dawn' });
    timeline.destroy();
  });

  it('blends numbers between keyframes', () => {
    const { timeline, title } = buildTitle();
    const half = sampleSegment(title, 45);
    expect(half.opacity).toBeCloseTo(0.5);
    expect(half.y).toBeCloseTo(780);
    timeline.destroy();
  });

  it('switches values that are not numbers at the keyframe', () => {
    const { timeline, title } = buildTitle();
    expect(sampleSegment(title, 59).color).toBe('#fff');
    expect(sampleSegment(title, 60).color).toBe('#fc0');
    timeline.destroy();
  });

  it('holds the last keyframe after it', () => {
    const { timeline, title } = buildTitle();
    expect(sampleSegment(title, 100)).toMatchObject({ opacity: 1, y: 760 });
    timeline.destroy();
  });

  it('eases by the earlier keyframe', () => {
    const { timeline, title } = buildTitle();
    title.scenes[0].meta = { ease: 'out' };
    expect(sampleSegment(title, 45).opacity).toBeCloseTo(EASES.out(0.5));
    timeline.destroy();
  });

  it('returns a copy of the props when there are no keyframes', () => {
    const timeline = new Timeline({ frameRate: 30 });
    const segment = timeline.addTrack({}).addSegment({ duration: 1 }, { x: 4 });
    const values = sampleSegment(segment, 0);
    values.x = 99;
    expect(segment.props.x).toBe(4);
    timeline.destroy();
  });
});

describe('isSegmentOn and segmentTime', () => {
  it('is on from its first frame through its last', () => {
    const { timeline, title } = buildTitle();
    expect(isSegmentOn(title, 29)).toBe(false);
    expect(isSegmentOn(title, 30)).toBe(true);
    expect(isSegmentOn(title, 119)).toBe(true);
    expect(isSegmentOn(title, 120)).toBe(false);
    timeline.destroy();
  });

  it('is off while disabled', () => {
    const { timeline, title } = buildTitle();
    title.disabled = true;
    expect(isSegmentOn(title, 40)).toBe(false);
    timeline.destroy();
  });

  it('measures seconds into the segment', () => {
    const { timeline, title } = buildTitle();
    expect(segmentTime(title, 30)).toBe(0);
    expect(segmentTime(title, 75)).toBe(1.5);
    timeline.destroy();
  });
});
