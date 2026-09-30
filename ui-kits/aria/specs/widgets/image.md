# Image Specification

The image loading and fallback coordination unit. Supplies loading state and accessible image semantics for native or
custom image content, including avatar use cases, without prescribing visual presentation.

- **Entity**: `image`
- **WAI-ARIA Role**: `img` (on custom hosts and fallbacks; omitted on native `<img>`)

### Parts

- **`Image`**: Container coordinator hosting ambient source and status state (`idle`, `loading`, `loaded`, `error`).
- **`ImageContent`**: Visual image element (native `<img>` or custom host).
- **`ImageFallback`**: Fallback representation element (`role="img"`/`aria-label` when active & nondecorative, else
  `aria-hidden="true"`; accessibility-exposed during `idle`, `loading`, and `error`).

---

## The Three Semantic Layers

| Part / Role         | HTML Semantic                           | WAI-ARIA Semantic                                                                                                                                                                                                                     | Aria Package Semantic Contract                                                                                                                                                               |
|:--------------------|:----------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **`Image`**         | Layout container (`<div>` or `<span>`). | None.                                                                                                                                                                                                                                 | Hosts `src`, `alt`, and `status`. Coordinates lifecycle.                                                                                                                                     |
| **`ImageContent`**  | Native `<img>` or custom host.          | Native `<img>` loaded: native semantics + `alt`, no redundant role/`aria-label`; `aria-hidden="true"` when inactive or decorative. Custom host: `role="img"` + `aria-label` when loaded and nondecorative, else `aria-hidden="true"`. | Exposes the loaded representation; excluded from accessibility while inactive. Visual hiding must still keep the native `<img>` loading-eligible.                                            |
| **`ImageFallback`** | Fallback container (`<div>`).           | `role="img"` + `aria-label` (shared `alt`) when **active and nondecorative**; `aria-hidden="true"` otherwise.                                                                                                                         | Accessibility-exposed during `idle`, `loading`, and `error` (not "visually shown" — the source's mechanism is AT exclusion, `docs/image.md:33,37,64-66`). Noninteractive; not a live region. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ImageProps`

```ts
export interface ImageProps {
  /** Image source URL */
  src?: string;
  /** Alternative text (empty string indicates decorative) */
  alt: string;
  /** Active source lifecycle (default: idle without a source, loading with one). Reports the lifecycle; NOT an author command that forces a loading result (docs/image.md:13-15). */
  status?: 'idle' | 'loading' | 'loaded' | 'error';
}
```

### 2. Overload Contracts

```ts
// Image: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'image',
  props: ImageProps
): ImageAria<E>;

// ImageContent
export function aria<E extends BaseElement = HTMLElement>(
  role: 'image-content',
  props?: AriaProps
): ImageContentAria<E>;

// ImageFallback
export function aria<E extends BaseElement = HTMLElement>(
  role: 'image-fallback',
  props?: AriaProps
): ImageFallbackAria<E>;
```

---

## State & Lifecycle Rules

1. **Lifecycle Flow**:
  - Absent `src` commits `idle`; a new `src` commits `loading` before any result is accepted, then `loaded` (success) or
    `error` (failure). Cached/settled images are observed on mount and settle through `loading` → `loaded`/`error`.
  - `status` **reports** the lifecycle; it is not an author command (`docs/image.md:15`). Only results belonging to the
    current source lifecycle may update state, visibility, or accessible semantics (`:24`) — every source change
    invalidates older async results (even a change away and back to the same URL).
  - The loader is the unit's own: native `<img>` is the real loader; custom ImageContent uses a unit-owned native image
    loader. Hand-pushing `status` in proofs exercises a non-command prop as a command.
2. **Accessibility Presentation**:
  - Exposes exactly one accessible image representation: fallback before success, content after success.
  - `alt=""` excludes both from accessibility tree.
3. **Events**:
  - `change` — Dispatched on Image container after `status` commits as
    `CustomEvent<'idle' | 'loading' | 'loaded' | 'error'>('change', { bubbles: true, detail: status })`.
