import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type TabProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildTabs(props: Partial<TabProps>, names: string[], options: { panelScrollable?: boolean } = {}) {
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
    el.dataset.panel = name;
    if (options.panelScrollable) {
      el.tabIndex = 0;
      el.style.overflow = 'auto';
    }

    tabsEl.appendChild(el);
    return { name, panel, el };
  });

  const cleanup = () => {
    tabs.destroy();
    list.destroy();
    for (const button of buttons) {
      button.button.destroy();
    }

    for (const panel of panels) {
      panel.panel.destroy();
    }

    tabsEl.remove();
  };

  return { tabs, tabsEl, list, listEl, buttons, panels, cleanup };
}

function press(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

const selectedTab = () =>
  Array.from(document.querySelectorAll('[role="tab"][aria-selected="true"]')).map((el) => el.textContent ?? '');

describe('Tab - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Singular Tab-Panel Direct Pairing Invariant', () => {
    it('pairs each trigger to its own panel and back through resolvable addresses', () =>
      scope.run(() => {
        component().run(() => {
          const { tabsEl, list, listEl, buttons, panels, cleanup } = buildTabs({ id: 'acct', value: 'profile' }, [
            'profile',
            'security',
          ]);

          expect(tabsEl.hasAttribute('role')).toBe(false);
          expect(listEl.getAttribute('role')).toBe('tablist');
          expect(listEl.getAttribute('aria-orientation')).toBe('horizontal');
          expect(list.attributes['aria-label']).toBe('Sections');

          const profileButton = buttons[0];
          const profilePanel = panels[0];
          const securityPanel = panels[1];

          expect(profileButton.button.attributes['aria-controls']).toBe(profilePanel.el.id);
          expect(profilePanel.el.getAttribute('aria-labelledby')).toBe(profileButton.el.id);
          expect(document.getElementById(profileButton.el.getAttribute('aria-controls') as string)).toBe(
            profilePanel.el
          );
          expect(profilePanel.el.hasAttribute('hidden')).toBe(false);

          // The inactive pair is addressed the same way but hidden
          expect(buttons[1].button.attributes['aria-controls']).toBe(securityPanel.el.id);
          expect(securityPanel.el.hidden).toBe(true);

          // Exactly one tab is selected, and its panel is the only visible one
          expect(selectedTab()).toEqual(['profile']);
          expect(panels.filter((panel) => !panel.el.hidden).map((panel) => panel.name)).toEqual(['profile']);

          cleanup();
        });
      }));

    it('honours explicit ids on both sides of the pair', () =>
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

          expect(buttonEl.id).toBe('trigger-one');
          expect(panelEl.id).toBe('panel-one');
          expect(buttonEl.getAttribute('aria-controls')).toBe('panel-one');
          expect(panelEl.getAttribute('aria-labelledby')).toBe('trigger-one');

          tabs.destroy();
          button.destroy();
          panel.destroy();
          tabsEl.remove();
        });
      }));
  });

  describe('Activation Mode & Event Contract Invariant', () => {
    it('emits one change per commit on the container and yields to a cancelled click', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<TabProps>({ value: 'a' });
          const { tabsEl, buttons, cleanup } = buildTabs(props, ['a', 'b']);

          const commits: unknown[] = [];
          tabsEl.addEventListener('change', (event) =>
            commits.push({ detail: (event as CustomEvent).detail, bubbles: event.bubbles })
          );

          buttons[1].el.click();
          expect(props.value).toBe('b');
          expect(commits).toEqual([{ detail: 'b', bubbles: true }]);

          // A consumer that cancels the activation stops both the commit and the event
          const veto = (event: Event) => event.preventDefault();
          buttons[0].el.addEventListener('click', veto);

          buttons[0].el.click();
          expect(props.value).toBe('b');
          expect(commits).toHaveLength(1);

          buttons[0].el.removeEventListener('click', veto);
          buttons[0].el.click();
          expect(props.value).toBe('a');
          expect(commits).toHaveLength(2);

          // Selecting the active tab again commits nothing and says nothing
          buttons[0].el.click();
          expect(commits).toHaveLength(2);

          cleanup();
        });
      }));

    it('commits on arrow movement under automatic activation', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<TabProps>({ value: 'a', activation: 'automatic' });
          const { listEl, buttons, panels, cleanup } = buildTabs(props, ['a', 'b', 'c']);

          buttons[0].el.focus();

          press(buttons[0].el, 'ArrowRight');
          expect(document.activeElement).toBe(buttons[1].el);
          expect(props.value).toBe('b');
          expect(panels[1].el.hidden).toBe(false);
          expect(panels[0].el.hidden).toBe(true);

          press(buttons[1].el, 'ArrowRight');
          press(buttons[2].el, 'ArrowRight');
          expect(document.activeElement).toBe(buttons[0].el);
          expect(props.value).toBe('a');

          cleanup();
        });
      }));

    it('holds selection behind Enter or Space under manual activation', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<TabProps>({ value: 'a', activation: 'manual' });
          const { buttons, panels, cleanup } = buildTabs(props, ['a', 'b', 'c']);

          buttons[0].el.focus();

          press(buttons[0].el, 'ArrowRight');
          expect(document.activeElement).toBe(buttons[1].el);
          expect(props.value).toBe('a');
          expect(panels[1].el.hidden).toBe(true);
          expect(buttons[1].el.getAttribute('aria-selected')).toBe('false');

          press(buttons[1].el, 'Enter');
          expect(props.value).toBe('b');
          expect(panels[1].el.hidden).toBe(false);
          expect(buttons[1].el.getAttribute('aria-selected')).toBe('true');

          cleanup();
        });
      }));

    it('treats the manual flag as the alias of manual activation', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<TabProps>({ value: 'a', manual: true });
          const { buttons, panels, cleanup } = buildTabs(props, ['a', 'b']);

          buttons[0].el.focus();
          press(buttons[0].el, 'ArrowRight');

          expect(props.value).toBe('a');
          expect(panels[1].el.hidden).toBe(true);

          buttons[1].el.click();
          expect(props.value).toBe('b');

          cleanup();
        });
      }));
  });

  describe('Focus & Selection Reflection Invariant', () => {
    it('keeps one roving tab stop that travels with selection and focus', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<TabProps>({ value: 'a' });
          const { buttons, cleanup } = buildTabs(props, ['a', 'b', 'c']);

          expect(buttons[0].el.hasAttribute('tabindex')).toBe(false);
          expect(buttons[1].el.getAttribute('tabindex')).toBe('-1');
          expect(buttons[2].el.getAttribute('tabindex')).toBe('-1');

          buttons[1].el.focus();
          press(buttons[1].el, 'End');
          expect(document.activeElement).toBe(buttons[2].el);
          expect(props.value).toBe('c');
          expect(buttons[2].el.hasAttribute('tabindex')).toBe(false);
          expect(buttons[0].el.getAttribute('tabindex')).toBe('-1');

          press(buttons[2].el, 'Home');
          expect(document.activeElement).toBe(buttons[0].el);
          expect(props.value).toBe('a');

          cleanup();
        });
      }));

    it('skips a disabled tab in traversal and refuses its activation', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<TabProps>({ value: 'a' });
          const { buttons, cleanup } = buildTabs(props, ['a', 'b', 'c']);

          buttons[1].button.assign({ disabled: true });
          expect(buttons[1].el.disabled).toBe(true);

          buttons[0].el.focus();
          press(buttons[0].el, 'ArrowRight');
          expect(document.activeElement).toBe(buttons[2].el);

          buttons[1].el.click();
          expect(props.value).toBe('a');

          press(buttons[2].el, 'Home');
          expect(document.activeElement).toBe(buttons[0].el);

          props.disabled = true;
          press(buttons[0].el, 'ArrowRight');
          expect(document.activeElement).toBe(buttons[0].el);
          expect(props.value).toBe('a');
          expect(buttons[2].el.getAttribute('aria-disabled')).toBe('true');

          props.disabled = false;
          buttons[2].el.click();
          expect(props.value).toBe('c');

          cleanup();
        });
      }));

    it('travels vertically when the tablist is stacked', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<TabProps>({ value: 'a', orientation: 'vertical' });
          const { list, listEl, buttons, cleanup } = buildTabs(props, ['a', 'b']);

          expect(list.attributes['aria-orientation']).toBe('vertical');
          expect(listEl.getAttribute('aria-orientation')).toBe('vertical');

          buttons[0].el.focus();

          expect(press(buttons[0].el, 'ArrowDown').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(buttons[1].el);
          expect(props.value).toBe('b');

          press(buttons[1].el, 'ArrowUp');
          expect(document.activeElement).toBe(buttons[0].el);
          expect(props.value).toBe('a');

          cleanup();
        });
      }));
  });
});
