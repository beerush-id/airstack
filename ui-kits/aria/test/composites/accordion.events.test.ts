import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { accordionCtx, aria, type AccordionProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Accordion - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the root onchange with the committed value per activation', () =>
    scope.run(() => {
      component().run(() => {
        const onchange = vi.fn();
        const props = mutable<AccordionProps>({ id: 'events', value: 'a', onchange });
        const group = aria('accordion', props);
        const container = bind(document.createElement('div'), group);

        const a = component().run(() => accordionCtx.get()!.button({ name: 'a' }));
        const b = component().run(() => accordionCtx.get()!.button({ name: 'b' }));
        const elA = bind(document.createElement('button'), a);
        const elB = bind(document.createElement('button'), b);
        container.append(elA, elB);
        document.body.appendChild(container);

        expect(onchange).not.toHaveBeenCalled();

        elB.click();
        expect(props.value).toBe('b');
        expect(onchange).toHaveBeenCalledTimes(1);
        expect((onchange.mock.calls[0][0] as CustomEvent).detail).toBe('b');

        elB.click();
        expect(props.value).toBeUndefined();
        expect(onchange).toHaveBeenCalledTimes(2);
        expect((onchange.mock.calls[1][0] as CustomEvent).detail).toBeNull();

        document.body.removeChild(container);
      });
    }));

  it('hands the whole array to a multiple consumer once per commit', () =>
    scope.run(() => {
      component().run(() => {
        const snapshots = [] as string[][];
        const onchange = vi.fn().mockImplementation((event) => {
          snapshots.push([...((event as CustomEvent).detail as string[])]);
        });
        const props = mutable<AccordionProps>({ id: 'events-multi', multiple: true, value: [], onchange });
        const group = aria('accordion', props);
        const container = bind(document.createElement('div'), group);

        const one = component().run(() => accordionCtx.get()!.button({ name: 'one' }));
        const two = component().run(() => accordionCtx.get()!.button({ name: 'two' }));
        const elOne = bind(document.createElement('button'), one);
        const elTwo = bind(document.createElement('button'), two);
        container.append(elOne, elTwo);
        document.body.appendChild(container);

        elOne.click();
        elTwo.click();

        expect(onchange).toHaveBeenCalledTimes(2);
        expect(snapshots).toEqual([['one'], ['one', 'two']]);
        expect(props.value).toEqual(['one', 'two']);

        document.body.removeChild(container);
      });
    }));

  it('calls a standalone member onchange with the toggled state', () =>
    scope.run(() => {
      component().run(() => {
        const onchange = vi.fn();
        const trigger = aria('accordion-button', { name: 'note', onchange });
        const triggerEl = bind(document.createElement('button'), trigger);
        document.body.appendChild(triggerEl);

        triggerEl.click();
        expect(trigger.expanded).toBe(true);
        expect(onchange).toHaveBeenCalledTimes(1);
        expect((onchange.mock.calls[0][0] as CustomEvent).detail).toBe(true);

        triggerEl.click();
        expect(trigger.expanded).toBe(false);
        expect(onchange).toHaveBeenCalledTimes(2);
        expect((onchange.mock.calls[1][0] as CustomEvent).detail).toBe(false);

        document.body.removeChild(triggerEl);
      });
    }));

  it('types the committed value for consumers without a cast', () => {
    const single: AccordionProps = {
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<string | null>();
      },
    };

    const multiple: AccordionProps = {
      multiple: true,
      value: [],
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<string[]>();
      },
    };

    void single;
    void multiple;
  });
});
