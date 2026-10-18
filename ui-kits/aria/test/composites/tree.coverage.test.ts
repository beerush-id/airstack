import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, TreeAria, TreeGroupAria, TreeItemAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

function press(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('Tree - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('covers programmatic state projections, default multiple array initialization, and disabled tree guard', () =>
    scope.run(() => {
      component().run(() => {
        const tree = aria('tree', { multiple: true, required: true, label: 'Project files', labelledby: 'tree-hdr' });
        const rootUl = bind(document.createElement('ul'), tree);
        document.body.appendChild(rootUl);

        expect(tree.value).toEqual([]);
        expect(rootUl.getAttribute('aria-required')).toBe('true');
        expect(rootUl.getAttribute('aria-label')).toBe('Project files');
        expect(rootUl.getAttribute('aria-labelledby')).toBe('tree-hdr');

        tree.value = ['alpha'];
        expect(tree.value).toEqual(['alpha']);

        let branch!: TreeItemAria;
        let branchEl!: HTMLElement;
        let group!: TreeGroupAria;
        let groupEl!: HTMLElement;
        let child!: TreeItemAria;
        let childEl!: HTMLElement;

        component().run(() => {
          branch = aria('tree-item', { value: 'alpha', label: 'Alpha folder' });
          branchEl = bind(document.createElement('li'), branch);
          rootUl.appendChild(branchEl);

          group = aria('tree-group', { id: 'custom-group' });
          groupEl = bind(document.createElement('ul'), group);
          branchEl.appendChild(groupEl);

          component().run(() => {
            child = aria('tree-item', { value: 42 as unknown as string });
            childEl = bind(document.createElement('li'), child);
            groupEl.appendChild(childEl);
          });
        });

        expect(branch.isBranch).toBe(true);
        expect(branch.expanded).toBe(false);
        expect(branch.selected).toBe(true);
        expect(branchEl.getAttribute('aria-label')).toBe('Alpha folder');
        expect(groupEl.id).toBe('custom-group');
        expect(groupEl.hidden).toBe(true);

        branch.expanded = true;
        expect(branch.expanded).toBe(true);
        expect(groupEl.hidden).toBe(false);

        branch.expand();
        expect(branch.expanded).toBe(true);

        branch.expanded = false;
        expect(branch.expanded).toBe(false);

        branch.collapse();
        expect(branch.expanded).toBe(false);

        branch.toggleExpand();
        expect(branch.expanded).toBe(true);
        branch.toggleExpand();
        expect(branch.expanded).toBe(false);

        tree.assign({ required: false });
        branch.selected = false;
        expect(branch.selected).toBe(false);
        branch.selected = true;
        expect(branch.selected).toBe(true);

        tree.assign({ disabled: true });
        expect(tree.disabled).toBe(true);
        expect(branch.disabled).toBe(true);

        branch.expanded = true;
        expect(branch.expanded).toBe(false);
        branch.toggleExpand();
        expect(branch.expanded).toBe(false);
        branch.expand();
        expect(branch.expanded).toBe(false);
        branch.collapse();
        expect(branch.expanded).toBe(false);

        press(branchEl, 'ArrowDown');

        child.destroy();
        group.destroy();
        branch.destroy();
        tree.destroy();
        rootUl.remove();
      });
    }));

  it('covers automatic selection on ArrowRight into child and ArrowLeft to parent when manual is false', () =>
    scope.run(() => {
      component().run(() => {
        const tree = new TreeAria({ manual: false, value: 'root' });
        const rootUl = bind(document.createElement('ul'), tree);
        document.body.appendChild(rootUl);

        let rootItem!: TreeItemAria;
        let rootLi!: HTMLElement;
        let childItem!: TreeItemAria;
        let childLi!: HTMLElement;
        let emptyBranch!: TreeItemAria;
        let emptyLi!: HTMLElement;

        component().run(() => {
          rootItem = new TreeItemAria({ name: 'root', expanded: true });
          rootLi = bind(document.createElement('li'), rootItem);
          rootUl.appendChild(rootLi);

          const group = new TreeGroupAria({ label: 'Root children' });
          const groupUl = bind(document.createElement('ul'), group);
          rootLi.appendChild(groupUl);

          expect(groupUl.getAttribute('aria-label')).toBe('Root children');
          expect(groupUl.hasAttribute('aria-labelledby')).toBe(false);

          component().run(() => {
            childItem = new TreeItemAria({ name: 'child' });
            childLi = bind(document.createElement('li'), childItem);
            groupUl.appendChild(childLi);
          });
        });

        component().run(() => {
          emptyBranch = new TreeItemAria({ name: 'empty', expanded: true });
          emptyLi = bind(document.createElement('li'), emptyBranch);
          rootUl.appendChild(emptyLi);
        });

        rootLi.focus();
        press(rootLi, 'ArrowRight');
        expect(document.activeElement).toBe(childLi);
        expect(tree.value).toBe('child');

        press(childLi, 'ArrowLeft');
        expect(document.activeElement).toBe(rootLi);
        expect(tree.value).toBe('root');

        rootItem.expanded = false;
        press(rootLi, 'ArrowLeft');
        expect(document.activeElement).toBe(rootLi);

        emptyLi.focus();
        press(emptyLi, 'ArrowRight');
        expect(document.activeElement).toBe(emptyLi);

        press(emptyLi, 'Tab');

        emptyBranch.destroy();
        childItem.destroy();
        rootItem.destroy();
        tree.destroy();
        rootUl.remove();
      });
    }));

  it('covers standalone TreeItem and TreeGroup without enclosing context and defaultPrevented guards', () =>
    scope.run(() => {
      let standaloneItem!: TreeItemAria;
      let itemEl!: HTMLElement;
      let standaloneGroup!: TreeGroupAria;
      let groupEl!: HTMLElement;

      component().run(() => {
        standaloneGroup = new TreeGroupAria({ labelledby: 'ext-label' });
        groupEl = bind(document.createElement('div'), standaloneGroup);
        document.body.appendChild(groupEl);
      });

      component().run(() => {
        standaloneItem = new TreeItemAria();
        itemEl = bind(document.createElement('div'), standaloneItem);
        document.body.appendChild(itemEl);
      });

      expect(groupEl.getAttribute('aria-labelledby')).toBe('ext-label');
      expect(groupEl.hidden).toBe(false);

      const canceledClick = new MouseEvent('click', { bubbles: true, cancelable: true });
      canceledClick.preventDefault();
      itemEl.dispatchEvent(canceledClick);

      const canceledKey = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      canceledKey.preventDefault();
      itemEl.dispatchEvent(canceledKey);

      const emptyTree = new TreeAria();
      emptyTree.destroy();
      standaloneGroup.destroy();
      standaloneItem.destroy();
      itemEl.remove();
      groupEl.remove();
    }));
});
