import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  type Aria,
  aria,
  type BaseElement,
  roverCtx,
  TabAria,
  TabButtonAria,
  type TabButtonProps,
  TabPanelAria,
  type TabPanelProps,
  type TabProps,
} from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Tabs - User Expectations & A11y Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    TabAria.configure({ orientation: 'horizontal' });
    scope.destroy();
  });

  describe('Semantic DOM Hierarchy & Pair Linking', () => {
    it('generates deterministic accessibility attributes and coordinates active states', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TabProps>({ id: 'account', value: 'profile' });
          const tabs = aria('tab', props);

          const list = tabs.list();
          const tabProfile = tabs.button({ name: 'profile' });
          const tabSecurity = tabs.button({ name: 'security' });

          const panelProfile = tabs.panel({ name: 'profile' });
          const panelSecurity = tabs.panel({ name: 'security' });

          // Structural root: carries ID namespace, no ARIA role
          expect(tabs.attributes.id).toBe('account');
          expect(tabs.attributes.role).toBeUndefined();

          // Tablist: manages role and orientation
          expect(list.attributes.role).toBe('tablist');
          expect(list.attributes['aria-orientation']).toBe('horizontal');

          // Active tab: button type, selected, points to panel, focusable in tab sequence
          expect(tabProfile.attributes.role).toBe('tab');
          expect(tabProfile.attributes.type).toBe('button');
          expect(tabProfile.attributes.id).toBe('account-tab-profile');
          expect(tabProfile.attributes['aria-controls']).toBe('account-tabpanel-profile');
          expect(tabProfile.attributes['aria-selected']).toBe('true');
          expect(tabProfile.attributes.tabindex).toBeUndefined();

          // Inactive tab: button type, not selected, points to panel, removed from sequential tab order
          expect(tabSecurity.attributes.role).toBe('tab');
          expect(tabSecurity.attributes.type).toBe('button');
          expect(tabSecurity.attributes.id).toBe('account-tab-security');
          expect(tabSecurity.attributes['aria-controls']).toBe('account-tabpanel-security');
          expect(tabSecurity.attributes['aria-selected']).toBe('false');
          expect(tabSecurity.attributes.tabindex).toBe(-1);

          // Active panel: visible, labelled by active tab, focusable
          expect(panelProfile.attributes.role).toBe('tabpanel');
          expect(panelProfile.attributes.id).toBe('account-tabpanel-profile');
          expect(panelProfile.attributes['aria-labelledby']).toBe('account-tab-profile');
          expect(panelProfile.attributes.tabindex).toBe(0);
          expect(panelProfile.attributes.hidden).toBe(false);

          // Inactive panel: hidden, labelled by inactive tab, omitted from tab order
          expect(panelSecurity.attributes.role).toBe('tabpanel');
          expect(panelSecurity.attributes.id).toBe('account-tabpanel-security');
          expect(panelSecurity.attributes['aria-labelledby']).toBe('account-tab-security');
          expect(panelSecurity.attributes.tabindex).toBe(-1);
          expect(panelSecurity.attributes.hidden).toBe(true);
        });
      }));

    it('derives automatic fallback namespace when id is omitted', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const tabs = aria('tab', { value: 'general' });
          const tab = tabs.button({ name: 'general' });
          const panel = tabs.panel({ name: 'general' });

          const namespace = tabs.attributes.id as string;
          expect(namespace).toMatch(/^tab-\d+$/);
          expect(tab.attributes.id).toBe(`${namespace}-tab-general`);
          expect(tab.attributes['aria-controls']).toBe(`${namespace}-tabpanel-general`);
          expect(panel.attributes.id).toBe(`${namespace}-tabpanel-general`);
          expect(panel.attributes['aria-labelledby']).toBe(`${namespace}-tab-general`);
        });
      }));

    it('emits explicit tabindex="0" on active custom non-button tab elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const tabs = aria('tab', { id: 'custom', value: 'item' });
          const customTab = tabs.button({ name: 'item' }, { native: false });
          const inactiveTab = tabs.button({ name: 'other' }, { native: false });

          expect(customTab.attributes.role).toBe('tab');
          expect(customTab.attributes.type).toBeUndefined();
          expect(customTab.attributes.tabindex).toBe(0);
          expect(customTab.attributes['aria-selected']).toBe('true');

          expect(inactiveTab.attributes.tabindex).toBe(-1);
          expect(inactiveTab.attributes['aria-selected']).toBe('false');
        });
      }));
  });

  describe('User Interaction & State Transitions', () => {
    it('switches selection and synchronizes DOM attributes when a tab is selected', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TabProps>({ id: 'app', value: 'home' });
          const tabs = aria('tab', props);

          const tabHome = tabs.button({ name: 'home' });
          const tabSettings = tabs.button({ name: 'settings' });
          const panelHome = tabs.panel({ name: 'home' });
          const panelSettings = tabs.panel({ name: 'settings' });

          // User selects "settings"
          tabSettings.select();

          expect(props.value).toBe('settings');

          // Home tab & panel become inactive
          expect(tabHome.attributes['aria-selected']).toBe('false');
          expect(tabHome.attributes.tabindex).toBe(-1);
          expect(panelHome.attributes.hidden).toBe(true);
          expect(panelHome.attributes.tabindex).toBe(-1);

          // Settings tab & panel become active
          expect(tabSettings.attributes['aria-selected']).toBe('true');
          expect(tabSettings.attributes.tabindex).toBeUndefined();
          expect(panelSettings.attributes.hidden).toBe(false);
          expect(panelSettings.attributes.tabindex).toBe(0);
        });
      }));

    it('supports lazy/conditional panel rendering through panel.selected state', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TabProps>({ id: 'lazy-tabs', value: 'first' });
          const tabs = aria('tab', props);

          const p1 = tabs.panel({ name: 'first' });
          const p2 = tabs.panel({ name: 'second' });

          expect(p1.selected).toBe(true);
          expect(p2.selected).toBe(false);

          props.value = 'second';

          expect(p1.selected).toBe(false);
          expect(p2.selected).toBe(true);
        });
      }));
  });

  describe('Keyboard Navigation (WAI-ARIA APG Roving Focus)', () => {
    it('navigates horizontal tabs with arrow keys without committing selection', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TabProps>({ id: 'nav', value: 'tab-1' });
          const tabs = aria('tab', props);

          const list = tabs.list();
          const t1 = tabs.button({ name: 'tab-1' });
          const t2 = tabs.button({ name: 'tab-2' });
          const t3 = tabs.button({ name: 'tab-3' });

          const listEl = bind(document.createElement('div'), list);
          const b1 = bind(document.createElement('button'), t1);
          const b2 = bind(document.createElement('button'), t2);
          const b3 = bind(document.createElement('button'), t3);

          listEl.appendChild(b1);
          listEl.appendChild(b2);
          listEl.appendChild(b3);
          document.body.appendChild(listEl);

          b1.focus();

          // ArrowRight moves focus without selecting
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(b2);
          expect(props.value).toBe('tab-1');
          expect(t2.attributes['aria-selected']).toBe('false');

          // End key jumps to last tab without selecting
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(b3);
          expect(props.value).toBe('tab-1');
          expect(t3.attributes['aria-selected']).toBe('false');

          // Home key jumps to first tab without selecting
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(b1);
          expect(props.value).toBe('tab-1');
          expect(t1.attributes['aria-selected']).toBe('true');

          document.body.removeChild(listEl);
        });
      }));

    it('moves focus without activating selection', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TabProps>({ id: 'manual', value: 'tab-1' });
          const tabs = aria('tab', props);

          const list = tabs.list();
          const t1 = tabs.button({ name: 'tab-1' });
          const t2 = tabs.button({ name: 'tab-2' });

          const listEl = bind(document.createElement('div'), list);
          const b1 = bind(document.createElement('button'), t1);
          const b2 = bind(document.createElement('button'), t2);

          listEl.appendChild(b1);
          listEl.appendChild(b2);
          document.body.appendChild(listEl);

          b1.focus();

          // ArrowRight moves focus, but does not select
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
          expect(props.value).toBe('tab-1');
          expect(t1.attributes['aria-selected']).toBe('true');
          expect(t2.attributes['aria-selected']).toBe('false');

          // User explicitly activates focused tab
          t2.select();
          expect(props.value).toBe('tab-2');
          expect(t2.attributes['aria-selected']).toBe('true');

          document.body.removeChild(listEl);
        });
      }));

    it('supports vertical orientation with ArrowDown and ArrowUp navigation', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TabProps>({ id: 'v-tabs', value: 't1', orientation: 'vertical' });
          const tabs = aria('tab', props);

          const list = tabs.list();
          const t1 = tabs.button({ name: 't1' });
          const t2 = tabs.button({ name: 't2' });

          expect(list.attributes['aria-orientation']).toBe('vertical');

          const listEl = bind(document.createElement('div'), list);
          const b1 = bind(document.createElement('button'), t1);
          const b2 = bind(document.createElement('button'), t2);

          listEl.appendChild(b1);
          listEl.appendChild(b2);
          document.body.appendChild(listEl);

          b1.focus();

          // ArrowDown navigates vertically without selecting
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(b2);
          expect(props.value).toBe('t1');
          expect(t2.attributes['aria-selected']).toBe('false');

          // ArrowUp navigates back without selecting
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(b1);
          expect(props.value).toBe('t1');
          expect(t1.attributes['aria-selected']).toBe('true');

          document.body.removeChild(listEl);
        });
      }));
  });

  describe('Configuration & Global Defaults', () => {
    it('applies global default orientation configured via TabAria.configure()', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          TabAria.configure({ orientation: 'vertical' });

          const tabs = aria('tab');
          const list = tabs.list();

          expect(list.attributes['aria-orientation']).toBe('vertical');

          // Reset to default
          TabAria.configure({ orientation: 'horizontal' });
          const horizontalTabs = aria('tab');
          expect(horizontalTabs.list().attributes['aria-orientation']).toBe('horizontal');
        });
      }));

    it('cascades disabled state to child tabs and blocks interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const tabs = aria('tab', { id: 'disabled-tabs', value: 't1', disabled: true });
          const list = tabs.list();
          const t1 = tabs.button({ name: 't1' });
          const t2 = tabs.button({ name: 't2' });

          expect(t1.attributes.disabled).toBe(true);
          expect(t2.attributes.disabled).toBe(true);
          expect(t1.attributes['aria-disabled']).toBe('true');
          expect(t2.attributes['aria-disabled']).toBe('true');

          const listEl = bind(document.createElement('div'), list);
          const b1 = bind(document.createElement('button'), t1);
          const b2 = bind(document.createElement('button'), t2);
          listEl.appendChild(b1);
          listEl.appendChild(b2);

          // Arrow navigation blocked
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
          expect(tabs.properties.value).toBe('t1');

          // Direct selection blocked
          t2.select();
          expect(tabs.properties.value).toBe('t1');
        });
      }));

    it('synchronously self-claims initial selection from the first tab when value is omitted', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const tabs = aria('tab', { id: 'uncontrolled' });
          const tab1 = tabs.button({ name: 'first' });
          const tab2 = tabs.button({ name: 'second' });

          // First tab automatically claims group selection
          expect(tabs.properties.value).toBe('first');
          expect(tab1.attributes['aria-selected']).toBe('true');
          expect(tab1.attributes.tabindex).toBeUndefined();

          // Second tab renders unselected
          expect(tab2.attributes['aria-selected']).toBe('false');
          expect(tab2.attributes.tabindex).toBe(-1);
        });
      }));

    it('allows an explicit selected prop on a child tab to claim group selection', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const tabs = aria('tab', { id: 'claim-tabs' });
          const tab1 = tabs.button({ name: 'first' });
          const tab2 = tabs.button({ name: 'second', selected: true });

          // Tab with selected: true claims selection over initial first tab
          expect(tabs.properties.value).toBe('second');
          expect(tab1.attributes['aria-selected']).toBe('false');
          expect(tab1.attributes.tabindex).toBe(-1);
          expect(tab2.attributes['aria-selected']).toBe('true');
          expect(tab2.attributes.tabindex).toBeUndefined();
        });
      }));

    it('handles standalone tab and tabpanel when group coordinator is omitted', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const standaloneTab = aria('tab-button', { name: 't1' });
          expect(standaloneTab.attributes.id).toBe('tab-t1');
          expect(standaloneTab.attributes['aria-controls']).toBe('tabpanel-t1');

          const noArgsTab = aria('tab-button', {} as TabButtonProps);
          expect(noArgsTab.attributes.role).toBe('tab');

          const disabledCustomTab = aria('tab-button', { disabled: true } as TabButtonProps, { native: false });
          expect(disabledCustomTab.attributes.tabindex).toBe(-1);

          const standalonePanel = aria('tab-panel', { name: 'p1' });
          expect(standalonePanel.attributes.id).toBe('tabpanel-p1');
          expect(standalonePanel.attributes['aria-labelledby']).toBe('tab-p1');
          expect(standalonePanel.selected).toBe(false);

          const idPanel = aria('tab-panel', { id: 'custom-p-id' } as TabPanelProps);
          expect(idPanel.key).toBe('custom-p-id');

          const autoPanel = aria('tab-panel', {} as TabPanelProps);
          expect(autoPanel.key).toBe(autoPanel.id);

          const defaultButton = new TabButtonAria();
          expect(defaultButton.attributes.role).toBe('tab');

          const defaultPanel = new TabPanelAria();
          expect(defaultPanel.attributes.role).toBe('tabpanel');

          const standaloneList = aria('tab-list');
          expect(standaloneList.attributes.role).toBe('tablist');
          expect(standaloneList.attributes['aria-orientation']).toBe('horizontal');

          const listEl = bind(document.createElement('div'), standaloneList);
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));

          // TabList with disabled tab
          const disabledTabs = aria('tab', { id: 'dt', value: 't1', disabled: true });
          const disabledList = disabledTabs.list();
          const disabledListEl = bind(document.createElement('div'), disabledList);
          disabledListEl.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
          );

          // Parent rover ignores keydown
          roverCtx.set(standaloneList as unknown as Aria<BaseElement>);
          const childList = aria('tab-list');
          const childListEl = bind(document.createElement('div'), childList);
          childListEl.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
          );
          roverCtx.set(undefined);
        });
      }));
  });

  describe('Active Tab Selection & Panel Association Invariant', () => {
    it('never empties the selection when the active tab is activated again', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TabProps>({ id: 'always-one', value: 'one' });
          const tabs = aria('tab', props);
          const tabOne = tabs.button({ name: 'one' });
          const panelOne = tabs.panel({ name: 'one' });

          const buttonEl = bind(document.createElement('button'), tabOne);
          const panelEl = bind(document.createElement('div'), panelOne);
          document.body.append(buttonEl, panelEl);

          expect(panelEl.hidden).toBe(false);

          buttonEl.click();
          expect(props.value).toBe('one');
          expect(tabOne.active).toBe(true);
          expect(panelEl.hidden).toBe(false);

          buttonEl.remove();
          panelEl.remove();
        });
      }));

    it('follows an explicit button id through the panel side of the pair', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const tabs = aria('tab', { id: 'acct', value: 'billing' });
          const button = tabs.button({ name: 'billing', id: 'pay-trigger' });
          const panel = tabs.panel({ name: 'billing' });

          expect(button.attributes.id).toBe('acct-tab-billing');
          expect(button.attributes['aria-controls']).toBe('acct-tabpanel-billing');

          // The panel keeps its own derived address but names the overridden trigger
          expect(panel.attributes.id).toBe('acct-tabpanel-billing');
          expect(panel.attributes['aria-labelledby']).toBe('acct-tab-billing');

          const panelEl = bind(document.createElement('div'), panel);
          expect(panelEl.getAttribute('aria-labelledby')).toBe('acct-tab-billing');

          tabs.destroy();
          button.destroy();
          panel.destroy();
        });
      }));
  });

  describe('Directional Traversal & Roving Focus Invariant', () => {
    it('wraps at both ends of the tablist without committing selection', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TabProps>({ id: 'wrap', value: 'a' });
          const tabs = aria('tab', props);
          const list = tabs.list();

          const a = tabs.button({ name: 'a' });
          const b = tabs.button({ name: 'b' });
          const c = tabs.button({ name: 'c' });

          const listEl = bind(document.createElement('div'), list);
          const elA = bind(document.createElement('button'), a);
          const elB = bind(document.createElement('button'), b);
          const elC = bind(document.createElement('button'), c);
          listEl.append(elA, elB, elC);
          document.body.appendChild(listEl);

          elC.focus();

          // Past the last tab, the rover wraps to the first without selecting
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(elA);
          expect(props.value).toBe('a');

          // Before the first tab it wraps to the last without selecting
          elA.focus();
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(elC);
          expect(props.value).toBe('a');

          listEl.remove();
        });
      }));

    it('passes a disabled tab over in traversal and at the ends of the range', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TabProps>({ id: 'skips', value: 'one' });
          const tabs = aria('tab', props);
          const list = tabs.list();

          const one = tabs.button({ name: 'one' });
          const two = tabs.button({ name: 'two', disabled: true });
          const three = tabs.button({ name: 'three' });

          const listEl = bind(document.createElement('div'), list);
          const elOne = bind(document.createElement('button'), one);
          const elTwo = bind(document.createElement('button'), two);
          const elThree = bind(document.createElement('button'), three);
          listEl.append(elOne, elTwo, elThree);
          document.body.appendChild(listEl);

          elOne.focus();

          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(elThree);
          expect(props.value).toBe('one');
          expect(two.active).toBe(false);

          // End lands on the last enabled tab, Home on the first enabled tab
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(elThree);

          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(elOne);
          expect(props.value).toBe('one');
          expect(one.active).toBe(true);

          // The disabled tab never holds the single tab stop
          expect(elTwo.getAttribute('tabindex')).toBe('-1');

          listEl.remove();
        });
      }));
  });

  describe('Manual vs Automatic Activation Invariant', () => {
    it('treats manual selection as the default and activates the focused tab on Enter', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<TabProps>({ id: 'default-manual', value: 'one' });
          const tabs = aria('tab', props);
          const list = tabs.list();
          const one = tabs.button({ name: 'one' });
          const two = tabs.button({ name: 'two' });
          const panelTwo = tabs.panel({ name: 'two' });

          const listEl = bind(document.createElement('div'), list);
          const elOne = bind(document.createElement('button'), one);
          const elTwo = bind(document.createElement('button'), two);
          const panelEl = bind(document.createElement('div'), panelTwo);
          listEl.append(elOne, elTwo);
          document.body.append(listEl, panelEl);

          elOne.focus();

          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));

          // No manual flag was passed, so focus moved and the selection waited
          expect(document.activeElement).toBe(elTwo);
          expect(props.value).toBe('one');
          expect(two.active).toBe(false);
          expect(panelEl.hidden).toBe(true);

          elTwo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
          elTwo.click();
          expect(props.value).toBe('two');
          expect(panelEl.hidden).toBe(false);

          // Enter on the other focused tab selects it, leaving its sibling inactive
          listEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
          expect(props.value).toBe('two');
          expect(document.activeElement).toBe(elOne);

          elOne.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
          elOne.click();
          expect(props.value).toBe('one');

          listEl.remove();
          panelEl.remove();
        });
      }));
  });
});
