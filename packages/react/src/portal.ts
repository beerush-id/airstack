import { isBrowser } from '@airlib/core';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { shadowRoot } from '@airlib/core/browser';

export interface Teleporter {
  /**
   * Renders the provided content into a different part of the DOM (portal) if running in a browser environment.
   * If running on the server, it simply returns the content directly without portaling.
   *
   * @param content - The React node(s) to render.
   * @param target - An optional DOM Element or a CSS selector string indicating where to mount the portal. Defaults to `document.body`.
   * @returns The portaled content if in a browser environment, otherwise the original content.
   */
  (content: ReactNode, target?: string | Element): ReactNode;

  /**
   * Renders the provided content into a different part of the DOM (portal) if running in a browser environment.
   * If running on the server, it simply returns the content directly without portaling.
   *
   * @param id - The ID of the element to portal into.
   * @param content - The React node(s) to render.
   * @returns The portaled content if in a browser environment, otherwise the original content.
   */
  as: (id: string, content: ReactNode) => ReactNode;
}

/**
 * Renders the provided content into a different part of the DOM (portal) if running in a browser environment.
 * If running on the server, it simply returns the content directly without portaling.
 *
 * @param content - The React node(s) to render.
 * @param target - An optional DOM Element or a CSS selector string indicating where to mount the portal. Defaults to `document.body`.
 * @returns The portaled content if in a browser environment, otherwise the original content.
 */
function teleportFn(content: ReactNode, target?: string | Element) {
  if (!isBrowser()) return content;
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  return createPortal(content, container ?? document.body);
}

/**
 * Renders the provided content into a different part of the DOM (portal) if running in a browser environment.
 * If running on the server, it simply returns the content directly without portaling.
 *
 * @param id - The ID of the element to portal into.
 * @param content - The React node(s) to render.
 * @returns The portaled content if in a browser environment, otherwise the original content.
 */
teleportFn.as = (id: string, content: ReactNode) => {
  if (!isBrowser()) return content;
  const container = document.getElementById(id) ?? document.createElement('div');
  container.id = id;
  document.body.appendChild(container);
  return createPortal(content, container);
};

export const teleport = teleportFn as Teleporter;

/**
 * Creates a shadow portal.
 * @param condition - The condition to determine if the content should be portaled or not.
 * @param target - An optional DOM Element or a CSS selector string indicating where to mount the portal. Defaults to `document.body`.
 * @returns A function that takes React node(s) to render.
 */
export function shadowPortal(condition: () => boolean, target?: string | Element) {
  const SHADOW_ROOT = shadowRoot()!;

  return (content: ReactNode) => {
    const inShadow = !condition();
    const mountElm = inShadow ? SHADOW_ROOT : target;
    return teleport(content, mountElm);
  };
}
