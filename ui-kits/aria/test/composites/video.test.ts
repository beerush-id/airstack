import { createLifecycle } from '@airlib/core';
import { createTimeline } from '@airlib/core/timeline';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, canCaptureVideo, type VideoClipFrame, videoStageCtx } from '../../src/index.js';
import { bind, component } from '../utils.js';

/**
 * A two-layer composition: a picture for the whole cut, and a title that fades in from frame 30.
 */
function buildCut() {
  const timeline = createTimeline({ frameRate: 30 });
  const picture = timeline
    .addTrack({ type: 'video', name: 'Video' })
    .addSegment({ type: 'html', duration: 4, startFrame: 0 }, { x: 0, y: 0, width: 1920, height: 1080 });
  const title = timeline
    .addTrack({ type: 'text', name: 'Titles' })
    .addSegment({ type: 'html', duration: 2, startFrame: 30 }, { x: 160, y: 760, width: 900, height: 180 });
  title.addScene({ atFrame: 0 }, { opacity: 0, scale: 0.5 });
  title.addScene({ atFrame: 30 }, { opacity: 1, scale: 1 });
  timeline.refresh();
  return { timeline, picture, title };
}

/** Whether a layer's element is hidden by the stage. */
const hiddenOf = (element: HTMLElement) => element.style.display === 'none';

describe('Video stage and clips', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  const mount = (draw?: (frame: VideoClipFrame) => unknown) => {
    const cut = buildCut();
    return scope.run(() =>
      component().run(() => {
        const stage = aria('video-stage', {}, { timeline: cut.timeline });
        const stageEl = bind(document.createElement('div'), stage);
        document.body.appendChild(stageEl);

        const layer = (segment: typeof cut.picture) =>
          component().run(() => {
            const behavior = aria('video-clip', {}, { segment, draw });
            const element = document.createElement('div');
            stageEl.append(element);
            bind(element, behavior);
            return { behavior, element };
          });

        const picture = layer(cut.picture);
        const title = layer(cut.title);
        return { ...cut, stage, stageEl, picture, title, ctx: videoStageCtx };
      })
    );
  };

  it('hides the composition from assistive tech and marks its mode', () => {
    const { stageEl, timeline } = mount();
    expect(stageEl.getAttribute('aria-hidden')).toBe('true');
    expect(stageEl.getAttribute('data-video-stage')).toBe('preview');
    expect(stageEl.style.getPropertyValue('--aria-video-width')).toBe('1920px');
    timeline.destroy();
  });

  it('shows a layer while its segment is on, and holds it painted but unseen just before', () => {
    const { timeline, picture, title } = mount();
    expect(hiddenOf(picture.element)).toBe(false);

    // The title starts at frame 30, within the 2-second preroll: on stage, but barely opaque.
    expect(title.behavior.showing).toBe(false);
    expect(hiddenOf(title.element)).toBe(false);
    expect(title.element.style.opacity).toBe('0.001');

    timeline.scrub(30);
    expect(title.behavior.showing).toBe(true);
    expect(hiddenOf(title.element)).toBe(false);

    timeline.scrub(100);
    expect(hiddenOf(title.element)).toBe(true);
    timeline.destroy();
  });

  it('hides a layer whose own styles set a display, and gives that display back', () => {
    const { timeline, title } = mount();
    timeline.scrub(30);
    title.element.style.display = 'grid';

    timeline.scrub(100);
    expect(title.element.style.getPropertyValue('display')).toBe('none');
    expect(title.element.style.getPropertyPriority('display')).toBe('important');

    timeline.scrub(40);
    expect(title.element.style.display).toBe('grid');
    timeline.destroy();
  });

  it('keeps a fading layer just above transparent, so the browser keeps painting it', () => {
    const { timeline, title } = mount();
    timeline.scrub(30); // the title's opacity keyframe is 0 here
    expect(title.element.style.opacity).toBe('0.001');
    timeline.destroy();
  });

  it('places a layer by its sampled motion without re-rendering anything', () => {
    const { timeline, title } = mount();
    timeline.scrub(45);

    const style = title.element.style;
    expect(style.position).toBe('absolute');
    expect(style.left).toBe('160px');
    expect(style.top).toBe('760px');
    expect(style.width).toBe('900px');
    expect(Number(style.opacity)).toBeCloseTo(0.5);
    expect(style.transform).toBe('rotate(0deg) scale(0.75)');
    expect(title.behavior.motion.scale).toBeCloseTo(0.75);

    timeline.scrub(60);
    expect(style.opacity).toBe('');
    expect(style.transform).toBe('');
    timeline.destroy();
  });

  it('hands each frame to the layer draw with its values and time', () => {
    const frames: Array<{ frame: number; time: number; opacity?: number }> = [];
    const { timeline } = mount(({ frame, time, values }) => {
      frames.push({ frame, time, opacity: values.opacity as number | undefined });
    });
    frames.length = 0;

    timeline.scrub(45);
    const title = frames.find((entry) => entry.opacity !== undefined);
    expect(title?.frame).toBe(45);
    expect(title?.time).toBe(0.5);
    timeline.destroy();
  });

  it('holds an async timeline until a layer has drawn its frame', async () => {
    const pending: Array<() => void> = [];
    const { timeline } = mount(() => new Promise<void>((resolve) => pending.push(resolve)));
    timeline.async = true;
    pending.length = 0;

    const scrubbed = timeline.scrub(40);
    expect(timeline.presented).not.toBe(40);
    for (const finish of pending) finish();
    await scrubbed;
    expect(timeline.presented).toBe(40);
    timeline.destroy();
  });

  it('takes a layer off the stage when its element goes', () => {
    const { timeline, title } = mount();
    title.behavior.ref(null);
    const before = title.element.getAttribute('style');
    timeline.scrub(45);
    expect(title.element.getAttribute('style')).toBe(before);
    timeline.destroy();
  });

  it('loads every layer when it mounts, even one whose segment comes later, and is ready after', async () => {
    const cut = buildCut();
    let finishDecode!: () => void;
    const decoding = new Promise<void>((resolve) => (finishDecode = resolve));
    const decoded: string[] = [];

    const { stage, stageEl } = scope.run(() =>
      component().run(() => {
        const stage = aria('video-stage', {}, { timeline: cut.timeline });
        const stageEl = bind(document.createElement('div'), stage);
        document.body.appendChild(stageEl);
        component().run(() => {
          // The title's picture comes from its draw, and its segment isn't on at frame 0.
          const layer = aria('video-clip', {}, {
            segment: cut.title,
            draw: ({ element }) => {
              if (element.querySelector('img')) return;
              const image = document.createElement('img');
              image.src = 'https://example.com/title.png';
              image.decode = () => decoding.then(() => void decoded.push(image.src));
              element.append(image);
            },
          });
          const element = document.createElement('div');
          stageEl.append(element);
          bind(element, layer);
        });
        return { stage, stageEl };
      })
    );

    expect(stageEl.hasAttribute('data-loading')).toBe(true);
    let ready = false;
    stage.ready().then(() => (ready = true));
    await Promise.resolve();
    expect(ready).toBe(false);

    finishDecode();
    await stage.ready();
    expect(decoded).toEqual(['https://example.com/title.png']);
    expect(stageEl.hasAttribute('data-loading')).toBe(false);
    cut.timeline.destroy();
  });

  it('reports capture unavailable where the browser cannot draw HTML into a canvas', () => {
    expect(canCaptureVideo()).toBe(false);
  });
});
