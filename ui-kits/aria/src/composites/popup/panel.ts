import { Aria } from '../../core.js';
import type { AriaAttributes } from '../../types.js';
import { type OverlayTriggerMode, PopoverAria, type PopoverRole } from '../../widgets/popover.js';
import { PopupAria } from './popup.js';

export abstract class PopupPanel extends Aria {
  abstract get id(): string;
  abstract host: PopupAria;
  abstract popup: PopoverAria;
}

export type PopupBindOptions = {
  mode?: OverlayTriggerMode[];
  xDir?: string;
  yDir?: string;
};

export function bindPanel(
  panel: PopupPanel,
  { mode, xDir, yDir }: PopupBindOptions = { mode: ['click', 'rove'], xDir: 'left', yDir: 'below' }
) {
  panel.actionable = panel.scope?.actionable;

  panel.popup = new PopoverAria(
    {
      mode,
      get xDir() {
        return panel.properties.xDir ?? xDir;
      },
      get yDir() {
        return panel.properties.yDir ?? yDir;
      },
      get id() {
        return panel.id;
      },
      get open() {
        return panel.properties.open;
      },
      set open(value: boolean) {
        panel.properties.open = value;
      },
      get delay() {
        return panel.properties.delay;
      },
      get onopen() {
        return panel.properties.onopen;
      },
      get onclose() {
        return panel.properties.onclose;
      },
    },
    { popupRole: (panel.host?.options?.panelRole as PopoverRole) ?? 'listbox' }
  );

  const ref = panel.ref;
  panel.ref = ((el) => {
    ref(el);
    panel.popup.ref(el as unknown as HTMLElement);
  }) as typeof ref;
}
