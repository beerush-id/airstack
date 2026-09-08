# Feed Specification

A feed is a scrollable list of articles in which scrolling toward the bottom causes articles to be added to the list. Structured according to the Entity Tree, it consists of a stream orchestrator (`Feed`) and stream entries (`FeedArticle` / `Feed.Article`).

### Composite Parts (Entity Tree)
- **`Feed`**: Stream container (compiles WAI-ARIA `role="feed"`)
- **`FeedArticle` (`Feed.Article`, `role: 'feed-article'`)**: Stream article entry (compiles WAI-ARIA `role="article"`)

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Feed`** | Generic structural container (`<div>` or `<section>`). HTML has no native feed element; `role="feed"` must always be explicitly declared. | `role="feed"`, `aria-label` / `aria-labelledby`, `aria-busy` (`"true"` during data fetch). | Infinite stream container; tracks active article focus across dynamic DOM additions. Props: `FeedProps`. |
| **`FeedArticle` (`Feed.Article`)** | Native `<article>` element (or generic container). | `role="article"` (omitted if native `<article>`), `aria-posinset`, `aria-setsize` (`-1` or total count), `aria-labelledby`. | Individual stream entry; receives PageUp/PageDown navigation. Options: `FeedArticleOptions`. Props: `FeedArticleProps`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `FeedProps`
```ts
export interface FeedProps {
  /** Optional DOM element identifier */
  id?: string;
  /** Accessible label */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
  /** Indicates whether the feed is currently loading new articles (`aria-busy="true"`) */
  busy?: boolean;
}
```

#### `FeedArticleOptions`
```ts
export interface FeedArticleOptions {
  /** Whether bound to native <article> element (default: true) */
  native?: boolean;
}
```

#### `FeedArticleProps`
```ts
export interface FeedArticleProps {
  /** 1-based position within the feed */
  posinset?: number;
  /** Total count of articles, or -1 if unknown */
  setsize?: number;
}
```

### 2. Overload Contracts

```ts
// Feed: Infinite stream container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'feed',
  props?: FeedProps
): FeedAria<E>;

// FeedArticle: Stream article entry
export function aria<E extends BaseElement = HTMLElement>(
  role: 'feed-article',
  props?: FeedArticleProps,
  options?: FeedArticleOptions
): FeedArticleAria<E>;
```

---

## State & Lifecycle Rules

1. **Position Assignment**:
   - The `Feed` parent computes `aria-posinset` / `aria-setsize` for its articles (1-based; `setsize` is `-1` while the total is unknown).
   - Article-level `posinset` / `setsize` props override the parent computation when set.

2. **Keyboard Navigation**:
   - `PageDown`: Moves focus to next article.
   - `PageUp`: Moves focus to previous article.
   - `Ctrl+Home`: Moves focus to first article.
   - `Ctrl+End`: Moves focus to last article.

3. **Dynamic Insertion Focus Preservation**:
   - Focus is never lost when new articles are prepended or appended to the feed.
