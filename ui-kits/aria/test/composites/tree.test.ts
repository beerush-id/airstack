import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type TreeProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

interface Node {
  name: string;
  expanded?: boolean;
  children?: Node[];
}

function buildTree(props: Partial<TreeProps>, nodes: Node[]) {
  const tree = aria('tree', props as TreeProps);
  const rootUl = bind(document.createElement('ul'), tree);
  rootUl.setAttribute('aria-label', 'Files');
  document.body.appendChild(rootUl);

  const byName = new Map<string, { item: ReturnType<typeof aria>; el: HTMLElement }>();
  const groups: Array<ReturnType<typeof aria>> = [];

  const render = (level: Node[], parent: HTMLElement) => {
    for (const node of level) {
      const slot = component();
      slot.run(() => {
        const item = aria('tree-item', { name: node.name, expanded: node.expanded });
        const el = bind(document.createElement('li'), item);
        el.dataset.name = node.name;
        parent.appendChild(el);
        byName.set(node.name, { item, el });

        if (node.children) {
          const groupCtrl = aria('tree-group');
          groups.push(groupCtrl);
          const group = bind(document.createElement('ul'), groupCtrl);
          group.dataset.for = node.name;
          el.appendChild(group);
          render(node.children, group);
        }
      });
    }
  };

  render(nodes, rootUl);

  const cleanup = () => {
    tree.destroy();
    for (const group of groups) {
      group.destroy();
    }
    for (const { item } of byName.values()) {
      item.destroy();
    }

    rootUl.remove();
  };

  const node = (name: string) => byName.get(name);

  return { tree, rootUl, node, cleanup };
}

function press(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

const focusedNode = () => (document.activeElement as HTMLElement)?.getAttribute('data-name') ?? null;

describe('Tree - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Hierarchical Branch Expansion Invariant', () => {
    it('expands and collapses a branch from the arrow keys and moves focus into it', () =>
      scope.run(() => {
        component().run(() => {
          const toggled: boolean[] = [];
          const { rootUl, node, cleanup } = buildTree({ value: undefined }, [
            {
              name: 'src',
              expanded: false,
              children: [{ name: 'app' }, { name: 'main' }],
            },
            { name: 'readme' },
          ]);

          node('src')?.item.assign({
            ontoggle: (e: CustomEvent<boolean>) => toggled.push(e.detail),
          });

          expect(node('src')?.el.getAttribute('role')).toBe('treeitem');
          expect(node('src')?.el.getAttribute('aria-expanded')).toBe('false');
          expect(node('readme')?.el.hasAttribute('aria-expanded')).toBe(false);
          expect(rootUl.getAttribute('role')).toBe('tree');
          expect(rootUl.getAttribute('aria-multiselectable')).toBe('false');

          node('src')?.el.focus();

          expect(press(node('src')!.el, 'ArrowRight').defaultPrevented).toBe(true);
          expect(node('src')?.el.getAttribute('aria-expanded')).toBe('true');
          expect(focusedNode()).toBe('src');
          expect(toggled).toEqual([true]);

          press(node('src')!.el, 'ArrowRight');
          expect(focusedNode()).toBe('app');

          press(node('app')!.el, 'ArrowRight');
          expect(focusedNode()).toBe('app');

          press(node('app')!.el, 'ArrowLeft');
          expect(focusedNode()).toBe('src');
          expect(node('src')?.el.getAttribute('aria-expanded')).toBe('true');

          press(node('src')!.el, 'ArrowLeft');
          expect(node('src')?.el.getAttribute('aria-expanded')).toBe('false');
          expect(toggled).toEqual([true, false]);

          cleanup();
        });
      }));

    it('keeps a collapsed branch out of the vertical traversal', () =>
      scope.run(() => {
        component().run(() => {
          const { node, cleanup } = buildTree({ value: undefined }, [
            { name: 'a-root', expanded: false, children: [{ name: 'a-child' }] },
            { name: 'b-root' },
          ]);

          node('a-root')?.el.focus();

          press(node('a-root')!.el, 'ArrowDown');
          expect(focusedNode()).toBe('b-root');

          press(node('b-root')!.el, 'ArrowUp');
          expect(focusedNode()).toBe('a-root');

          node('a-root')?.item.assign({ expanded: true });
          expect(node('a-root')?.el.getAttribute('aria-expanded')).toBe('true');

          node('a-root')?.el.focus();
          press(node('a-root')!.el, 'ArrowDown');
          expect(focusedNode()).toBe('a-child');

          press(node('a-child')!.el, 'ArrowDown');
          expect(focusedNode()).toBe('b-root');

          press(node('b-root')!.el, 'Home');
          expect(focusedNode()).toBe('a-root');

          press(node('a-root')!.el, 'End');
          expect(focusedNode()).toBe('b-root');

          cleanup();
        });
      }));

    it('expands a nested branch without disturbing its ancestor states', () =>
      scope.run(() => {
        component().run(() => {
          const { node, cleanup } = buildTree({ value: undefined }, [
            {
              name: 'outer',
              expanded: true,
              children: [{ name: 'inner', expanded: false, children: [{ name: 'leaf' }] }, { name: 'sibling' }],
            },
          ]);

          expect(node('outer')?.el.getAttribute('aria-expanded')).toBe('true');
          expect(node('inner')?.el.getAttribute('aria-expanded')).toBe('false');
          expect(node('leaf')?.el.hasAttribute('aria-expanded')).toBe(false);

          node('inner')?.el.focus();
          press(node('inner')!.el, 'ArrowRight');

          expect(node('inner')?.el.getAttribute('aria-expanded')).toBe('true');
          expect(node('outer')?.el.getAttribute('aria-expanded')).toBe('true');

          cleanup();
        });
      }));
  });

  describe('Depth-Aware Directional Traversal Invariant', () => {
    it('separates focus from selection under the default manual mode', () =>
      scope.run(() => {
        component().run(() => {
          const changes: Array<string | undefined> = [];
          const props = mutable<TreeProps>({
            value: 'readme',
            onchange: (e) => changes.push(e.detail as string | undefined),
          });
          const { node, cleanup } = buildTree(props, [
            { name: 'src', expanded: true, children: [{ name: 'app' }] },
            { name: 'readme' },
          ]);

          node('src')?.el.focus();

          press(node('src')!.el, 'ArrowDown');
          expect(focusedNode()).toBe('app');
          expect(props.value).toBe('readme');
          expect(node('app')?.el.getAttribute('aria-selected')).toBe('false');
          expect(node('readme')?.el.getAttribute('aria-selected')).toBe('true');

          press(node('app')!.el, 'Enter');
          expect(props.value).toBe('app');
          expect(node('app')?.el.getAttribute('aria-selected')).toBe('true');
          expect(node('readme')?.el.getAttribute('aria-selected')).toBe('false');
          expect(changes).toEqual(['app']);

          node('readme')?.el.focus();
          press(node('readme')!.el, ' ');
          expect(props.value).toBe('readme');
          expect(changes).toEqual(['app', 'readme']);

          node('src')?.el.click();
          expect(props.value).toBe('src');
          expect(changes).toEqual(['app', 'readme', 'src']);

          cleanup();
        });
      }));

    it('commits selection on movement when manual is switched off', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<TreeProps>({ value: 'a', manual: false });
          const { node, cleanup } = buildTree(props, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]);

          node('a')?.el.focus();

          press(node('a')!.el, 'ArrowDown');
          expect(focusedNode()).toBe('b');
          expect(props.value).toBe('b');
          expect(node('b')?.el.getAttribute('aria-selected')).toBe('true');
          expect(node('a')?.el.getAttribute('aria-selected')).toBe('false');

          cleanup();
        });
      }));

    it('moves between visible nodes without skipping levels or reversing', () =>
      scope.run(() => {
        component().run(() => {
          const { node, cleanup } = buildTree({ value: undefined }, [
            { name: 'root', expanded: true, children: [{ name: 'child' }] },
            { name: 'after' },
          ]);

          node('root')?.el.focus();
          const seen = ['root'];

          press(node('root')!.el, 'ArrowDown');
          seen.push(focusedNode() as string);

          press(node('child')!.el, 'ArrowDown');
          seen.push(focusedNode() as string);

          expect(seen).toEqual(['root', 'child', 'after']);

          press(node('after')!.el, 'ArrowUp');
          expect(focusedNode()).toBe('child');

          cleanup();
        });
      }));
  });

  describe('Selection Registry & Multi-Level Association Invariant', () => {
    it('keeps one selection across the hierarchy and releases it only when optional', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<TreeProps>({ value: 'child' });
          const { node, cleanup } = buildTree(props, [
            { name: 'root', expanded: true, children: [{ name: 'child' }] },
            { name: 'other' },
          ]);

          expect(node('child')?.el.getAttribute('aria-selected')).toBe('true');
          expect(node('root')?.el.getAttribute('aria-selected')).toBe('false');

          node('child')?.el.focus();
          press(node('child')!.el, 'Enter');
          expect(props.value).toBeUndefined();
          expect(node('child')?.el.getAttribute('aria-selected')).toBe('false');

          node('root')?.el.focus();
          press(node('root')!.el, 'Enter');
          expect(props.value).toBe('root');
          expect(node('root')?.el.getAttribute('aria-selected')).toBe('true');

          props.required = true;
          node('root')?.el.focus();
          press(node('root')!.el, 'Enter');
          expect(props.value).toBe('root');

          cleanup();
        });
      }));

    it('toggles array membership for nodes at any depth', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<TreeProps>({ multiple: true, value: ['root'] });
          const { node, cleanup } = buildTree(props, [
            { name: 'root', expanded: true, children: [{ name: 'child' }] },
            { name: 'other' },
          ]);

          expect(node('root')?.el.parentElement?.getAttribute('role')).toBe('tree');
          expect(props.value).toEqual(['root']);

          node('child')?.el.focus();
          press(node('child')!.el, 'Enter');
          expect(props.value).toEqual(['root', 'child']);
          expect(node('child')?.el.getAttribute('aria-selected')).toBe('true');

          expect(node('root')?.el.getAttribute('aria-selected')).toBe('true');

          press(node('root')!.el, 'Enter');
          expect(props.value).toEqual(['child']);
          expect(node('root')?.el.getAttribute('aria-selected')).toBe('false');

          cleanup();
        });
      }));

    it('leaves a disabled node unselectable and unexpanded', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<TreeProps>({ value: 'keep' });
          const { node, cleanup } = buildTree(props, [
            { name: 'locked', expanded: false, children: [{ name: 'hidden' }] },
            { name: 'keep' },
          ]);

          node('locked')?.item.assign({ disabled: true });
          expect(node('locked')?.el.getAttribute('aria-disabled')).toBe('true');

          node('locked')?.el.focus();
          press(node('locked')!.el, 'Enter');
          expect(props.value).toBe('keep');
          expect(node('locked')?.el.getAttribute('aria-selected')).toBe('false');

          press(node('locked')!.el, 'ArrowRight');
          expect(node('locked')?.el.getAttribute('aria-expanded')).toBe('false');

          cleanup();
        });
      }));

    it('gives every node an address its group can be labelled by', () =>
      scope.run(() => {
        component().run(() => {
          const { node, rootUl, cleanup } = buildTree({ value: undefined }, [
            { name: 'parent', expanded: true, children: [{ name: 'kid' }] },
          ]);

          const parentId = node('parent')?.el.id;
          expect(typeof parentId).toBe('string');
          expect((parentId as string).length).toBeGreaterThan(0);
          expect(node('kid')?.el.id).not.toBe(parentId);

          const group = rootUl.querySelector<HTMLElement>('ul[data-for="parent"]');
          expect(group?.getAttribute('role')).toBe('group');
          expect(group?.getAttribute('aria-labelledby')).toBe(parentId);
          expect(group?.hidden).toBe(false);
          expect(document.getElementById(parentId as string)).toBe(node('parent')?.el);

          node('parent')?.item.assign({ expanded: false });
          expect(group?.hidden).toBe(true);

          cleanup();
        });
      }));
  });
});
