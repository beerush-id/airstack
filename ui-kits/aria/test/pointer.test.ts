import { describe, expect, it } from 'vitest';
import { openDragSession } from '../src/utils/pointer.js';

function pointer(type: string, init: MouseEventInit = {}): void {
  window.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, buttons: 1, ...init }));
}

describe('openDragSession', () => {
  it('routes window moves to onMove until pointer up ends the session', () => {
    const moves: number[] = [];
    const ups: number[] = [];
    const cancels: number[] = [];
    const close = openDragSession({
      onMove: () => moves.push(1),
      onUp: () => ups.push(1),
      onCancel: () => cancels.push(1),
    });

    pointer('pointermove');
    pointer('pointermove');
    expect(moves).toEqual([1, 1]);

    pointer('pointerup');
    expect(ups).toEqual([1]);
    expect(cancels).toEqual([]);

    pointer('pointermove');
    expect(moves).toEqual([1, 1]);

    close();
  });

  it('routes cancel to onCancel and ends the session', () => {
    const moves: number[] = [];
    const ups: number[] = [];
    const cancels: number[] = [];
    openDragSession({
      onMove: () => moves.push(1),
      onUp: () => ups.push(1),
      onCancel: () => cancels.push(1),
    });

    pointer('pointermove');
    pointer('pointercancel');
    expect(cancels).toEqual([1]);
    expect(ups).toEqual([]);

    pointer('pointermove');
    expect(moves).toEqual([1]);
  });

  it('ends the session early through the returned closer', () => {
    const moves: number[] = [];
    const ups: number[] = [];
    const close = openDragSession({
      onMove: () => moves.push(1),
      onUp: () => ups.push(1),
      onCancel: () => cancels.push(1),
    });

    close();
    pointer('pointermove');
    pointer('pointerup');
    expect(moves).toEqual([]);
    expect(ups).toEqual([]);
  });
});
