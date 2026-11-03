import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Image, ImageContent, ImageFallback } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Image', () => {
  it('renders the compound parts itself when no children are given', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Image src="/logo.png" alt="Logo" />);
      const fallback = screen.getByRole('img', { name: 'Logo' });
      expect(fallback.tagName).toBe('DIV');
      expect(fallback.textContent).toBe('LO');
      const content = document.querySelector('img.aui-image-content') as HTMLImageElement;
      expect(content.getAttribute('src')).toBe('/logo.png');
      expect(content.getAttribute('alt')).toBe('Logo');
      unmount();
      render(<Image src="/ana.png" alt="Ana Duarte" />);
      expect(screen.getByRole('img', { name: 'Ana Duarte' }).textContent).toBe('AD');
    });
  });

  it('keeps the fallback on screen and the content hidden while loading', async () => {
    destroy = await runApp(async () => {
      render(
        <Image src="/logo.png" alt="Logo">
          <ImageFallback>LB</ImageFallback>
          <ImageContent />
        </Image>
      );
      const container = screen.getByText('LB').closest('.aui-image');
      expect(container).toBeTruthy();
      const fallback = screen.getByRole('img', { name: 'Logo' });
      expect(fallback.tagName).toBe('DIV');
      expect(fallback.textContent).toBe('LB');
      const content = document.querySelector('img.aui-image-content') as HTMLImageElement;
      expect(content).toBeTruthy();
      expect(content.getAttribute('src')).toBe('/logo.png');
      expect(content.getAttribute('alt')).toBe('Logo');
      expect(content.getAttribute('aria-hidden')).toBe('true');
      expect(content.getAttribute('role')).toBeNull();
    });
  });

  it('leaves a decorative source out of the accessibility tree', async () => {
    destroy = await runApp(async () => {
      render(
        <Image src="/divider.png" alt="">
          <ImageFallback>...</ImageFallback>
          <ImageContent />
        </Image>
      );
      expect(screen.queryByRole('img')).toBeNull();
      const fallback = document.querySelector('.aui-image-fallback') as HTMLElement;
      expect(fallback.getAttribute('aria-hidden')).toBe('true');
      expect(fallback.getAttribute('role')).toBeNull();
      const content = document.querySelector('.aui-image-content') as HTMLImageElement;
      expect(content.getAttribute('aria-hidden')).toBe('true');
      expect(content.getAttribute('alt')).toBe('');
    });
  });

  it('forwards events, children, and consumer ref on the coordinator', async () => {
    destroy = await runApp(async () => {
      let clicks = 0;
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Image src="/logo.png" alt="Logo" ref={ref} onClick={() => (clicks += 1)}>
          <ImageFallback>LB</ImageFallback>
          <ImageContent />
        </Image>
      );
      const container = document.querySelector('.aui-image') as HTMLDivElement;
      expect(ref.current).toBe(container);
      await act(async () => {
        await userEvent.click(container);
      });
      expect(clicks).toBe(1);
    });
  });

  it('keeps the container neutral in classes', async () => {
    destroy = await runApp(async () => {
      render(
        <Image src="/logo.png" alt="Logo">
          <ImageFallback>LB</ImageFallback>
          <ImageContent />
        </Image>
      );
      expect(document.querySelector('.aui-image')?.className).toBe('aui-image');
    });
  });

  it('uses configured fallbacks and explicit props win', async () => {
    destroy = await runApp(async () => {
      configure({ image: { color: 'error' } });
      const { unmount } = render(
        <Image src="/logo.png" alt="Logo">
          <ImageFallback>LB</ImageFallback>
          <ImageContent />
        </Image>
      );
      expect(document.querySelector('.aui-image')?.className).toBe('aui-image aui-image-error');
      unmount();
      render(
        <Image src="/logo.png" alt="Logo" color="info">
          <ImageFallback>LB</ImageFallback>
          <ImageContent />
        </Image>
      );
      expect(document.querySelector('.aui-image')?.className).toBe('aui-image aui-image-info');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <Image src="/logo.png" alt="Logo" className="my-frame">
          <ImageFallback>LB</ImageFallback>
          <ImageContent />
        </Image>
      );
      const container = document.querySelector('.aui-image') as HTMLDivElement;
      expect(container.className).toContain('my-frame');
      expect(container.className).toContain('aui-image');
      unmount();
      configure({ overrides: true });
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Image src="/logo.png" alt="Logo" className="only-me" ref={ref}>
          <ImageFallback>LB</ImageFallback>
          <ImageContent />
        </Image>
      );
      expect(ref.current?.className).toBe('only-me');
    });
  });
});
