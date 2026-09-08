import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { Aria, aria, type BaseElement, JSXTranslator, roverCtx, ToolbarAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Toolbar - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Semantics & Attributes', () => {
    it('renders role="toolbar" and defaults to horizontal orientation', () =>
      scope.run(() => {
        component().run(() => {
          const toolbar = aria('toolbar');
          expect(toolbar.attributes.role).toBe('toolbar');
          expect(toolbar.attributes['aria-orientation']).toBe('horizontal');
        });
      }));

    it('renders aria-orientation="vertical" when configured as vertical', () =>
      scope.run(() => {
        component().run(() => {
          const toolbar = aria('toolbar', { orientation: 'vertical' });
          expect(toolbar.attributes.role).toBe('toolbar');
          expect(toolbar.attributes['aria-orientation']).toBe('vertical');
        });
      }));

    it('renders aria-disabled when disabled is true', () =>
      scope.run(() => {
        component().run(() => {
          const toolbar = aria('toolbar', { disabled: true });
          expect(toolbar.attributes['aria-disabled']).toBe('true');

          const disabledToolbar = aria('toolbar', { disabled: true });
          const disabledEl = bind(document.createElement('div'), disabledToolbar);
          disabledEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

          // Parent rover ignores keydown
          roverCtx.set(toolbar as unknown as Aria<BaseElement>);
          const childToolbar = aria('toolbar');
          const childEl = bind(document.createElement('div'), childToolbar);
          childEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          roverCtx.set(undefined);

          delete (toolbar.props as Record<string, unknown>).orientation;
          expect(toolbar.orientation).toBe('horizontal');

          const defaultToolbar = new ToolbarAria();
          expect(defaultToolbar.orientation).toBe('horizontal');
        });
      }));
  });

  describe('Keyboard Navigation & Roving Focus', () => {
    it('roves focus forward and backward across controls with ArrowRight / ArrowLeft in horizontal orientation', () =>
      scope.run(() => {
        component().run(() => {
          const toolbar = aria('toolbar');
          const toolbarEl = bind(document.createElement('div'), toolbar);
          document.body.appendChild(toolbarEl);

          const b1 = aria('button');
          const b2 = aria('button');
          const b3 = aria('button');

          const btn1 = bind(document.createElement('button'), b1);
          const btn2 = bind(document.createElement('button'), b2);
          const btn3 = bind(document.createElement('button'), b3);

          toolbarEl.appendChild(btn1);
          toolbarEl.appendChild(btn2);
          toolbarEl.appendChild(btn3);

          btn1.focus();
          expect(document.activeElement).toBe(btn1);

          // ArrowRight moves focus to next item
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(btn2);

          // ArrowRight moves to last item
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(btn3);

          // ArrowRight wraps around to first item
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(btn1);

          // ArrowLeft wraps around to last item
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          expect(document.activeElement).toBe(btn3);

          // ArrowLeft moves back to second item
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          expect(document.activeElement).toBe(btn2);

          toolbarEl.remove();
        });
      }));

    it('roves focus with ArrowDown / ArrowUp in vertical orientation', () =>
      scope.run(() => {
        component().run(() => {
          const toolbar = aria('toolbar', { orientation: 'vertical' });
          const toolbarEl = bind(document.createElement('div'), toolbar);
          document.body.appendChild(toolbarEl);

          const b1 = aria('button');
          const b2 = aria('button');

          const btn1 = bind(document.createElement('button'), b1);
          const btn2 = bind(document.createElement('button'), b2);

          toolbarEl.appendChild(btn1);
          toolbarEl.appendChild(btn2);

          btn1.focus();

          // ArrowDown moves focus to next item
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
          expect(document.activeElement).toBe(btn2);

          // ArrowUp moves focus back to previous item
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
          expect(document.activeElement).toBe(btn1);

          toolbarEl.remove();
        });
      }));

    it('navigates to first item on Home and last item on End', () =>
      scope.run(() => {
        component().run(() => {
          const toolbar = aria('toolbar');
          const toolbarEl = bind(document.createElement('div'), toolbar);
          document.body.appendChild(toolbarEl);

          const btn1 = bind(document.createElement('button'), aria('button'));
          const btn2 = bind(document.createElement('button'), aria('button'));
          const btn3 = bind(document.createElement('button'), aria('button'));

          toolbarEl.appendChild(btn1);
          toolbarEl.appendChild(btn2);
          toolbarEl.appendChild(btn3);

          btn1.focus();

          // End jumps to last item
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
          expect(document.activeElement).toBe(btn3);

          // Home jumps back to first item
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
          expect(document.activeElement).toBe(btn1);

          toolbarEl.remove();
        });
      }));

    it('does not trigger click or activation when roving focus (manual navigation)', () =>
      scope.run(() => {
        component().run(() => {
          const toolbar = aria('toolbar');
          const toolbarEl = bind(document.createElement('div'), toolbar);
          document.body.appendChild(toolbarEl);

          let clicked = false;
          const btn1 = bind(document.createElement('button'), aria('button'));
          const btn2 = bind(document.createElement('button'), aria('button'));
          btn2.addEventListener('click', () => {
            clicked = true;
          });

          toolbarEl.appendChild(btn1);
          toolbarEl.appendChild(btn2);

          btn1.focus();

          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(btn2);
          expect(clicked).toBe(false);

          toolbarEl.remove();
        });
      }));

    it('ignores keyboard navigation when toolbar is disabled', () =>
      scope.run(() => {
        component().run(() => {
          const toolbar = aria('toolbar', { disabled: true });
          const toolbarEl = bind(document.createElement('div'), toolbar);
          document.body.appendChild(toolbarEl);

          const btn1 = bind(document.createElement('button'), aria('button'));
          const btn2 = bind(document.createElement('button'), aria('button'));

          toolbarEl.appendChild(btn1);
          toolbarEl.appendChild(btn2);

          btn1.focus();

          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(btn1);

          toolbarEl.remove();
        });
      }));

    it('traps roving focus strictly inside the toolbar and never escapes to outside interactive elements', () =>
      scope.run(() => {
        component().run(() => {
          const beforeBtn = document.createElement('button');
          beforeBtn.id = 'before-toolbar';
          document.body.appendChild(beforeBtn);

          const toolbar = aria('toolbar');
          const toolbarEl = bind(document.createElement('div'), toolbar);
          document.body.appendChild(toolbarEl);

          const btn1 = bind(document.createElement('button'), aria('button'));
          const btn2 = bind(document.createElement('button'), aria('button'));
          toolbarEl.appendChild(btn1);
          toolbarEl.appendChild(btn2);

          const afterBtn = document.createElement('button');
          afterBtn.id = 'after-toolbar';
          document.body.appendChild(afterBtn);

          // Start at first button inside toolbar
          btn1.focus();
          expect(document.activeElement).toBe(btn1);

          // ArrowLeft from first item wraps to last item inside toolbar, never to beforeBtn
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          expect(document.activeElement).toBe(btn2);
          expect(document.activeElement).not.toBe(beforeBtn);

          // ArrowRight from last item wraps to first item inside toolbar, never to afterBtn
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(btn1);
          expect(document.activeElement).not.toBe(afterBtn);

          beforeBtn.remove();
          toolbarEl.remove();
          afterBtn.remove();
        });
      }));
  });

  describe('Realistic Mixed Composition & Boundary Containment', () => {
    it('roves seamlessly across a mix of standalone controls and nested groups while staying strictly contained', () =>
      scope.run(() => {
        component().run(() => {
          const outsideBefore = document.createElement('button');
          outsideBefore.id = 'outside-before';
          document.body.appendChild(outsideBefore);

          const toolbar = aria('toolbar');
          const toolbarEl = bind(document.createElement('div'), toolbar);
          document.body.appendChild(toolbarEl);

          // 1. Standalone leading button (e.g. Undo)
          const undoBtn = bind(document.createElement('button'), aria('button'));
          toolbarEl.appendChild(undoBtn);

          // 2. Nested group (e.g. Alignment: Left, Center, Right)
          const alignGroup = aria('radiogroup');
          const alignGroupEl = bind(document.createElement('div'), alignGroup);
          toolbarEl.appendChild(alignGroupEl);

          const leftRadio = bind(document.createElement('input'), alignGroup.radio({ value: 'left' }));
          const centerRadio = bind(document.createElement('input'), alignGroup.radio({ value: 'center' }));
          const rightRadio = bind(document.createElement('input'), alignGroup.radio({ value: 'right' }));
          alignGroupEl.appendChild(leftRadio);
          alignGroupEl.appendChild(centerRadio);
          alignGroupEl.appendChild(rightRadio);

          // 3. Standalone trailing button (e.g. Redo)
          const redoBtn = bind(document.createElement('button'), aria('button'));
          toolbarEl.appendChild(redoBtn);

          const outsideAfter = document.createElement('button');
          outsideAfter.id = 'outside-after';
          document.body.appendChild(outsideAfter);

          // Start at first control
          undoBtn.focus();
          expect(document.activeElement).toBe(undoBtn);

          // Forward traversal: Undo -> Left -> Center -> Right -> Redo -> wraps to Undo
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(leftRadio);

          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(centerRadio);

          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(rightRadio);

          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(redoBtn);

          // Wrap around to beginning: Redo -> Undo (never outsideAfter)
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(document.activeElement).toBe(undoBtn);
          expect(document.activeElement).not.toBe(outsideAfter);

          // Backward traversal: Undo wraps to Redo (never outsideBefore)
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          expect(document.activeElement).toBe(redoBtn);
          expect(document.activeElement).not.toBe(outsideBefore);

          // Redo -> Right -> Center -> Left -> Undo
          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          expect(document.activeElement).toBe(rightRadio);

          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          expect(document.activeElement).toBe(centerRadio);

          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          expect(document.activeElement).toBe(leftRadio);

          toolbarEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
          expect(document.activeElement).toBe(undoBtn);

          outsideBefore.remove();
          toolbarEl.remove();
          outsideAfter.remove();
        });
      }));
  });

  describe('JSX / React Framework Translation', () => {
    it('translates toolbar and child button attributes for JSX spread when JSXTranslator is active', () =>
      scope.run(() => {
        component().run(() => {
          Aria.translate(JSXTranslator);

          try {
            const toolbar = aria('toolbar');
            toolbar.refine(() => ({
              class: 'editor-toolbar',
              style: { padding: '8px' },
            }));

            const button = aria('toggle', { pressed: true });
            button.refine(() => ({
              class: 'toolbar-item',
              tabindex: 0,
            }));

            // Toolbar JSX attributes: class -> className, style normalization
            expect(toolbar.attributes.role).toBe('toolbar');
            expect(toolbar.attributes.className).toBe('editor-toolbar');
            expect(toolbar.attributes.class).toBeUndefined();
            expect(toolbar.attributes.style).toEqual({ padding: '8px' });

            // Button JSX attributes: tabindex -> tabIndex, class -> className
            expect(button.attributes.className).toBe('toolbar-item');
            expect(button.attributes.class).toBeUndefined();
            expect(button.attributes.tabIndex).toBe(0);
            expect(button.attributes.tabindex).toBeUndefined();
            expect(button.attributes['aria-pressed']).toBe('true');

            // Event handler and HTML prop mappings
            const clickHandler = () => {};
            const translated = JSXTranslator({
              onclick: clickHandler,
              readonly: true,
              maxlength: 100,
            });
            expect(translated.onClick).toBe(clickHandler);
            expect(translated.readOnly).toBe(true);
            expect(translated.maxLength).toBe(100);
          } finally {
            Aria.translate((input) => input);
          }
        });
      }));
  });
});
