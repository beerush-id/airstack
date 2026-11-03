import { type AnyType, createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ToggleAria, type ToggleGroupProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

type Member = { value: string; toggle: ToggleAria; el: HTMLElement };

function buildGroup(props: Partial<ToggleGroupProps>, values: string[], host: 'native' | 'custom' = 'native') {
  const group = aria('toggle-group', props as ToggleGroupProps);
  const groupEl = bind(document.createElement('div'), group);
  document.body.appendChild(groupEl);

  const members: Member[] = values.map((value) => {
    const toggle =
      host === 'native' ? aria('toggle', { value }) : aria<HTMLDivElement>('toggle', { value }, { native: false });

    const el = bind(document.createElement(host === 'native' ? 'button' : 'div'), toggle);
    groupEl.appendChild(el);
    return { value, toggle, el };
  }) as AnyType[];

  const cleanup = () => {
    for (const { toggle } of members) {
      toggle.destroy();
    }

    group.destroy();
    groupEl.remove();
  };

  return { group, groupEl, members, cleanup };
}

function press(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

function pressSpace(el: HTMLElement): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
}

function stops(members: Member[]): Array<string | null> {
  return members.map(({ el }) => el.getAttribute('tabindex'));
}

describe('ToggleGroup - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Container Semantics Invariant', () => {
    it('compiles role="group" for both archetypes and claims no orientation axis', () =>
      scope.run(() => {
        component().run(() => {
          const single = buildGroup({ value: 'bold' }, ['bold', 'italic']);
          expect(single.groupEl.getAttribute('role')).toBe('group');
          expect(single.groupEl.getAttribute('aria-disabled')).toBe('false');
          expect(single.group.attributes['aria-orientation']).toBeUndefined();
          expect(single.groupEl.hasAttribute('aria-orientation')).toBe(false);
          single.cleanup();

          const multiple = buildGroup({ multiple: true, value: ['bold'] }, ['bold', 'italic']);
          expect(multiple.groupEl.getAttribute('role')).toBe('group');
          expect(multiple.groupEl.getAttribute('aria-disabled')).toBe('false');
          multiple.cleanup();
        });
      }));

    it('keeps the group a group for a single-press archetype that could have been a radiogroup', () =>
      scope.run(() => {
        component().run(() => {
          const { group, groupEl, cleanup } = buildGroup({ value: 'mono' }, ['mono', 'serif']);
          expect(group.attributes.role).toBe('group');
          expect(groupEl.getAttribute('role')).toBe('group');
          cleanup();
        });
      }));
  });

  describe('Member Pressed Projection Invariant', () => {
    it('projects membership through aria-pressed and never through aria-checked', () =>
      scope.run(() => {
        component().run(() => {
          const native = buildGroup({ value: 'a' }, ['a', 'b']);
          expect(native.members[0].el.getAttribute('aria-pressed')).toBe('true');
          expect(native.members[1].el.getAttribute('aria-pressed')).toBe('false');
          expect(native.members[0].el.hasAttribute('aria-checked')).toBe(false);
          expect(native.members[0].el.getAttribute('role')).toBeNull();
          expect(native.members[0].toggle.pressed).toBe(true);
          native.cleanup();

          const custom = buildGroup({ value: 'a' }, ['a', 'b'], 'custom');
          expect(custom.members[0].el.getAttribute('role')).toBe('button');
          expect(custom.members[0].el.getAttribute('aria-pressed')).toBe('true');
          expect(custom.members[1].el.getAttribute('aria-pressed')).toBe('false');
          expect(custom.members[1].el.hasAttribute('aria-checked')).toBe(false);
          custom.cleanup();
        });
      }));

    it('derives pressed from the group value rather than from any member-level claim', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'b' });
          const { members, cleanup } = buildGroup(props, ['a', 'b', 'c']);

          expect(members.map(({ toggle }) => toggle.pressed)).toEqual([false, true, false]);
          expect(members.map(({ el }) => el.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
          cleanup();
        });
      }));
  });

  describe('Single Selection Coordination Invariant', () => {
    it('moves the single pressed member on activation and releases it when it is activated again', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'left' });
          const { members, cleanup } = buildGroup(props, ['left', 'center', 'right']);

          const [left, center, right] = members;

          center.el.click();
          expect(props.value).toBe('center');
          expect(left.el.getAttribute('aria-pressed')).toBe('false');
          expect(center.el.getAttribute('aria-pressed')).toBe('true');

          center.el.click();
          expect(props.value).toBeUndefined();
          expect(center.el.getAttribute('aria-pressed')).toBe('false');

          right.el.click();
          expect(props.value).toBe('right');
          expect(right.el.getAttribute('aria-pressed')).toBe('true');

          right.el.click();
          expect(props.value).toBeUndefined();
          cleanup();
        });
      }));

    it('releases the holder with the same gesture on a custom host', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'one' });
          const { members, cleanup } = buildGroup(props, ['one', 'two'], 'custom');

          members[0].el.click();
          expect(props.value).toBeUndefined();
          expect(members[0].el.getAttribute('aria-pressed')).toBe('false');
          cleanup();
        });
      }));

    it('moves the pressed state and the single tab stop together on an external write', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'a' });
          const { members, cleanup } = buildGroup(props, ['a', 'b', 'c']);

          expect(stops(members)).toEqual(['0', '-1', '-1']);

          props.value = 'c';
          expect(members[0].el.getAttribute('aria-pressed')).toBe('false');
          expect(members[2].el.getAttribute('aria-pressed')).toBe('true');
          expect(stops(members)).toEqual(['-1', '-1', '0']);

          props.value = undefined;
          expect(members[2].toggle.pressed).toBe(false);
          expect(members.map(({ el }) => el.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
          expect(stops(members)).toEqual(['-1', '-1', '-1']);
          cleanup();
        });
      }));
  });

  describe('Multiple Selection Coordination Invariant', () => {
    it('adds and releases each token in the shared array without touching the others', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ multiple: true, value: ['bold'] });
          const { members, cleanup } = buildGroup(props, ['bold', 'italic', 'under']);

          const [bold, italic, under] = members;

          italic.el.click();
          expect(props.value).toEqual(['bold', 'italic']);
          expect(under.toggle.pressed).toBe(false);

          bold.el.click();
          expect(props.value).toEqual(['italic']);
          expect(bold.el.getAttribute('aria-pressed')).toBe('false');
          expect(italic.el.getAttribute('aria-pressed')).toBe('true');

          italic.el.click();
          expect(props.value).toEqual([]);
          cleanup();
        });
      }));

    it('opens the set from the empty array the author declares', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<Partial<ToggleGroupProps>>({ multiple: true, value: [] });
          const { members, cleanup } = buildGroup(props, ['a', 'b']);

          expect(members.map(({ toggle }) => toggle.pressed)).toEqual([false, false]);

          members[1].el.click();
          expect(props.value).toEqual(['b']);

          members[0].el.click();
          expect(props.value).toEqual(['b', 'a']);
          cleanup();
        });
      }));

    it('holds several pressed members on one tab stop each while arrows stay inert', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ multiple: true, value: ['a', 'c'] });
          const { members, cleanup } = buildGroup(props, ['a', 'b', 'c']);

          expect(stops(members)).toEqual(['0', '-1', '0']);

          members[0].el.focus();
          const event = press(members[0].el, 'ArrowRight');
          expect(event.defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[1].el);
          expect(props.value).toEqual(['a', 'c']);
          expect(members[1].el.getAttribute('aria-pressed')).toBe('false');
          cleanup();
        });
      }));
  });

  describe('Roving Focus Invariant', () => {
    it('travels every arrow on both axes and wraps without committing any value', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'one' });
          const { members, cleanup } = buildGroup(props, ['one', 'two', 'three']);

          const [one, two, three] = members;
          one.el.focus();

          expect(press(one.el, 'ArrowRight').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(two.el);

          expect(press(two.el, 'ArrowDown').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(three.el);

          expect(props.value).toBe('one');
          expect(three.el.getAttribute('aria-pressed')).toBe('false');

          expect(press(three.el, 'ArrowRight').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(one.el);

          expect(press(one.el, 'ArrowLeft').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(three.el);

          expect(press(three.el, 'ArrowUp').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(two.el);

          expect(props.value).toBe('one');
          cleanup();
        });
      }));

    it('sends Home and End to the first and last enabled member', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'a' });
          const { members, cleanup } = buildGroup(props, ['a', 'b', 'c']);

          members[1].el.focus();

          expect(press(members[1].el, 'End').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[2].el);

          expect(press(members[2].el, 'Home').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[0].el);

          expect(props.value).toBe('a');
          cleanup();
        });
      }));

    it('passes over a disabled member in both directions', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'first' });
          const { members, cleanup } = buildGroup(props, ['first', 'second', 'third']);

          members[1].toggle.assign({ disabled: true });
          expect(members[1].el.getAttribute('tabindex')).toBe('-1');

          members[0].el.focus();
          expect(press(members[0].el, 'ArrowRight').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[2].el);

          expect(press(members[2].el, 'ArrowLeft').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[0].el);

          expect(press(members[0].el, 'End').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[2].el);

          expect(press(members[2].el, 'ArrowDown').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[0].el);

          expect(props.value).toBe('first');
          cleanup();
        });
      }));

    it('claims no arrow key while the group is declared disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<Partial<ToggleGroupProps>>({ disabled: true });
          const { members, cleanup } = buildGroup(props, ['a', 'b'], 'custom');

          members[0].el.focus();
          for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']) {
            const event = press(members[0].el, key);
            expect(event.defaultPrevented).toBe(false);
          }

          expect(document.activeElement).toBe(members[0].el);
          cleanup();
        });
      }));

    it('travels the same way when the members are custom hosts', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'x' });
          const { members, cleanup } = buildGroup(props, ['x', 'y', 'z'], 'custom');

          members[0].el.focus();
          expect(members[0].el.getAttribute('role')).toBe('button');

          expect(press(members[0].el, 'ArrowRight').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[1].el);
          expect(props.value).toBe('x');

          expect(press(members[1].el, 'ArrowLeft').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[0].el);

          expect(press(members[0].el, 'End').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[2].el);
          cleanup();
        });
      }));
  });

  describe('Activation Invariant', () => {
    it('activates the focused custom member through Enter and Space and deselects on repeat', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: undefined });
          const { members, cleanup } = buildGroup(props, ['one', 'two'], 'custom');

          const [one, two] = members;
          two.el.focus();

          press(two.el, 'Enter');
          expect(props.value).toBe('two');
          expect(two.el.getAttribute('aria-pressed')).toBe('true');

          press(two.el, 'Enter');
          expect(props.value).toBeUndefined();

          pressSpace(two.el);
          expect(props.value).toBe('two');

          pressSpace(two.el);
          expect(props.value).toBeUndefined();

          press(one.el, 'Enter');
          expect(props.value).toBe('one');
          cleanup();
        });
      }));

    it('leaves a canceled activation keystroke uncommitted', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: undefined });
          const { groupEl, members, cleanup } = buildGroup(props, ['solo'], 'custom');

          const cancel = (event: Event) => event.preventDefault();
          groupEl.addEventListener('keydown', cancel, { capture: true });

          const event = press(members[0].el, 'Enter');
          expect(event.defaultPrevented).toBe(true);
          expect(props.value).toBeUndefined();
          expect(members[0].toggle.pressed).toBe(false);
          cleanup();
        });
      }));

    it('refuses activation on a disabled member on both hosts while the group stays live', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'a' });
          const { members, cleanup } = buildGroup(props, ['a', 'b']);

          members[1].toggle.assign({ disabled: true });
          expect((members[1].el as HTMLButtonElement).disabled).toBe(true);

          members[1].el.click();
          expect(props.value).toBe('a');
          expect(members[1].toggle.pressed).toBe(false);
          cleanup();
        });

        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'a' });
          const { members, cleanup } = buildGroup(props, ['a', 'b'], 'custom');

          members[1].toggle.assign({ disabled: true });
          expect(members[1].el.getAttribute('aria-disabled')).toBe('true');

          press(members[1].el, 'Enter');
          expect(props.value).toBe('a');
          expect(members[1].toggle.pressed).toBe(false);
          cleanup();
        });
      }));
  });

  describe('Declared Disablement Invariant', () => {
    it('withdraws every tab stop and refuses both activation and traversal while the group is disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'x', disabled: false });
          const { groupEl, members, cleanup } = buildGroup(props, ['x', 'y'], 'custom');

          props.disabled = true;
          expect(groupEl.getAttribute('aria-disabled')).toBe('true');
          expect(stops(members)).toEqual(['-1', '-1']);
          expect(members[0].el.getAttribute('aria-disabled')).toBe('true');

          members[1].el.click();
          expect(props.value).toBe('x');

          members[0].el.focus();
          const event = press(members[0].el, 'ArrowRight');
          expect(event.defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(members[0].el);

          props.disabled = false;
          expect(groupEl.getAttribute('aria-disabled')).toBe('false');
          expect(stops(members)).toEqual(['0', '-1']);

          members[0].el.click();
          expect(props.value).toBeUndefined();
          cleanup();
        });
      }));

    it('takes the tab stop off the holder when it becomes disabled and hands it back on release', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'a' });
          const { members, cleanup } = buildGroup(props, ['a', 'b', 'c']);

          expect(members[0].el.getAttribute('tabindex')).toBe('0');

          members[0].toggle.assign({ disabled: true });
          expect(props.value).toBe('a');
          expect(members[0].el.getAttribute('tabindex')).toBe('-1');
          expect(members[0].el.getAttribute('aria-pressed')).toBe('true');

          members[0].toggle.assign({ disabled: false });
          expect(members[0].el.getAttribute('tabindex')).toBe('0');
          expect(members[0].el.getAttribute('aria-pressed')).toBe('true');
          cleanup();
        });
      }));
  });

  describe('Change Announcement Invariant', () => {
    it('reaches the container with the member pressed commit as a bubbling change event', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'a' });
          const { groupEl, members, cleanup } = buildGroup(props, ['a', 'b']);

          const commits: Array<{ bubbles: boolean; detail: unknown; source: string }> = [];
          groupEl.addEventListener('change', (event) =>
            commits.push({
              bubbles: event.bubbles,
              detail: (event as CustomEvent).detail,
              source: event.target === groupEl ? 'container' : 'member',
            })
          );

          members[1].el.click();
          expect(commits).toEqual([{ bubbles: true, detail: 'b', source: 'member' }]);
          expect(props.value).toBe('b');

          members[1].el.click();
          expect(commits.map(({ detail }) => detail)).toEqual(['b', null]);
          expect(props.value).toBeUndefined();
          cleanup();
        });
      }));

    it('reports each member commit and lets the container read the whole set', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ multiple: true, value: [] });
          const { groupEl, members, cleanup } = buildGroup(props, ['a', 'b']);

          const commits: Array<{ detail: unknown; set: string[] }> = [];
          groupEl.addEventListener('change', (event) => {
            const detail = (event as CustomEvent).detail;
            commits.push({
              detail: Array.isArray(detail) ? [...detail] : detail,
              set: [...(props.value as string[])],
            });
          });

          members[0].el.click();
          members[1].el.click();
          members[0].el.click();
          expect(commits.map(({ detail }) => detail)).toEqual([['a'], ['a', 'b'], ['b']]);
          expect(commits.map(({ set }) => set)).toEqual([['a'], ['a', 'b'], ['b']]);
          cleanup();
        });
      }));

    it('invokes the group onchange with the member commit that reaches the container', () =>
      scope.run(() => {
        component().run(() => {
          const commits: unknown[][] = [];
          const props = mutable<Partial<ToggleGroupProps>>({
            value: 'a',
            onchange: (event) => commits.push([event.detail, props.value ?? null]),
          });
          const { members, cleanup } = buildGroup(props, ['a', 'b']);

          members[1].el.click();
          expect(commits).toEqual([['b', 'b']]);

          members[1].el.click();
          expect(commits).toEqual([
            ['b', 'b'],
            [null, null],
          ]);

          props.value = 'a';
          expect(commits).toHaveLength(2);
          cleanup();
        });
      }));

    it('stays silent when the value moves through an external write', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ToggleGroupProps>({ value: 'a' });
          const { groupEl, members, cleanup } = buildGroup(props, ['a', 'b']);

          const commits: unknown[] = [];
          groupEl.addEventListener('change', (event) => {
            if (event.target === groupEl) commits.push((event as CustomEvent).detail);
          });

          props.value = 'b';
          expect(members[1].el.getAttribute('aria-pressed')).toBe('true');
          expect(commits).toEqual([]);
          cleanup();
        });
      }));
  });
});
