import { AUI_CLASS } from '@airlib/aui/utils';
import { $bind, effect, setup } from '@airlib/react';
import { Toggle, ToggleGroup, type ToggleGroupProps, Tooltip } from '@airlib/react-aui';
import { DarkModeIcon, LightModeIcon, SystemThemeIcon } from '@airlib/react-aui/icons';
import type { ComponentType } from 'react';
import { type ThemeMode, themeSetting } from './theme.js';

export type { ThemeMode } from './theme.js';

export type ThemeSwitchProps = Pick<ToggleGroupProps, 'orientation' | 'variant' | 'size' | 'collapsible'>;

/**
 * Follows the system's color scheme, or holds light or dark. It edits the site's one theme
 * setting, so every switch — and any answer bound to `settings.theme.mode` — shows and changes
 * the same choice, and the page follows it.
 */
export const ThemeSwitch = setup<ThemeSwitchProps>((props) => {
  const [theme, stored] = themeSetting();

  effect.client(() => {
    document.documentElement.dataset.theme = stored.mode;
  });

  // In a column the hints open beside the buttons, so they never cover the next one.
  const hintSide = () => (props.orientation === 'vertical' ? 'before' : undefined);

  return () => (
    <ToggleGroup
      aria-label="Theme"
      value={$bind(theme, 'mode')}
      required
      size={props.size ?? 'sm'}
      orientation={props.orientation}
      variant={props.variant}
      collapsible={props.collapsible}
    >
      {MODES.map((mode) => (
        <Toggle key={mode.value} value={mode.value} aria-label={mode.label} className={AUI_CLASS.CONTROL_ICON}>
          <mode.Icon />
          <Tooltip xDir={hintSide()}>{mode.hint}</Tooltip>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}, 'ThemeSwitch');

/** Each mode's name, and the hint that says what choosing it does. */
const MODES: Array<{ value: ThemeMode; label: string; hint: string; Icon: ComponentType }> = [
  { value: 'system', label: 'System theme', hint: 'Follow your system', Icon: SystemThemeIcon },
  { value: 'light', label: 'Light theme', hint: 'Always light', Icon: LightModeIcon },
  { value: 'dark', label: 'Dark theme', hint: 'Always dark', Icon: DarkModeIcon },
];
