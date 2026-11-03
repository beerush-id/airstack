import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type DisclosureProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Disclosure - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer toggle handler with the expanded state', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const ontoggle = vi.fn();
        const props = mutable<DisclosureProps>({ expanded: false, ontoggle });
        const disclosure = aria('disclosure', props);
        const container = document.createElement('div');

        Object.assign(container, disclosure.props);
        disclosure.ref(container);

        const trigger = aria('disclosure-trigger');
        const triggerEl = bind(document.createElement('button'), trigger);

        triggerEl.click();

        expect(ontoggle).toHaveBeenCalledTimes(1);
        expect((ontoggle.mock.calls[0][0] as CustomEvent<boolean>).detail).toBe(true);
        expect(container.ontoggle).toBeNull();

        trigger.destroy();
        disclosure.destroy();
      });
    }));

  it('types the expanded state for consumers without a cast', () => {
    const props: DisclosureProps = {
      ontoggle: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<boolean>();
      },
    };

    void props;
  });
});
