# Image Specification

The image loading and fallback coordination unit. Supplies loading state and accessible image semantics for native or custom image content, including avatar use cases, without prescribing visual presentation.

- **Entity**: `image`
- **WAI-ARIA Role**: `img` (on custom hosts and fallbacks; omitted on native `<img>`)

### Parts
- **`Image`**: Container coordinator hosting ambient source and status state (`idle`, `loading`, `loaded`, `error`).
- **`ImageContent`**: Visual image element (native `<img>` or custom host).
- **`ImageFallback`**: Fallback presentation element (`role="img"`, `aria-label`, visible during `idle`, `loading`, and `error`).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Image`** | Layout container (`<div>` or `<span>`). | None. | Hosts `src`, `alt`, and `status`. Coordinates lifecycle. |
| **`ImageContent`** | Native `<img>` or custom host. | Native image semantics on `<img>`. `role="img"` on custom element when loaded. | Exposes loaded image representation. |
| **`ImageFallback`** | Fallback container (`<div>`). | `role="img"` with `aria-label="[alt]"` when active and nondecorative. | Shown during `idle`, `loading`, and `error`. |

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
  /** Active source lifecycle state */
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
   - `src` present &rarr; transitions to `loading`, then `loaded` or `error`.
   - `src` absent &rarr; `idle`.
   - Caching: observes settled native images upon mount.
2. **Accessibility Presentation**:
   - Exposes exactly one accessible image representation: fallback before success, content after success.
   - `alt=""` excludes both from accessibility tree.
3. **Events**:
   - `change` — Dispatched on Image container after `status` commits as `CustomEvent<'idle' | 'loading' | 'loaded' | 'error'>('change', { bubbles: true, detail: status })`.
