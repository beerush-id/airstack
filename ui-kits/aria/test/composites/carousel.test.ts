import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type CarouselProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildCarousel(props: Partial<CarouselProps>, names: string[]) {
  const carousel = aria('carousel', { label: 'Featured products', ...props } as CarouselProps);
  const carouselEl = bind(document.createElement('div'), carousel);
  document.body.appendChild(carouselEl);

  const viewport = aria('carousel-viewport');
  const viewportEl = bind(document.createElement('div'), viewport);
  carouselEl.appendChild(viewportEl);

  const slides = names.map((name) => {
    const slide = aria('carousel-slide', { value: name, label: `${name} slide` });
    const el = bind(document.createElement('div'), slide);
    viewportEl.appendChild(el);
    return { name, slide, el };
  });

  const prev = aria('carousel-prev');
  const prevEl = bind(document.createElement('button'), prev);
  const next = aria('carousel-next');
  const nextEl = bind(document.createElement('button'), next);
  carouselEl.append(prevEl, nextEl);

  const pickers = names.map((name) => {
    const picker = aria('carousel-picker', { value: name });
    const el = bind(document.createElement('button'), picker);
    carouselEl.appendChild(el);
    return { name, picker, el };
  });

  const rotation = aria('carousel-rotation');
  const rotationEl = bind(document.createElement('button'), rotation);
  carouselEl.appendChild(rotationEl);

  return { carousel, carouselEl, viewport, viewportEl, slides, prev, prevEl, next, nextEl, pickers, rotation, rotationEl };
}

function travel(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('Carousel - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Rotational Item Traversal & Cycle Invariant', () => {
    it('moves the active slide through the nav buttons and keeps one slide visible', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one' }, ['one', 'two', 'three']);

          // The container is a named region, the slides are groups
          expect(parts.carouselEl.getAttribute('role')).toBe('region');
          expect(parts.carouselEl.getAttribute('aria-roledescription')).toBe('carousel');
          expect(parts.carouselEl.getAttribute('aria-label')).toBe('Featured products');

          expect(parts.slides[0].el.getAttribute('role')).toBe('group');
          expect(parts.slides[0].el.getAttribute('aria-roledescription')).toBe('slide');
          expect(parts.slides[0].el.hasAttribute('hidden')).toBe(false);
          expect(parts.slides[1].el.hidden).toBe(true);
          expect(parts.slides[2].el.hidden).toBe(true);

          parts.nextEl.click();
          expect(parts.carousel.props.value).toBe('two');
          expect(parts.slides[1].el.hidden).toBe(false);
          expect(parts.slides[0].el.hidden).toBe(true);

          parts.prevEl.click();
          parts.prevEl.click();
          expect(parts.carousel.props.value).toBe('one');

          // Without loop, retreating from the first slide is inert
          parts.prevEl.click();
          expect(parts.carousel.props.value).toBe('one');

          // With loop, the same press wraps to the last slide
          parts.carousel.props.loop = true;
          parts.prevEl.click();
          expect(parts.carousel.props.value).toBe('three');
          expect(parts.slides[2].el.hidden).toBe(false);

          parts.carouselEl.remove();
        });
      }));

    it('marks the chosen picker as current and travels from the viewport keyboard', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one', loop: true }, ['one', 'two', 'three']);

          expect(parts.pickers[0].el.getAttribute('aria-current')).toBe('true');
          expect(parts.pickers[1].el.hasAttribute('aria-current')).toBe(false);

          parts.pickers[2].el.click();
          expect(parts.carousel.props.value).toBe('three');
          expect(parts.pickers[2].el.getAttribute('aria-current')).toBe('true');
          expect(parts.pickers[0].el.getAttribute('aria-current')).toBeNull();

          // The viewport owns the arrow and boundary keys
          parts.viewportEl.focus();

          travel(parts.viewportEl, 'ArrowLeft');
          expect(parts.carousel.props.value).toBe('one');

          travel(parts.viewportEl, 'ArrowRight');
          expect(parts.carousel.props.value).toBe('two');

          travel(parts.viewportEl, 'End');
          expect(parts.carousel.props.value).toBe('three');

          travel(parts.viewportEl, 'Home');
          expect(parts.carousel.props.value).toBe('one');

          // The nav buttons address a control that actually exists in the document
          for (const nav of [parts.prevEl, parts.nextEl]) {
            const controls = nav.getAttribute('aria-controls');
            expect(typeof controls).toBe('string');
            expect((controls as string).length).toBeGreaterThan(0);
            expect(document.getElementById(controls as string)).not.toBeNull();
          }

          parts.carouselEl.remove();
        });
      }));
  });

  describe('Temporal Auto-Advance & Interactive Pause Invariant', () => {
    it('advances on the declared interval and announces each rotation change', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();

          const parts = buildCarousel({ value: 'one', rotating: true, interval: 2000 }, [
            'one',
            'two',
            'three',
          ]);

          const toggles: unknown[] = [];
          parts.carouselEl.addEventListener('toggle', (event) =>
            toggles.push((event as CustomEvent).detail),
          );

          const advances: unknown[] = [];
          parts.carouselEl.addEventListener('change', (event) =>
            advances.push((event as CustomEvent).detail),
          );

          vi.advanceTimersByTime(2000);
          expect(parts.carousel.props.value).toBe('two');
          expect(advances).toEqual(['two']);

          vi.advanceTimersByTime(4000);
          expect(parts.carousel.props.value).toBe('one');
          expect(advances).toEqual(['two', 'three', 'one']);

          // Stopping rotation announces the state, not a slide move
          parts.rotationEl.click();
          expect(parts.carousel.props.rotating).toBe(false);
          expect(toggles).toEqual([false]);

          const before = parts.carousel.props.value;
          vi.advanceTimersByTime(10000);
          expect(parts.carousel.props.value).toBe(before);

          parts.rotationEl.click();
          expect(toggles).toEqual([false, true]);
          vi.advanceTimersByTime(2000);
          expect(parts.carousel.props.value).not.toBe(before);

          vi.useRealTimers();
          parts.carouselEl.remove();
        });
      }));

    it('pauses for pointer and focus interaction and only resumes if it was rotating', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();

          const parts = buildCarousel({ value: 'one', rotating: true }, ['one', 'two', 'three']);

          // Hovering the carousel is a request for the timer to hold
          parts.carouselEl.dispatchEvent(new Event('pointerenter'));
          vi.advanceTimersByTime(20000);
          expect(parts.carousel.props.value).toBe('one');

          parts.carouselEl.dispatchEvent(new Event('pointerleave'));
          vi.advanceTimersByTime(5000);
          expect(parts.carousel.props.value).toBe('two');

          // A pointer over a slide while not rotating stays put after leaving
          parts.carousel.props.rotating = false;
          parts.carouselEl.dispatchEvent(new Event('pointerenter'));
          parts.carouselEl.dispatchEvent(new Event('pointerleave'));
          vi.advanceTimersByTime(20000);
          expect(parts.carousel.props.value).toBe('two');

          // Focus anywhere inside stops rotation outright, not merely pauses it
          parts.carousel.props.rotating = true;
          parts.viewportEl.focus();
          expect(parts.carousel.props.rotating).toBe(false);

          vi.advanceTimersByTime(20000);
          expect(parts.carousel.props.value).toBe('two');

          vi.useRealTimers();
          parts.carouselEl.remove();
        });
      }));
  });

  describe('Live Announcement & Slide Association Invariant', () => {
    it('switches the viewport politeness with rotation state', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one', rotating: true }, ['one', 'two']);

          // Timed movement must not interrupt the reader
          expect(parts.viewport.attributes['aria-live']).toBe('off');
          expect(parts.viewport.attributes['aria-atomic']).toBe('false');

          parts.rotationEl.click();
          expect(parts.viewportEl.getAttribute('aria-live')).toBe('polite');

          parts.rotationEl.click();
          expect(parts.viewportEl.getAttribute('aria-live')).toBe('off');

          parts.carouselEl.remove();
        });
      }));

    it('keeps inactive slides out of the reading and focus order', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'two' }, ['one', 'two', 'three']);

          expect(parts.slides[1].el.hasAttribute('hidden')).toBe(false);
          expect(parts.slides[1].el.getAttribute('aria-label')).toBe('two slide');

          for (const index of [0, 2]) {
            expect(parts.slides[index].el.hidden).toBe(true);
            expect(parts.slides[index].el.hasAttribute('inert')).toBe(false);
            expect(parts.slides[index].el.getAttribute('aria-roledescription')).toBe('slide');
          }

          // Advancing moves the visible slide and its label together
          parts.carousel.props.value = 'three';
          expect(parts.slides[2].el.hidden).toBe(false);
          expect(parts.slides[1].el.hidden).toBe(true);
          expect(parts.slides[2].el.getAttribute('aria-label')).toBe('three slide');

          parts.carouselEl.remove();
        });
      }));
  });
});
