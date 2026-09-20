# Declarative Browser Signals

This guide covers AirLib's reactive browser utilities—wrapping DOM events into fine-grained reactive state without manual `addEventListener`, `removeEventListener`, or memory leaks.

---

## 1. Activation & Hydration (`acceptInteractions`)

To prevent dangling listeners and guarantee safe Server-Side Rendering (SSR), browser utilities defer internal event listeners until hydration completes.

In your client entry file (e.g. `main.tsx`), call `acceptInteractions()` after hydration:

### React Entry Point

```tsx
import { hydrateRoot } from 'react-dom/client';
import { acceptInteractions } from '@airlib/react/browser';
import App from './App.js';

hydrateRoot(document.getElementById('root')!, <App />);
acceptInteractions(); // Activates reactive browser event tracking
```

### SolidJS Entry Point

```tsx
import { hydrate } from 'solid-js/web';
import { acceptInteractions } from '@airlib/solid/browser';
import App from './App.js';

hydrate(() => <App />, document.getElementById('root')!);
acceptInteractions(); // Activates reactive browser event tracking
```

---

## 2. Keyboard & Shortcuts (`LIVE_KEYBOARD`, `keyboardRef`)

### Global Shortcuts (`LIVE_KEYBOARD`)

`LIVE_KEYBOARD` monitors active document key presses and modifier combinations:

- **`key`**: Primary key currently pressed (`'Escape'`, `'Enter'`, `'a'`).
- **`modifiers`**: `Set` of active modifier keys (`'ctrl'`, `'meta'`, `'alt'`, `'shift'`).
- **`is(...keys)`**: Returns `true` if all specified keys/modifiers are active simultaneously.

```tsx
import { setup, effect, mutable } from '@airlib/react'; // or '@airlib/solid'
import { LIVE_KEYBOARD } from '@airlib/react/browser'; // or '@airlib/solid/browser'

export const CommandPalette = setup(() => {
  const state = mutable({ open: false });

  effect(() => {
    // Listens for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
    if (LIVE_KEYBOARD.is('meta', 'k') || LIVE_KEYBOARD.is('ctrl', 'k')) {
      state.open = !state.open;
    }
    // Closes on Escape
    if (LIVE_KEYBOARD.is('Escape')) {
      state.open = false;
    }
  });

  return () => state.open ? <div className="palette">Search...</div> : null;
}, 'CommandPalette');
```

### Scoped Input Keyboard (`keyboardRef`)

When monitoring keystrokes on a specific `<input>` or textarea rather than the whole window, use `keyboardRef`:

```tsx
import { setup } from '@airlib/react';
import { keyboardRef } from '@airlib/react/browser';

export const SearchInput = setup(() => {
  const inputKeys = keyboardRef();

  return () => (
    <div>
      <input ref={inputKeys} placeholder="Type query..." />
      <p>Last key: {inputKeys.key}</p>
    </div>
  );
}, 'SearchInput');
```

---

## 3. Pointer & Cursor (`LIVE_CURSOR`, `cursorRef`)

### Global Cursor (`LIVE_CURSOR`)

Tracks pointer coordinates, device type, mouse button, and active modifiers:

- **`x`, `y`**: Viewport coordinates.
- **`pageX`, `pageY`**: Document coordinates.
- **`type`**: Input device (`'mouse'`, `'touch'`, `'pen'`).
- **`button`**: Active button (`'left'`, `'right'`, `'middle'`).
- **`modifiers`**: `Set` of active modifiers (`'shift'`, `'ctrl'`, `'alt'`, `'meta'`).

```tsx
import { Show } from '@airlib/react';
import { LIVE_CURSOR } from '@airlib/react/browser';

<Show when={() => LIVE_CURSOR.x && LIVE_CURSOR}>
  {({ x, y, type, button }) => (
    <div className="cursor-debugger">
      Pointer: {x}, {y} ({type}) — Button: {button ?? 'none'}
    </div>
  )}
</Show>
```

### Scoped Element Cursor (`cursorRef`)

Tracks pointer coordinates relative to a target element (e.g. canvas, interactive card):

```tsx
import { setup } from '@airlib/react';
import { cursorRef } from '@airlib/react/browser';

export const DrawingCanvas = setup(() => {
  const canvasCursor = cursorRef();

  return () => (
    <div ref={canvasCursor} className="canvas-box">
      Offset: {canvasCursor.x}, {canvasCursor.y}
    </div>
  );
}, 'DrawingCanvas');
```

---

## 4. Scroll Tracking (`LIVE_SCROLL`, `scrollRef`)

### Global Window Scroll (`LIVE_SCROLL`)

Tracks window-level scrolling offsets and direction without layout thrashing:

- **`x`, `y`**: Scroll pixel coordinates.
- **`direction`**: Direction (`'up'`, `'down'`, `'left'`, `'right'`, `'none'`).
- **`isScrolling`**: Transient boolean (`true` while actively scrolling, returns `false` on pause).

```tsx
import { Show } from '@airlib/react'; // or '@airlib/solid'
import { LIVE_SCROLL } from '@airlib/react/browser';

{/* Conditionally renders back-to-top button when user scrolls down */}
<Show when={() => LIVE_SCROLL.y > 400}>
  <button className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
    Back to Top
  </button>
</Show>
```

### Scoped Container Scroll (`scrollRef`)

For scrollable sidebars, modal content, or virtualized lists:

```tsx
import { setup } from '@airlib/react';
import { scrollRef } from '@airlib/react/browser';

export const ScrollableContainer = setup(() => {
  const containerScroll = scrollRef();

  return () => (
    <div ref={containerScroll} className="overflow-y-auto h-64">
      <div className="sticky top-0">Scrolled: {containerScroll.y}px</div>
      <div className="h-[1000px]">Content</div>
    </div>
  );
}, 'ScrollableContainer');
```

---

## 5. Text Selection & Overlays (`LIVE_SELECTION`)

Captures document text selection reactively:

- **`text`**: Raw string text of the selection.
- **`size`**: Character count.
- **`rect`**: Single `DOMRect` bounding box of the entire selection.
- **`rects`**: Array of `DOMRect` objects per line (for multi-line selections).
- **`paths(padding, radius)`**: Generates an SVG path string (`d="..."`) conforming precisely to multi-line selection lines.

```tsx
import { Show } from '@airlib/react';
import { LIVE_SELECTION } from '@airlib/react/browser';

<Show when={() => LIVE_SELECTION.rect && LIVE_SELECTION}>
  {({ rect, paths, size }) => (
    <svg
      className="fixed pointer-events-none"
      width={rect.width + 16}
      height={rect.height + 16}
      style={{ top: `${rect.y - 8}px`, left: `${rect.x - 8}px` }}
    >
      <path d={paths(6, 8)} fill="rgba(59, 130, 246, 0.2)" />
    </svg>
  )}
</Show>
```

---

## 6. Drag & Drop (`LIVE_DND`)

Provides declarative registration for draggable items and drop zones with reactive status:

- **`isDragging`**: Boolean indicating active drag.
- **`x`, `y`**, **`deltaX`, `deltaY`**: Current coordinates and distance moved.
- **`payload`**: Active payload data (`{ type, data, text, files }`).
- **`draggable(el, state)`**: Registers an element as draggable.
- **`droppable(...els)`**: Registers drop zones.

```tsx
import { Show } from '@airlib/react';
import { LIVE_DND } from '@airlib/react/browser';

export function KanbanCard() {
  return (
    <div className="card-container">
      {/* Draggable handle */}
      <div
        ref={(el) => LIVE_DND.draggable(el, { data: { id: 'task-1', title: 'Refactor UI' } })}
        className="draggable-card"
      >
        Refactor UI
      </div>

      {/* Floating Drag Preview */}
      <Show when={() => LIVE_DND.isDragging && LIVE_DND}>
        {({ x, y, payload }) => (
          <div
            className="fixed pointer-events-none bg-blue-600 text-white px-2 py-1 rounded"
            style={{ top: `${y}px`, left: `${x}px` }}
          >
            Dragging: {payload.data?.title}
          </div>
        )}
      </Show>

      {/* Drop Zone */}
      <div
        ref={(el) => LIVE_DND.droppable(el)}
        className={LIVE_DND.isDragging ? 'drop-target active' : 'drop-target'}
      >
        Drop here
      </div>
    </div>
  );
}
```

---

## 7. Media Queries & Viewport (`LIVE_MEDIA`, `mediaQuery`)

Reactive flags for responsive design and user preferences without manual `window.matchMedia`:

- **Breakpoints**: `isMobile` (`< 640px`), `isTablet` (`640-1023px`), `isDesktop` (`>= 1024px`).
- **Preferences**: `isDark`, `isLight`, `isReducedMotion`, `isHighContrast`.
- **Capabilities**: `isTouch` (`pointer: coarse`), `isHover` (`hover: hover`), `isRetina` (`>= 2dppx`).
- **Orientation**: `isLandscape`, `isPortrait`.
- **Custom queries**: `const isWide = mediaQuery('(min-width: 1400px)');`

WARNING: **Hydration Boundary: Never Branch Initial Structural Markup in JS**
Do **NOT** use `LIVE_MEDIA.isMobile` to conditionally render different HTML structures on initial render (e.g. `<Show when={() => LIVE_MEDIA.isMobile} fallback={<DesktopNav />}>`).
Because the server cannot predict client viewport dimensions, SSR produces the default branch, resulting in an immediate **SSR hydration mismatch** on mobile clients.
- **Structural Layout**: Always use **CSS media queries** (`@media` or responsive classes). CSS renders consistently on the server and client with zero layout shifts.
- **`LIVE_MEDIA` in JS**: Use strictly for **behavioral adaptation**, post-hydration logic, or non-structural capabilities (e.g. adapting animation loops, canvas pixel ratios, or interaction modes).

### Example: Behavioral Adaptation (`isReducedMotion`)

```tsx
import { setup, effect } from '@airlib/react'; // or '@airlib/solid'
import { LIVE_MEDIA } from '@airlib/react/browser';

export const AnimatedHero = setup(() => {
  effect(() => {
    // Adapt runtime behavior to accessibility preferences
    if (LIVE_MEDIA.isReducedMotion) {
      pauseBackgroundSimulation();
    } else {
      resumeBackgroundSimulation();
    }
  });

  return () => (
    <div className="hero-container">
      <h1>Dynamic Experience</h1>
      <canvas className="hero-canvas" />
    </div>
  );
}, 'AnimatedHero');
```

---

## 8. Window Lifecycle & Inactivity (`LIVE_WINDOW`)

Monitors viewport dimensions, tab visibility, and user idle timeouts:

- **`width`, `height`**: Current window inner dimensions.
- **`isVisible`**: Document visibility (`!document.hidden`).
- **`isFocused`**: Document focus state (`document.hasFocus()`).
- **`isIdle`**: Returns `true` if user has been inactive longer than timeout.
- **`lastActive`**: Timestamp of last user input (mouse, key, scroll, touch).
- **`setIdleTimeout(minutes)`**: Sets the inactivity threshold.

```tsx
import { Show } from '@airlib/react';
import { LIVE_WINDOW } from '@airlib/react/browser';

LIVE_WINDOW.setIdleTimeout(5); // 5 minutes inactivity threshold

<Show when={() => LIVE_WINDOW.isIdle && LIVE_WINDOW}>
  {({ lastActive }) => (
    <div className="idle-lock-modal">
      Session paused due to inactivity since {new Date(lastActive).toLocaleTimeString()}
    </div>
  )}
</Show>
```

---

## 9. Network Status (`LIVE_NETWORK`)

Tracks connection status and Network Information API metrics:

- **`isOnline`**: `true` when online.
- **`effectiveType`**: Speed class (`'4g'`, `'3g'`, `'2g'`, `'slow-2g'`).
- **`downlink`**: Bandwidth estimate in Mbps.
- **`rtt`**: Round-trip time in milliseconds.

```tsx
import { Show } from '@airlib/react';
import { LIVE_NETWORK } from '@airlib/react/browser';

<Show when={() => !LIVE_NETWORK.isOnline && LIVE_NETWORK}>
  {({ effectiveType }) => (
    <div className="offline-banner">
      Offline mode active ({effectiveType}). Updates will sync automatically on reconnection.
    </div>
  )}
</Show>
```

---

## 10. Clipboard (`LIVE_CLIPBOARD`)

Reads and writes clipboard payloads asynchronously:

- **`text`**: Most recently copied or pasted string.
- **`data`**: Parsed JSON object if clipboard text is valid JSON.
- **`files`**: Pasted array of `File` objects.
- **`copy(payload)`**: Writes text or JSON to clipboard (`Promise<boolean>`).
- **`take(slot, handler)`**: Registers a callback for pasted `'text'`, `'data'`, or `'files'`.

```tsx
import { LIVE_CLIPBOARD } from '@airlib/react/browser';

async function copyShareLink(url: string) {
  const success = await LIVE_CLIPBOARD.copy(url);
  if (success) {
    console.log('Copied to clipboard');
  }
}
```
