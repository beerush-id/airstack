import { anchor, effect, mutable, sleep } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { type DateGrid, dateGrids } from '../../utils/calendar.js';
import type { PopoverAria } from '../../widgets/index.js';
import { bindPanel, type PopupPanel, popupCtx } from '../popup.js';
import { type DatePickerBase, dateSelectionCtx } from './picker.js';

export interface DatePickerCalendarAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'dialog';
  hidden?: boolean;
  'aria-label'?: string;
}

export class DatePickerCalendarAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  AriaProps,
  DatePickerCalendarAttributes<E>
> {
  public host?: DatePickerBase;
  public popup!: PopoverAria;
  public grid: DateGrid = mutable({ year: 0, month: 0, weeks: [], dates: [] }, { recursive: false });

  public get id(): string {
    return this.host?.panelId ?? this.properties.id;
  }

  public get open(): boolean {
    return this.popup.open;
  }

  public get weeks() {
    return this.grid.weeks ?? [];
  }

  public get dates() {
    return this.grid.dates ?? [];
  }

  /* istanbul ignore next: no flow assigns calendar.current; popup tracks the element through its own ref */
  public override set current(element: E | null) {
    super.current = element;
    this.popup.current = element as unknown as HTMLElement;
  }

  public constructor(props: AriaProps = {}) {
    super(dateSelectionCtx.get(props));

    this.host = popupCtx.get() as unknown as DatePickerBase | undefined;
    bindPanel(this as unknown as PopupPanel, { mode: ['click'], xDir: 'right', yDir: 'below' });

    this.omittedAttrs.push(...((this.host as unknown as this)?.omittedAttrs ?? []));

    effect(() => {
      if (!this.host || !this.open) return;

      const { year, month } = this.host.range as { year: number; month: number };
      if (this.grid.year === year && this.grid.month === month) return;

      anchor.assign(
        this.grid,
        dateGrids({
          year,
          month,
          locales: this.host!.properties.locales!,
          trimWeeks: this.host.options.grid === 'dynamic',
        })
      );
    });

    this.on('keydown', this.handleGridKey);
    this.update();
  }

  public override destroy(): void {
    this.popup.destroy();
    super.destroy();
  }

  protected override createAttributes(): DatePickerCalendarAttributes<E> {
    const overrides: DatePickerCalendarAttributes<E> = {
      id: this.id,
      role: 'dialog',
      hidden: !this.properties.open,
      tabindex: 0,
      'aria-label': this.host?.properties.label,
    };

    return Object.assign((this.popup as unknown as this).attrs, overrides);
  }

  private readonly handleGridKey = async (event: KeyboardEvent): Promise<void> => {
    const host = this.host;
    if (!host || host.disabled || event.defaultPrevented) return;

    const target = event.target as HTMLElement | null;
    const date = target?.getAttribute?.('data-date') ?? undefined;

    const key = event.key;
    let index = this.dates.findIndex((d) => d.iso === date);
    if (index === -1) index = 0;

    if (key === 'PageUp' || key === 'PageDown') {
      event.preventDefault();

      const direction = key === 'PageUp' ? -1 : 1;
      host.navigateMonth(direction);

      await sleep(0);

      this.focusDate(this.grid.dates?.[index].iso);
      return;
    }

    if (!date) return;

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const nextIndex = index + (key === 'ArrowRight' ? 1 : -1);
      this.focusDate(this.dates[nextIndex]?.iso, event);
      return;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const nextIndex = index + (key === 'ArrowDown' ? 7 : -7);
      this.focusDate(this.dates[nextIndex]?.iso, event);
      return;
    }

    if (key === 'Home' || key === 'End') {
      const nextIndex = key === 'Home' ? index - (index % 7) : index + (6 - (index % 7));
      this.focusDate(this.dates[nextIndex]?.iso, event);
      return;
    }

    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      host.select(new Date(date).toISOString());
    }
  };

  private focusDate(iso?: string | null, event?: Event): void {
    const root = this.element as unknown as HTMLElement | null;

    let day = root?.querySelector(`[data-date="${iso}"]`) as HTMLElement;

    if (!day) day = root?.querySelector('[data-selected="true"]') as HTMLElement;
    if (!day) day = root?.querySelector('[data-current="date"]') as HTMLElement;
    if (!day) day = root?.querySelector('[data-data]:not(:disabled, [aria-disabled="true"])') as HTMLElement;

    if (day) {
      event?.preventDefault();
      day.focus();
    }
  }
}
