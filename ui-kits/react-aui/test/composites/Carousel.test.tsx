import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import {
  Carousel,
  CarouselNav,
  CarouselPicker,
  CarouselPlayer,
  CarouselSlide,
  CarouselViewport,
} from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

type SlidesProps = {
  value?: string;
  loop?: boolean;
  disabled?: boolean;
  autoplay?: boolean;
  onchange?: (event: CustomEvent<string | undefined>) => void;
  ontoggle?: (event: CustomEvent<boolean>) => void;
};

function Slides(props: SlidesProps) {
  return (
    <Carousel
      label="Featured slides"
      keys={['mountains', 'ocean', 'desert']}
      value={props.value}
      loop={props.loop}
      disabled={props.disabled}
      autoplay={props.autoplay}
      interval={60000}
      onchange={props.onchange}
      ontoggle={props.ontoggle}
    >
      <CarouselViewport label="Slides">
        <CarouselSlide name="mountains">Above the treeline</CarouselSlide>
        <CarouselSlide name="ocean">Swell arrives</CarouselSlide>
        <CarouselSlide name="desert">Nights go cold</CarouselSlide>
      </CarouselViewport>
      <CarouselNav label="Previous slide" direction={-1}>
        Prev
      </CarouselNav>
      <CarouselPicker name="mountains" label="Mountains slide" />
      <CarouselPicker name="ocean" label="Ocean slide" />
      <CarouselPicker name="desert" label="Desert slide" />
      <CarouselPlayer label="Start rotation" playingLabel="Stop rotation">
        Play
      </CarouselPlayer>
      <CarouselNav label="Next slide" direction={1}>
        Next
      </CarouselNav>
    </Carousel>
  );
}

const slideStates = () =>
  [...document.querySelectorAll('.aui-carousel-slide')].map((slide) => slide.hasAttribute('hidden'));

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Carousel', () => {
  it('shows exactly one slide in a named region', async () => {
    destroy = await runApp(async () => {
      render(<Slides value="mountains" />);
      const region = screen.getByRole('region', { name: 'Featured slides' });
      expect(region.getAttribute('aria-roledescription')).toBe('carousel');
      expect(screen.getByRole('group', { name: 'Slides' })).toBeInstanceOf(HTMLElement);
      expect(slideStates()).toEqual([false, true, true]);
      expect(screen.getByRole('button', { name: 'Mountains slide' }).getAttribute('aria-current')).toBe('true');
    });
  });

  it('steps forward and back with the nav buttons', async () => {
    destroy = await runApp(async () => {
      let committed: string | undefined;
      render(<Slides value="mountains" loop onchange={(event) => (committed = event.detail)} />);
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Next slide' }));
      });
      expect(committed).toBe('ocean');
      expect(slideStates()).toEqual([true, false, true]);
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
      });
      expect(committed).toBe('mountains');
    });
  });

  it('refuses to step past the first slide without loop', async () => {
    destroy = await runApp(async () => {
      render(<Slides value="mountains" />);
      expect((screen.getByRole('button', { name: 'Previous slide' }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: 'Next slide' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('wraps with loop enabled', async () => {
    destroy = await runApp(async () => {
      render(<Slides value="mountains" loop />);
      expect((screen.getByRole('button', { name: 'Previous slide' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('jumps straight to a slide from its dot', async () => {
    destroy = await runApp(async () => {
      render(<Slides value="mountains" />);
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Ocean slide' }));
      });
      expect(slideStates()).toEqual([true, false, true]);
      expect(screen.getByRole('button', { name: 'Ocean slide' }).getAttribute('aria-current')).toBe('true');
      expect(screen.getByRole('button', { name: 'Mountains slide' }).getAttribute('aria-current')).toBeNull();
    });
  });

  it('toggles rotation through the player and its label', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ auto: true });
      const toggles: boolean[] = [];
      render(
        <Carousel
          label="Featured slides"
          keys={['mountains', 'ocean']}
          value="mountains"
          autoplay={$bind(state, 'auto')}
          interval={60000}
          ontoggle={(event) => toggles.push(event.detail)}
        >
          <CarouselViewport label="Slides">
            <CarouselSlide name="mountains">Above the treeline</CarouselSlide>
            <CarouselSlide name="ocean">Swell arrives</CarouselSlide>
          </CarouselViewport>
          <CarouselPicker name="mountains" label="Mountains slide" />
          <CarouselPlayer label="Start rotation" playingLabel="Stop rotation">
            Play
          </CarouselPlayer>
        </Carousel>
      );
      const player = screen.getByRole('button', { name: 'Stop rotation' });
      await act(async () => {
        await userEvent.click(player);
      });
      expect(state.auto).toBe(false);
      expect(toggles).toContain(false);
      expect(screen.getByRole('button', { name: 'Start rotation' })).toBeInstanceOf(HTMLElement);
    });
  });

  it('changes slides with the arrow keys from the viewport', async () => {
    destroy = await runApp(async () => {
      render(<Slides value="mountains" />);
      const viewport = screen.getByRole('group', { name: 'Slides' });
      await act(async () => {
        fireEvent.keyDown(viewport, { key: 'ArrowRight' });
      });
      expect(slideStates()).toEqual([true, false, true]);
    });
  });

  it('locks every traveler while disabled', async () => {
    destroy = await runApp(async () => {
      render(<Slides value="ocean" disabled />);
      expect((screen.getByRole('button', { name: 'Next slide' }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: 'Previous slide' }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: 'Desert slide' }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: 'Start rotation' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Slides value="mountains" />);
      expect(screen.getByRole('region').className).toContain('aui-carousel');
      expect(screen.getByRole('group', { name: 'Slides' }).className).toContain('aui-carousel-viewport');
      expect(document.querySelector('.aui-carousel-slide')?.className).toContain('aui-carousel-slide');
      expect(screen.getByRole('button', { name: 'Next slide' }).className).toContain('aui-carousel-nav');
      expect(screen.getByRole('button', { name: 'Mountains slide' }).className).toContain('aui-carousel-picker');
      unmount();
      configure({ overrides: true });
      render(
        <Carousel label="Featured slides" className="only-me" keys={['a']} value="a">
          <CarouselSlide name="a" className="only-slide">
            One
          </CarouselSlide>
        </Carousel>
      );
      expect(screen.getByRole('region').className).toBe('only-me');
      expect(document.querySelector('.only-slide')?.className).toBe('only-slide');
    });
  });
});
