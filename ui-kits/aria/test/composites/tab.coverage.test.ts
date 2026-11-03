import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
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

function key(el: HTMLElement, keyName: string) {
  const event = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  if (keyName === 'Enter' || keyName === ' ') el.click();
  return event;
}

describe('Tab - Edge Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('activates on Space like Enter without emptying selection', () =>
    scope.run(() => {
      component().run(() => {
        const props = mutable<TabProps>({ value: 'a' });
        const { buttons, panels, cleanup } = buildTabs(props, ['a', 'b']);

        buttons[0].el.focus();
        key(buttons[0].el, 'ArrowRight');
        expect(document.activeElement).toBe(buttons[1].el);
        expect(props.value).toBe('a');

        key(buttons[1].el, ' ');
        expect(props.value).toBe('b');
        expect(panels[1].el.hidden).toBe(false);
        expect(buttons[1].el.getAttribute('aria-selected')).toBe('true');

        key(buttons[1].el, ' ');
        expect(props.value).toBe('b');

        cleanup();
      });
    }));

  it('projects labelledby onto the tablist and keeps horizontal default', () =>
    scope.run(() => {
      component().run(() => {
        const tabs = aria('tab', { id: 'lb', value: 'a' });
        const list = tabs.list({ labelledby: 'heading-id' });
        const listEl = bind(document.createElement('div'), list);
        document.body.appendChild(listEl);

        expect(listEl.getAttribute('aria-labelledby')).toBe('heading-id');
        expect(listEl.getAttribute('aria-orientation')).toBe('horizontal');

        tabs.destroy();
        list.destroy();
        listEl.remove();
      });
    }));

  it('wraps roving at both ends and lands Home/End on enabled tabs', () =>
    scope.run(() => {
      component().run(() => {
        const props = mutable<TabProps>({ value: 'a' });
        const { buttons, cleanup } = buildTabs(props, ['a', 'b', 'c']);

        buttons[2].el.focus();
        key(buttons[2].el, 'ArrowRight');
        expect(document.activeElement).toBe(buttons[0].el);
        expect(props.value).toBe('a');

        buttons[0].el.focus();
        key(buttons[0].el, 'ArrowLeft');
        expect(document.activeElement).toBe(buttons[2].el);
        expect(props.value).toBe('a');

        key(buttons[2].el, 'Home');
        expect(document.activeElement).toBe(buttons[0].el);

        key(buttons[0].el, 'End');
        expect(document.activeElement).toBe(buttons[2].el);
        expect(props.value).toBe('a');

        cleanup();
      });
    }));

  it('skips disabled members in traversal and refuses their activation', () =>
    scope.run(() => {
      component().run(() => {
        const props = mutable<TabProps>({ value: 'a' });
        const { buttons, cleanup } = buildTabs(props, ['a', 'b', 'c']);

        buttons[1].button.assign({ disabled: true });

        buttons[0].el.focus();
        key(buttons[0].el, 'ArrowRight');
        expect(document.activeElement).toBe(buttons[2].el);

        buttons[1].el.click();
        expect(props.value).toBe('a');

        props.disabled = true;
        key(buttons[2].el, 'ArrowRight');
        expect(props.value).toBe('a');

        props.disabled = false;
        buttons[2].el.click();
        expect(props.value).toBe('c');

        cleanup();
      });
    }));

  it('honours explicit pair ids and standalone parts without a group', () =>
    scope.run(() => {
      component().run(() => {
        const tabs = aria('tab', { id: 'explicit', value: 'one' });
        const tabsEl = bind(document.createElement('div'), tabs);
        document.body.appendChild(tabsEl);

        const button = aria('tab-button', { name: 'one', id: 'trigger-one' });
        const buttonEl = bind(document.createElement('button'), button);
        tabsEl.appendChild(buttonEl);

        const panel = aria('tab-panel', { name: 'one', id: 'panel-one' });
        const panelEl = bind(document.createElement('div'), panel);
        tabsEl.appendChild(panelEl);

        expect(buttonEl.getAttribute('aria-controls')).toBe(panelEl.id);
        expect(panelEl.getAttribute('aria-labelledby')).toBe(buttonEl.id);
        expect(panelEl.hidden).toBe(false);

        tabs.destroy();
        button.destroy();
        panel.destroy();
        tabsEl.remove();

        const soloButton = aria('tab-button', { name: 'solo' });
        expect(soloButton.attributes.role).toBe('tab');

        const soloPanel = aria('tab-panel', { name: 'solo' });
        expect(soloPanel.attributes.role).toBe('tabpanel');
        expect(soloPanel.selected).toBe(false);

        soloButton.destroy();
        soloPanel.destroy();
      });
    }));

  it('exposes the namespace id and panel active projection', () =>
    scope.run(() => {
      component().run(() => {
        const props = mutable<TabProps>({ id: 'ns', value: 'a' });
        const { tabs, panels, cleanup } = buildTabs(props, ['a', 'b']);

        expect(tabs.id).toBe('ns');
        expect(panels[0].panel.active).toBe(true);
        expect(panels[1].panel.active).toBe(false);

        props.value = 'b';

        expect(panels[0].panel.active).toBe(false);
        expect(panels[1].panel.active).toBe(true);

        cleanup();
      });
    }));

  it('keeps scrollable active panels focusable while hiding inactive ones', () =>
    scope.run(() => {
      component().run(() => {
        const props = mutable<TabProps>({ id: 'scroll', value: 'a' });
        const { panels, cleanup } = buildTabs(props, ['a', 'b']);

        panels[0].el.tabIndex = 0;
        panels[0].el.style.overflow = 'auto';

        expect(panels[0].el.hidden).toBe(false);
        expect(panels[1].el.hidden).toBe(true);

        props.value = 'b';

        expect(panels[0].el.hidden).toBe(true);
        expect(panels[1].el.hidden).toBe(false);

        cleanup();
      });
    }));
});
