import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  aria,
  CarouselAria,
  CarouselNavAria,
  CarouselPickerAria,
  CarouselPlayerAria,
  type CarouselProps,
  CarouselSlideAria,
  CarouselViewportAria,
} from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildFull(props: Partial<CarouselProps>, names: string[]) {
  const carousel = aria('carousel', { label: 'Gallery', ...props, keys: names } as CarouselProps);
  const carouselEl = bind(document.createElement('div'), carousel);
  document.body.appendChild(carouselEl);
  const viewport = aria('carousel-viewport');
  const viewportEl = document.createElement('div');
  carouselEl.appendChild(viewportEl);
  bind(viewportEl, viewport);
  const slides = names.map((name) => {
    const slide = aria('carousel-slide', { name });
    const el = document.createElement('div');
    viewportEl.appendChild(el);
    bind(el, slide);
    return { name, slide, el };
  });
  const prev = aria('carousel-nav', { label: 'Previous slide', direction: -1 });
  const prevEl = bind(document.createElement('button'), prev);
  const next = aria('carousel-nav', { label: 'Next slide', direction: 1 });
  const nextEl = bind(document.createElement('button'), next);
  carouselEl.append(prevEl, nextEl);
  const pickers = names.map((name) => {
    const picker = aria('carousel-picker', { name, label: `${name} slide` });
    const el = bind(document.createElement('button'), picker);
    carouselEl.appendChild(el);
    return { name, picker, el };
  });
  const player = aria('carousel-player', { label: 'Start slide rotation', playingLabel: 'Stop slide rotation' });
  const playerEl = bind(document.createElement('button'), player);
  carouselEl.appendChild(playerEl);
  return { carousel, carouselEl, viewport, viewportEl, slides, prev, prevEl, next, nextEl, pickers, player, playerEl };
}

describe('Carousel - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('reads playing and autoplay projections on every part', () =>
    scope.run(() => {
      component().run(() => {
        const parts = buildFull({ value: 'one', autoplay: true }, ['one', 'two']);
        expect(parts.carousel.playing).toBe(true);
        expect(parts.carousel.autoplay).toBe(true);
        expect(parts.carousel.disabled).toBe(false);
        expect(parts.carousel.viewportId.endsWith('-viewport')).toBe(true);
        expect(parts.viewport.playing).toBe(true);
        expect(parts.viewport.autoplay).toBe(true);
        expect(parts.slides[0].slide.playing).toBe(true);
        expect(parts.slides[0].slide.autoplay).toBe(true);
        expect(parts.slides[0].slide.active).toBe(true);
        expect(parts.slides[0].slide.selected).toBe(true);
        expect(parts.prev.playing).toBe(true);
        expect(parts.prev.autoplay).toBe(true);
        expect(parts.next.playing).toBe(true);
        expect(parts.next.autoplay).toBe(true);
        expect(parts.pickers[0].picker.active).toBe(true);
        expect(parts.pickers[0].picker.playing).toBe(true);
        expect(parts.pickers[0].picker.autoplay).toBe(true);
        expect(parts.player.playing).toBe(true);
        expect(parts.player.autoplay).toBe(true);
        expect(parts.carousel.pickers.length).toBeGreaterThan(0);
        parts.carouselEl.remove();
      });
    }));

  it('returns empty pickers before mount and resolves key fallbacks on slides', () =>
    scope.run(() => {
      component().run(() => {
        const carousel = aria('carousel', { label: 'Gallery', keys: ['a'] } as CarouselProps);
        expect(carousel.pickers).toEqual([]);
        const fallback = aria('carousel-slide', {} as never);
        expect(typeof fallback.key).toBe('string');
        expect(fallback.active).toBe(false);
        expect(fallback.selected).toBe(false);
        expect(fallback.playing).toBe(false);
        expect(fallback.autoplay).toBe(false);
      });
    }));

  it('covers detached part projections without a carousel context', () =>
    scope.run(() => {
      const viewport = aria('carousel-viewport');
      expect(viewport.playing).toBe(false);
      expect(viewport.autoplay).toBe(false);
      const picker = aria('carousel-picker', { name: 'solo', label: 'Solo slide' });
      expect(picker.playing).toBe(false);
      expect(picker.autoplay).toBe(false);
      const player = aria('carousel-player', { label: 'Start slide rotation' });
      expect(player.playing).toBe(false);
      expect(player.autoplay).toBe(false);
      const prev = aria('carousel-nav', { label: 'Previous slide', direction: -1 });
      expect(prev.playing).toBe(false);
      expect(prev.autoplay).toBe(false);
    }));

  it('compiles custom-host nav with aria-disabled and default direction', () =>
    scope.run(() => {
      component().run(() => {
        const carousel = aria('carousel', { label: 'Gallery', keys: ['a', 'b'], value: 'a' } as CarouselProps);
        const carouselEl = bind(document.createElement('div'), carousel);
        document.body.appendChild(carouselEl);
        const customPrev = aria('carousel-nav', { label: 'Previous slide', direction: -1 }, { native: false });
        expect(customPrev.attributes['aria-disabled']).toBe('true');
        expect(customPrev.attributes.role).toBe('button');
        const customNext = aria('carousel-nav', { label: 'Next slide', direction: 1 }, { native: false });
        expect(customNext.attributes['aria-disabled']).toBe('false');
        const prevEl = bind(document.createElement('div'), customPrev);
        prevEl.click();
        expect(carousel.value).toBe('a');
        carouselEl.remove();
      });
    }));

  it('ignores nav activation while disabled and steps without an event', () =>
    scope.run(() => {
      component().run(() => {
        const parts = buildFull({ value: 'one', loop: false }, ['one', 'two']);
        expect(parts.prevEl.disabled).toBe(true);
        parts.prevEl.click();
        expect(parts.carousel.value).toBe('one');
        parts.carousel.step(1);
        expect(parts.carousel.value).toBe('two');
        parts.carousel.step(-1);
        expect(parts.carousel.value).toBe('one');
        parts.carouselEl.remove();
      });
    }));

  it('respects arrowNav false on container keydown', () =>
    scope.run(() => {
      component().run(() => {
        const parts = buildFull({ value: 'one', loop: true, arrowNav: false } as Partial<CarouselProps>, [
          'one',
          'two',
        ]);
        parts.carouselEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(parts.carousel.value).toBe('one');
        parts.carouselEl.remove();
      });
    }));

  it('restores autoplay on focusout and pointerleave and announces both edges', () =>
    scope.run(() => {
      component().run(() => {
        vi.useFakeTimers();
        const parts = buildFull({ value: 'one', autoplay: true }, ['one', 'two']);
        const toggles: unknown[] = [];
        parts.carouselEl.addEventListener('toggle', (e) => toggles.push((e as CustomEvent).detail));
        parts.viewportEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        expect(parts.carousel.autoplay).toBe(false);
        parts.viewportEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        expect(parts.carousel.autoplay).toBe(true);
        parts.viewportEl.dispatchEvent(new Event('pointerenter'));
        expect(parts.carousel.autoplay).toBe(false);
        parts.viewportEl.dispatchEvent(new Event('pointerleave'));
        expect(parts.carousel.autoplay).toBe(true);
        expect(toggles).toEqual([false, true, false, true]);
        vi.useRealTimers();
        parts.carouselEl.remove();
      });
    }));

  it('leaves autoplay off on pointerleave when it was already off', () =>
    scope.run(() => {
      component().run(() => {
        vi.useFakeTimers();
        const parts = buildFull({ value: 'one', autoplay: false }, ['one', 'two']);
        const toggles: unknown[] = [];
        parts.carouselEl.addEventListener('toggle', (e) => toggles.push((e as CustomEvent).detail));
        parts.viewportEl.dispatchEvent(new Event('pointerenter'));
        parts.viewportEl.dispatchEvent(new Event('pointerleave'));
        expect(parts.carousel.autoplay).toBe(false);
        expect(toggles).toEqual([false, false]);
        vi.useRealTimers();
        parts.carouselEl.remove();
      });
    }));

  it('forwards ontoggle and ignores player toggle while disabled or vetoed', () =>
    scope.run(() => {
      component().run(() => {
        const seen: unknown[] = [];
        const parts = buildFull(
          { value: 'solo', autoplay: false, ontoggle: (e) => seen.push((e as CustomEvent).detail) },
          ['solo']
        );
        expect(parts.player.disabled).toBe(true);
        parts.playerEl.click();
        expect(seen).toEqual([]);
        parts.carouselEl.remove();
        const lone = aria('carousel-player', { label: 'Start slide rotation' });
        const loneEl = bind(document.createElement('button'), lone);
        loneEl.click();
      });
    }));

  it('covers constructor defaults, explicit namespace, and direction fallback', () =>
    scope.run(() => {
      component().run(() => {
        const bare = aria('carousel', { label: 'Bare' } as CarouselProps);
        expect(Array.isArray(bare.properties.keys)).toBe(true);
        expect(bare.id.startsWith('carousel-')).toBe(true);
        const named = aria('carousel', {
          label: 'Named',
          id: 'featured',
          keys: ['a', 'b'],
          orientation: 'vertical',
        } as CarouselProps);
        expect(named.id).toBe('featured');
        expect(named.viewportId).toBe('featured-viewport');
        const namedEl = bind(document.createElement('div'), named);
        document.body.appendChild(namedEl);
        const defaultDir = aria('carousel-nav', { label: 'Previous slide' });
        const defaultEl = bind(document.createElement('button'), defaultDir);
        namedEl.appendChild(defaultEl);
        defaultEl.click();
        const detachedNav = aria('carousel-nav', { label: 'Previous slide', direction: -1 });
        const detachedEl = bind(document.createElement('button'), detachedNav);
        detachedEl.click();
        const customPicker = new CarouselPickerAria({ name: 'a', label: 'A slide' }, { native: false });
        expect(customPicker.attributes.role).toBe('button');
        expect(customPicker.attributes['aria-disabled']).toBe('false');
        const bareViewport = aria('carousel-viewport');
        const bareViewportEl = bind(document.createElement('div'), bareViewport);
        bareViewportEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        bareViewportEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        bareViewportEl.dispatchEvent(new Event('pointerenter'));
        bareViewportEl.dispatchEvent(new Event('pointerleave'));
        namedEl.remove();
        detachedEl.remove();
        bareViewportEl.remove();
      });
    }));

  it('covers no-arg construction and truly detached viewport edges', () =>
    scope.run(() => {
      component().run(() => {
        const bareSlide = new CarouselSlideAria();
        expect(typeof bareSlide.key).toBe('string');
        expect(bareSlide.selected).toBe(false);
        const bareViewport = new CarouselViewportAria();
        expect(bareViewport.playing).toBe(false);
        const el = bind(document.createElement('div'), bareViewport);
        el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        el.dispatchEvent(new Event('pointerenter'));
        el.dispatchEvent(new Event('pointerleave'));
        const bareNav = new CarouselNavAria();
        expect(bareNav.playing).toBe(false);
        const navEl = bind(document.createElement('button'), bareNav);
        navEl.click();
        el.remove();
        navEl.remove();
      });
      component().run(() => {
        const bareCarousel = new CarouselAria();
        expect(Array.isArray(bareCarousel.properties.keys)).toBe(true);
        const barePicker = new CarouselPickerAria();
        expect(barePicker.active).toBe(false);
        const barePlayer = new CarouselPlayerAria();
        expect(barePlayer.disabled).toBe(true);
      });
    }));

  it('ignores player toggle when the click is vetoed', () =>
    scope.run(() => {
      component().run(() => {
        const parts = buildFull({ value: 'one', autoplay: true }, ['one', 'two']);
        const veto = new MouseEvent('click', { bubbles: true, cancelable: true });
        veto.preventDefault();
        parts.playerEl.dispatchEvent(veto);
        expect(parts.carousel.autoplay).toBe(true);
        parts.carouselEl.remove();
      });
    }));

  it('disables nav and player through group disabled and destroys the timer', () =>
    scope.run(() => {
      component().run(() => {
        vi.useFakeTimers();
        const parts = buildFull({ value: 'one', autoplay: true, disabled: true } as Partial<CarouselProps>, [
          'one',
          'two',
        ]);
        expect(parts.prev.disabled).toBe(true);
        expect(parts.next.disabled).toBe(true);
        expect(parts.player.disabled).toBe(true);
        parts.carousel.autoplay = true;
        parts.carousel.playing = true;
        expect(parts.carousel.playing).toBe(true);
        parts.carousel.destroy();
        vi.advanceTimersByTime(20000);
        expect(parts.carousel.value).toBe('one');
        vi.useRealTimers();
        parts.carouselEl.remove();
      });
    }));

  it('pauses without an element and plays only while autoplay', () =>
    scope.run(() => {
      component().run(() => {
        const carousel = aria('carousel', { label: 'Gallery', keys: ['a', 'b'] } as CarouselProps);
        carousel.pause();
        carousel.autoplay = false;
        carousel.play();
        expect(carousel.playing).toBe(false);
        carousel.autoplay = true;
        carousel.play();
        expect(carousel.playing).toBe(true);
        carousel.pause();
        expect(carousel.playing).toBe(false);
        carousel.destroy();
      });
    }));
});
