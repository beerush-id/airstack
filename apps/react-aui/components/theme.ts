import { cookiePair } from '@airlib/react';

export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * The site's theme choice, kept in a cookie so the server renders the page in it and `index.html`
 * applies it before the first paint. Every caller gets the same pair, so every switch — the
 * header's, the desktop tray's, an answer's — edits this one setting. Deferred, so a static page
 * renders the default and picks the stored choice up on the client.
 *
 * @returns The live setting and its stored copy, as `[theme, stored]`.
 */
export function themeSetting() {
  return cookiePair('aui-docs-theme', { mode: 'system' as ThemeMode }, { deferred: true });
}
