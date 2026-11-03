import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type ImageProps, type ImageStatus } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Image - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
    vi.unstubAllGlobals();
  });

  it('calls the consumer change handler when the loader settles', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const settled: Array<{ srcValue: string; onload?: () => void }> = [];

        class FakeImage {
          srcValue = '';
          onload?: () => void;
          onerror?: () => void;

          constructor() {
            settled.push(this);
          }

          set src(value: string) {
            this.srcValue = value;
          }

          get src(): string {
            return this.srcValue;
          }
        }

        vi.stubGlobal('Image', FakeImage);

        const onchange = vi.fn();
        const image = aria('image', mutable<ImageProps>({ src: '/a.png', alt: 'A', onchange }));
        const content = aria<HTMLDivElement>('image-content');

        bind(document.createElement('div'), image);
        bind(document.createElement('div'), content);

        settled[0].onload?.();

        expect(onchange).toHaveBeenCalledTimes(1);
        expect((onchange.mock.calls[0][0] as CustomEvent<ImageStatus>).detail).toBe('loaded');

        content.destroy();
        image.destroy();
        vi.unstubAllGlobals();
      });
    }));

  it('types the loader status for consumers without a cast', () => {
    const props: ImageProps = {
      src: '/a.png',
      alt: 'A',
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<ImageStatus>();
      },
    };

    void props;
  });
});
