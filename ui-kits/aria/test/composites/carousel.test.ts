import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type CarouselProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildCarousel(props: Partial<CarouselProps>, names: string[]) {
  const carousel = aria('carousel', { label: 'Featured products', ...props } as CarouselProps);
  const carouselEl = bind(document.createElement('div'), carousel);
  document.body.appendChild(carouselEl);

  const viewport = aria('carousel-viewport');
  const viewportEl = document.createElement('div');
  carouselEl.appendChild(viewportEl);
  bind(viewportEl, viewport);

  const slides = names.map((name) => {
    const slide = aria('carousel-slide', { value: name, label: `${name} slide` });
    const el = document.createElement('div');
    viewportEl.appendChild(el);
    bind(el, slide);
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

  const player = aria('carousel-player');
  const playerEl = bind(document.createElement('button'), player);
  carouselEl.appendChild(playerEl);

  return {
    carousel,
    carouselEl,
    viewport,
    viewportEl,
    slides,
    prev,
    prevEl,
    next,
    nextEl,
    pickers,
    player,
    playerEl,
  };
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

          expect(parts.carouselEl.getAttribute('role')).toBe('region');
          expect(parts.carouselEl.getAttribute('aria-roledescription')).toBe('carousel');
          expect(parts.carouselEl.getAttribute('aria-label')).toBe('Featured products');

          expect(parts.slides[0].el.getAttribute('role')).toBe('group');
          expect(parts.slides[0].el.getAttribute('aria-roledescription')).toBe('slide');
          expect(parts.slides[0].el.hasAttribute('hidden')).toBe(false);
          expect(parts.slides[1].el.hidden).toBe(true);
          expect(parts.slides[2].el.hidden).toBe(true);

          parts.nextEl.click();
          expect(parts.carousel.properties.value).toBe('two');
          expect(parts.slides[1].el.hidden).toBe(false);
          expect(parts.slides[0].el.hidden).toBe(true);

          parts.prevEl.click();
          parts.prevEl.click();
          expect(parts.carousel.properties.value).toBe('one');

          parts.prevEl.click();
          expect(parts.carousel.properties.value).toBe('one');

          parts.carousel.properties.loop = true;
          parts.prevEl.click();
          expect(parts.carousel.properties.value).toBe('three');
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
          expect(parts.carousel.properties.value).toBe('three');
          expect(parts.pickers[2].el.getAttribute('aria-current')).toBe('true');
          expect(parts.pickers[0].el.getAttribute('aria-current')).toBeNull();

          parts.viewportEl.focus();

          travel(parts.viewportEl, 'ArrowLeft');
          expect(parts.carousel.properties.value).toBe('two');

          travel(parts.viewportEl, 'ArrowRight');
          expect(parts.carousel.properties.value).toBe('three');

          travel(parts.viewportEl, 'End');
          expect(parts.carousel.properties.value).toBe('three');

          travel(parts.viewportEl, 'Home');
          expect(parts.carousel.properties.value).toBe('one');

          for (const nav of [parts.prevEl, parts.nextEl]) {
            const controls = nav.getAttribute('aria-controls');
            expect(typeof controls).toBe('string');
            expect((controls as string).length).toBeGreaterThan(0);
            expect(document.getElementById(controls as string)).not.toBeNull();
          }

          parts.carouselEl.remove();
        });
      }));

    it('wraps forward from the last slide when loop is on', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'three', loop: true }, ['one', 'two', 'three']);
          parts.nextEl.click();
          expect(parts.carousel.properties.value).toBe('one');
          expect(parts.slides[0].el.hidden).toBe(false);
          expect(parts.slides[2].el.hidden).toBe(true);
          parts.carouselEl.remove();
        });
      }));

    it('keeps exactly one slide visible for every value', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one', loop: true }, ['one', 'two', 'three']);
          for (const name of ['one', 'two', 'three']) {
            parts.carousel.properties.value = name;
            const visible = parts.slides.filter((s) => !s.el.hidden);
            expect(visible.length).toBe(1);
            expect(visible[0].name).toBe(name);
          }
          parts.carouselEl.remove();
        });
      }));
  });

  describe('Part Semantics & Association Invariant', () => {
    it('exposes a focusable viewport with atomic live region', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one' }, ['one', 'two']);
          expect(parts.viewportEl.getAttribute('tabindex')).toBe('0');
          expect(parts.viewport.attributes['aria-atomic']).toBe('false');
          expect(parts.viewportEl.getAttribute('aria-atomic')).toBe('false');
          parts.carouselEl.remove();
        });
      }));

    it('labels nav buttons and points every control at the viewport', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one' }, ['one', 'two', 'three']);
          expect(parts.viewportEl.id.length).toBeGreaterThan(0);
          expect(parts.prevEl.getAttribute('aria-label')).toBe('Previous slide');
          expect(parts.nextEl.getAttribute('aria-label')).toBe('Next slide');
          expect(parts.prevEl.getAttribute('aria-controls')).toBe(parts.viewportEl.id);
          expect(parts.nextEl.getAttribute('aria-controls')).toBe(parts.viewportEl.id);
          for (const p of parts.pickers) {
            expect(p.el.getAttribute('aria-controls')).toBe(parts.viewportEl.id);
          }
          expect(parts.playerEl.getAttribute('aria-controls')).toBe(parts.viewportEl.id);
          expect(document.getElementById(parts.viewportEl.id)).toBe(parts.viewportEl);
          parts.carouselEl.remove();
        });
      }));

    it('names each picker after its target slide and marks only the current one', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'two' }, ['one', 'two', 'three']);
          parts.pickers.forEach((p, i) => {
            expect(p.el.getAttribute('aria-label')).toBe(parts.slides[i].el.getAttribute('aria-label'));
          });
          expect(parts.pickers[1].el.getAttribute('aria-current')).toBe('true');
          expect(parts.pickers[0].el.hasAttribute('aria-current')).toBe(false);
          expect(parts.pickers[2].el.hasAttribute('aria-current')).toBe(false);
          parts.carouselEl.remove();
        });
      }));

    it('announces rotation state through the rotation label with no pressed state', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one', autoplay: true }, ['one', 'two']);
          expect(parts.playerEl.getAttribute('aria-label')).toBe('Stop slide rotation');
          expect(parts.playerEl.hasAttribute('aria-pressed')).toBe(false);
          parts.playerEl.click();
          expect(parts.playerEl.getAttribute('aria-label')).toBe('Start slide rotation');
          expect(parts.playerEl.hasAttribute('aria-pressed')).toBe(false);
          parts.playerEl.click();
          expect(parts.playerEl.getAttribute('aria-label')).toBe('Stop slide rotation');
          parts.carouselEl.remove();
        });
      }));

    it('starts stopped with a start label when autoplay is off', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one' }, ['one', 'two']);
          expect(parts.playerEl.getAttribute('aria-label')).toBe('Start slide rotation');
          expect(parts.playerEl.hasAttribute('aria-pressed')).toBe(false);
          parts.carouselEl.remove();
        });
      }));

    it('defaults slide labels to position and total', () =>
      scope.run(() => {
        component().run(() => {
          const carousel = aria('carousel', { label: 'Gallery' } as CarouselProps);
          const carouselEl = bind(document.createElement('div'), carousel);
          document.body.appendChild(carouselEl);
          const viewport = aria('carousel-viewport');
          const viewportEl = document.createElement('div');
          carouselEl.appendChild(viewportEl);
          bind(viewportEl, viewport);
          const els = ['a', 'b', 'c', 'd', 'e'].map((value) => {
            const slide = aria('carousel-slide', { value });
            const el = document.createElement('div');
            viewportEl.appendChild(el);
            bind(el, slide);
            return el;
          });
          expect(els[0].getAttribute('aria-label')).toBe('1 of 5');
          expect(els[1].getAttribute('aria-label')).toBe('2 of 5');
          expect(els[4].getAttribute('aria-label')).toBe('5 of 5');
          carouselEl.remove();
        });
      }));
  });

  describe('Value Resolution & Control Availability Invariant', () => {
    it('resolves an absent value to the first slide', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({}, ['one', 'two', 'three']);
          expect(parts.carousel.properties.value).toBe('one');
          expect(parts.slides[0].el.hidden).toBe(false);
          parts.carouselEl.remove();
        });
      }));

    it('resolves an unknown value to the first slide', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'missing' }, ['one', 'two', 'three']);
          expect(parts.carousel.properties.value).toBe('one');
          expect(parts.slides[0].el.hidden).toBe(false);
          expect(parts.slides[1].el.hidden).toBe(true);
          parts.carouselEl.remove();
        });
      }));

    it('resolves an empty carousel to null and stops rotation', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one', autoplay: true }, []);
          expect(parts.carousel.properties.value).toBeNull();
          expect(parts.carousel.properties.autoplay).toBe(false);
          parts.carouselEl.remove();
        });
      }));

    it('disables previous at the first slide and next at the last without loop', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one', loop: false }, ['one', 'two', 'three']);
          expect(parts.prevEl.disabled).toBe(true);
          expect(parts.nextEl.disabled).toBe(false);
          const changes: unknown[] = [];
          parts.carouselEl.addEventListener('change', (e) => changes.push((e as CustomEvent).detail));
          parts.prevEl.click();
          expect(parts.carousel.properties.value).toBe('one');
          expect(changes).toEqual([]);
          parts.nextEl.click();
          expect(parts.carousel.properties.value).toBe('two');
          parts.carousel.properties.value = 'three';
          expect(parts.nextEl.disabled).toBe(true);
          expect(parts.prevEl.disabled).toBe(false);
          parts.nextEl.click();
          expect(parts.carousel.properties.value).toBe('three');
          parts.carouselEl.remove();
        });
      }));

    it('locks out activation events on disabled nav controls', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one', loop: false }, ['one', 'two']);
          expect(parts.prevEl.disabled).toBe(true);
          const changes: unknown[] = [];
          parts.carouselEl.addEventListener('change', (e) => changes.push((e as CustomEvent).detail));
          travel(parts.prevEl, 'Enter');
          travel(parts.prevEl, ' ');
          parts.prevEl.click();
          expect(parts.carousel.properties.value).toBe('one');
          expect(changes).toEqual([]);
          parts.carouselEl.remove();
        });
      }));

    it('disables previous, next and player with fewer than two slides', () =>
      scope.run(() => {
        component().run(() => {
          const single = buildCarousel({ value: 'only' }, ['only']);
          expect(single.prevEl.disabled).toBe(true);
          expect(single.nextEl.disabled).toBe(true);
          expect(single.playerEl.disabled).toBe(true);
          single.carouselEl.remove();

          const empty = buildCarousel({}, []);
          expect(empty.prevEl.disabled).toBe(true);
          expect(empty.nextEl.disabled).toBe(true);
          expect(empty.playerEl.disabled).toBe(true);
          empty.carouselEl.remove();
        });
      }));

    it('stops rotation when the timer reaches the last slide without loop', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();
          const parts = buildCarousel({ value: 'two', autoplay: true, loop: false, interval: 1000 }, [
            'one',
            'two',
            'three',
          ]);
          const toggles: unknown[] = [];
          parts.carouselEl.addEventListener('toggle', (e) => toggles.push((e as CustomEvent).detail));
          vi.advanceTimersByTime(1000);
          expect(parts.carousel.properties.value).toBe('three');
          expect(parts.carousel.properties.autoplay).toBe(false);
          expect(toggles).toEqual([false]);
          vi.advanceTimersByTime(5000);
          expect(parts.carousel.properties.value).toBe('three');
          vi.useRealTimers();
          parts.carouselEl.remove();
        });
      }));
  });

  describe('Temporal Auto-Advance & Interactive Pause Invariant', () => {
    it('advances on the declared interval and announces each rotation change', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();

          const parts = buildCarousel({ value: 'one', autoplay: true, interval: 2000 }, ['one', 'two', 'three']);

          const toggles: unknown[] = [];
          parts.carouselEl.addEventListener('toggle', (event) => toggles.push((event as CustomEvent).detail));

          const advances: unknown[] = [];
          parts.carouselEl.addEventListener('change', (event) => advances.push((event as CustomEvent).detail));

          vi.advanceTimersByTime(2000);
          expect(parts.carousel.properties.value).toBe('two');
          expect(advances).toEqual(['two']);

          vi.advanceTimersByTime(4000);
          expect(parts.carousel.properties.value).toBe('one');
          expect(advances).toEqual(['two', 'three', 'one']);

          parts.playerEl.click();
          expect(parts.carousel.properties.autoplay).toBe(false);
          expect(toggles).toEqual([false]);

          const before = parts.carousel.properties.value;
          vi.advanceTimersByTime(10000);
          expect(parts.carousel.properties.value).toBe(before);

          parts.playerEl.click();
          expect(toggles).toEqual([false, true]);
          vi.advanceTimersByTime(2000);
          expect(parts.carousel.properties.value).not.toBe(before);

          vi.useRealTimers();
          parts.carouselEl.remove();
        });
      }));

    it('restarts the autoplay countdown on manual navigation', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();
          const parts = buildCarousel({ value: 'one', autoplay: true, interval: 5000 }, ['one', 'two', 'three']);
          vi.advanceTimersByTime(4000);
          expect(parts.carousel.properties.value).toBe('one');
          parts.nextEl.click();
          expect(parts.carousel.properties.value).toBe('two');
          vi.advanceTimersByTime(4999);
          expect(parts.carousel.properties.value).toBe('two');
          vi.advanceTimersByTime(1);
          expect(parts.carousel.properties.value).toBe('three');
          vi.useRealTimers();
          parts.carouselEl.remove();
        });
      }));

    it('calls the onchange prop for button, picker and keyboard travel', () =>
      scope.run(() => {
        component().run(() => {
          const seen: unknown[] = [];
          const parts = buildCarousel(
            {
              value: 'one',
              loop: true,
              onchange: (event) => seen.push((event as CustomEvent).detail),
            },
            ['one', 'two', 'three']
          );
          parts.nextEl.click();
          parts.pickers[2].el.click();
          travel(parts.viewportEl, 'ArrowRight');
          expect(seen).toEqual(['two', 'three', 'one']);
          parts.carouselEl.remove();
        });
      }));

    it('advances on the default five second interval', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();
          const parts = buildCarousel({ value: 'one', autoplay: true }, ['one', 'two', 'three']);
          vi.advanceTimersByTime(4999);
          expect(parts.carousel.properties.value).toBe('one');
          vi.advanceTimersByTime(1);
          expect(parts.carousel.properties.value).toBe('two');
          vi.useRealTimers();
          parts.carouselEl.remove();
        });
      }));

    it('pauses for pointer and focus interaction and only resumes if it was autoplay', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();

          const parts = buildCarousel({ value: 'one', autoplay: true }, ['one', 'two', 'three']);

          parts.carouselEl.dispatchEvent(new Event('pointerenter'));
          vi.advanceTimersByTime(20000);
          expect(parts.carousel.properties.value).toBe('one');

          parts.carouselEl.dispatchEvent(new Event('pointerleave'));
          vi.advanceTimersByTime(5000);
          expect(parts.carousel.properties.value).toBe('two');

          parts.carousel.properties.autoplay = false;
          parts.carouselEl.dispatchEvent(new Event('pointerenter'));
          parts.carouselEl.dispatchEvent(new Event('pointerleave'));
          vi.advanceTimersByTime(20000);
          expect(parts.carousel.properties.value).toBe('two');

          parts.carousel.properties.autoplay = true;
          parts.viewportEl.focus();
          expect(parts.carousel.properties.autoplay).toBe(false);

          vi.advanceTimersByTime(20000);
          expect(parts.carousel.properties.value).toBe('two');

          vi.useRealTimers();
          parts.carouselEl.remove();
        });
      }));

    it('changes neither value nor rotation and emits nothing while pointer paused', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();
          const parts = buildCarousel({ value: 'one', autoplay: true, interval: 1000 }, ['one', 'two']);
          const changes: unknown[] = [];
          const toggles: unknown[] = [];
          parts.carouselEl.addEventListener('change', (e) => changes.push((e as CustomEvent).detail));
          parts.carouselEl.addEventListener('toggle', (e) => toggles.push((e as CustomEvent).detail));
          parts.carouselEl.dispatchEvent(new Event('pointerenter'));
          vi.advanceTimersByTime(5000);
          expect(parts.carousel.properties.value).toBe('one');
          expect(parts.carousel.properties.autoplay).toBe(true);
          expect(changes).toEqual([]);
          expect(toggles).toEqual([]);
          vi.useRealTimers();
          parts.carouselEl.remove();
        });
      }));

    it('announces rotation stop when focus enters the carousel', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();
          const parts = buildCarousel({ value: 'one', autoplay: true }, ['one', 'two']);
          const toggles: unknown[] = [];
          parts.carouselEl.addEventListener('toggle', (e) => toggles.push((e as CustomEvent).detail));
          parts.viewportEl.focus();
          expect(parts.carousel.properties.autoplay).toBe(false);
          expect(toggles).toEqual([false]);
          vi.useRealTimers();
          parts.carouselEl.remove();
        });
      }));
  });

  describe('Live Announcement & Slide Association Invariant', () => {
    it('switches the viewport politeness with rotation state', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one', autoplay: true }, ['one', 'two']);

          expect(parts.viewport.attributes['aria-live']).toBe('off');
          expect(parts.viewport.attributes['aria-atomic']).toBe('false');

          parts.playerEl.click();
          expect(parts.viewportEl.getAttribute('aria-live')).toBe('polite');

          parts.playerEl.click();
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

          parts.carousel.properties.value = 'three';
          expect(parts.slides[2].el.hidden).toBe(false);
          expect(parts.slides[1].el.hidden).toBe(true);
          expect(parts.slides[2].el.getAttribute('aria-label')).toBe('three slide');

          parts.carouselEl.remove();
        });
      }));

    it('moves focus to the viewport when the focused slide is deactivated', () =>
      scope.run(() => {
        component().run(() => {
          const parts = buildCarousel({ value: 'one' }, ['one', 'two']);
          const inner = document.createElement('button');
          inner.textContent = 'inside';
          parts.slides[0].el.appendChild(inner);
          inner.focus();
          expect(document.activeElement).toBe(inner);
          parts.carousel.properties.value = 'two';
          expect(document.activeElement).toBe(parts.viewportEl);
          parts.carouselEl.remove();
        });
      }));
  });
});
