import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type ListboxProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildListbox(props: Partial<ListboxProps>, options: Array<{ value: string; text: string }>) {
  const listbox = aria<HTMLDivElement>('listbox', props as ListboxProps);
  const listboxEl = bind(document.createElement('div'), listbox);
  document.body.appendChild(listboxEl);

  const members = options.map(({ value, text }) => {
    const option = aria<HTMLDivElement>('option', { value });
    const el = bind(document.createElement('div'), option);
    el.textContent = text;
    listboxEl.appendChild(el);
    return { option, el };
  });

  const cleanup = () => {
    for (const { option } of members) {
      option.destroy();
    }

    listbox.destroy();
    listboxEl.remove();
  };

  return { listboxEl, members, cleanup };
}

function press(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('Listbox - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer input handler on roving and the change handler on a commit', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const oninput = vi.fn();
        const onchange = vi.fn();
        const props = mutable<ListboxProps>({ oninput, onchange });
        const { listboxEl, members, cleanup } = buildListbox(props, [
          { value: 'a', text: 'Amsterdam' },
          { value: 'b', text: 'Berlin' },
        ]);

        listboxEl.focus();
        press(listboxEl, 'ArrowDown');

        expect(oninput).toHaveBeenCalledTimes(1);
        expect((oninput.mock.calls[0][0] as CustomEvent).detail).toBe('a');
        expect(onchange).not.toHaveBeenCalled();

        press(listboxEl, 'ArrowDown');
        expect(oninput).toHaveBeenCalledTimes(2);
        expect((oninput.mock.calls[1][0] as CustomEvent).detail).toBe('b');

        press(members[1].el, ' ');

        expect(props.value).toBe('b');
        expect(onchange).toHaveBeenCalledTimes(1);
        expect(oninput).toHaveBeenCalledTimes(2);
        expect((onchange.mock.calls[0][0] as CustomEvent).detail).toBe('b');
        expect(onchange.mock.calls[0][1]).toBeUndefined();

        cleanup();
      });
    }));

  it('hands the whole set to a multiple consumer once per commit', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const changes = [] as string[][];
        const onchange = vi.fn().mockImplementation((e) => {
          changes.push([...(e as CustomEvent).detail]);
        });
        const props = mutable<ListboxProps>({ multiple: true, value: [], onchange });
        const { members, cleanup } = buildListbox(props, [
          { value: 'a', text: 'Amsterdam' },
          { value: 'b', text: 'Berlin' },
        ]);

        members[0].el.click();
        members[1].el.click();
        members[0].el.click();

        expect(onchange).toHaveBeenCalledTimes(3);
        expect(changes).toEqual([['a'], ['a', 'b'], ['b']]);
        expect(props.value).toEqual(['b']);

        cleanup();
      });
    }));

  it('types the roving query and the committed value for consumers without a cast', () => {
    const single: ListboxProps = {
      oninput: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<string>();
      },
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<string>();
      },
    };

    const multiple: ListboxProps = {
      multiple: true,
      value: ['a'],
      oninput: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<string>();
      },
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<string[]>();
      },
    };

    void single;
    void multiple;
  });
});
