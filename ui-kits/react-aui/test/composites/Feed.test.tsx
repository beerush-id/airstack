import type { StateUnsubscribe } from '@airlib/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Feed, FeedArticle } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function Releases(props: { busy?: boolean; setsize?: number }) {
  return (
    <Feed label="Release notes" busy={props.busy} setsize={props.setsize}>
      <FeedArticle posinset={1}>Streaming markup lands in engine 2.4</FeedArticle>
      <FeedArticle posinset={2}>Route transitions drop under a millisecond</FeedArticle>
      <FeedArticle posinset={3}>Workers probe their own health</FeedArticle>
    </Feed>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Feed', () => {
  it('renders a named stream of positioned articles', async () => {
    destroy = await runApp(async () => {
      render(<Releases />);
      const feed = screen.getByRole('feed', { name: 'Release notes' });
      expect(feed).toBeInstanceOf(HTMLElement);
      const articles = screen.getAllByRole('article');
      expect(articles).toHaveLength(3);
      expect(articles[0].getAttribute('aria-posinset')).toBe('1');
      expect(articles[0].getAttribute('aria-setsize')).toBe('-1');
      expect(articles[2].getAttribute('aria-posinset')).toBe('3');
    });
  });

  it('publishes the run size and the busy state from the container', async () => {
    destroy = await runApp(async () => {
      render(<Releases busy setsize={4} />);
      expect(screen.getByRole('feed').getAttribute('aria-busy')).toBe('true');
      expect(screen.getAllByRole('article')[0].getAttribute('aria-setsize')).toBe('4');
      expect(screen.getAllByRole('article')[0].getAttribute('aria-busy')).toBe(null);
    });
  });

  it('moves focus between entries with PageDown and PageUp', async () => {
    destroy = await runApp(async () => {
      render(<Releases />);
      const articles = screen.getAllByRole('article');
      articles[0].focus();
      expect(fireEvent.keyDown(articles[0], { key: 'PageDown' })).toBe(false);
      expect(document.activeElement).toBe(articles[1]);
      expect(fireEvent.keyDown(articles[1], { key: 'PageUp' })).toBe(false);
      expect(document.activeElement).toBe(articles[0]);
    });
  });

  it('jumps to the ends with Ctrl and leaves plain Home alone', async () => {
    destroy = await runApp(async () => {
      render(<Releases />);
      const articles = screen.getAllByRole('article');
      articles[0].focus();
      expect(fireEvent.keyDown(articles[0], { key: 'End', ctrlKey: true })).toBe(false);
      expect(document.activeElement).toBe(articles[2]);
      expect(fireEvent.keyDown(articles[2], { key: 'End' })).toBe(true);
      expect(document.activeElement).toBe(articles[2]);
    });
  });

  it('leaves the browser alone at the ends of the run', async () => {
    destroy = await runApp(async () => {
      render(<Releases />);
      const articles = screen.getAllByRole('article');
      articles[0].focus();
      expect(fireEvent.keyDown(articles[0], { key: 'PageUp' })).toBe(true);
      expect(document.activeElement).toBe(articles[0]);
      articles[2].focus();
      expect(fireEvent.keyDown(articles[2], { key: 'PageDown' })).toBe(true);
      expect(document.activeElement).toBe(articles[2]);
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Releases />);
      expect(screen.getByRole('feed').className).toContain('aui-feed');
      expect(screen.getAllByRole('article')[0].className).toContain('aui-feed-article');
      unmount();
      configure({ overrides: true });
      render(
        <Feed label="Release notes" className="only-me">
          <FeedArticle className="only-article" posinset={1}>
            One
          </FeedArticle>
        </Feed>
      );
      expect(screen.getByRole('feed').className).toBe('only-me');
      expect(screen.getByRole('article').className).toBe('only-article');
    });
  });
});
