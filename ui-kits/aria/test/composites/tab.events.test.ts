import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type TabProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildTabs(props: Partial<TabProps>, names: string[]) {
  const tabs = aria('tab', props as TabProps);
  const tabsEl = bind(document.createElement('div'), tabs);
  document.body.appendChild(tabsEl);

  const list = aria('tab-list', { label: 'Sections' });
  const listEl = bind(document.createElement('div'), list);
  tabsEl.appendChild(listEl);

  const buttons = names.map((name) => {
    const button = aria('tab-button', { name });
    const el = bind(document.createElement('button'), button);
    el.textContent = name;
    listEl.appendChild(el);
    return { name, button, el };
  });

  const panels = names.map((name) => {
    const panel = aria('tab-panel', { name });
    const el = bind(document.createElement('section'), panel);
    tabsEl.appendChild(el);
    return { name, panel, el };
  });

  const cleanup = () => {
    tabs.destroy();
    list.destroy();
    for (const b of buttons) b.button.destroy();
    for (const p of panels) p.panel.destroy();
    tabsEl.remove();
  };

  return { tabs, tabsEl, list, listEl, buttons, panels, cleanup };
}

describe('Tab - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer onchange with the committed value per activation', () =>
    scope.run(() => {
      component().run(() => {
        const onchange = vi.fn();
        const props = mutable<TabProps>({ value: 'a', onchange });
        const { buttons, cleanup } = buildTabs(props, ['a', 'b']);

        expect(onchange).not.toHaveBeenCalled();

        buttons[1].el.click();

        expect(props.value).toBe('b');
        expect(onchange).toHaveBeenCalledTimes(1);
        expect((onchange.mock.calls[0][0] as CustomEvent).detail).toBe('b');
        expect((onchange.mock.calls[0][0] as Event).bubbles).toBe(true);

        buttons[1].el.click();

        expect(onchange).toHaveBeenCalledTimes(1);

        cleanup();
      });
    }));

  it('types the committed value for consumers without a cast', () => {
    const props: TabProps = {
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<string>();
      },
    };

    void props;
  });
});
