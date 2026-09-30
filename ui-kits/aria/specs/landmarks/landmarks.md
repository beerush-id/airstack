# Landmarks Overview

Landmarks divide a page layout into perceptible, navigable sections (`banner`, `main`, `navigation`, `complementary`,
`contentinfo`, `search`, `form`, `region`), enabling assistive technologies to skip repetitive content and jump directly
to key landmarks.

---

## The Three Semantic Layers

| Role                | HTML Semantic                                            | WAI-ARIA Semantic                                     | Aria Package Semantic Contract                                                            |
|:--------------------|:---------------------------------------------------------|:------------------------------------------------------|:------------------------------------------------------------------------------------------|
| **`banner`**        | Primary document header (`<header>` scoped to `<body>`). | `role="banner"` (omitted if native `<header>`).       | Static structural landmark. Max 1 per page.                                               |
| **`main`**          | Primary unique content (`<main>`).                       | `role="main"` (omitted if native `<main>`).           | Primary landmark. Skips repeated navigation directly to main content. Exactly 1 per page. |
| **`navigation`**    | Navigation menu/links collection (`<nav>`).              | `role="navigation"` (omitted if native `<nav>`).      | Navigation landmark. Requires accessible name if multiple exist on the same page.         |
| **`complementary`** | Supporting sidebar / aside (`<aside>`).                  | `role="complementary"` (omitted if native `<aside>`). | Supporting landmark.                                                                      |
| **`contentinfo`**   | Primary document footer (`<footer>` scoped to `<body>`). | `role="contentinfo"` (omitted if native `<footer>`).  | Footer landmark. Max 1 per page.                                                          |
| **`search`**        | Search area (`<search>` or `<form role="search">`).      | `role="search"`.                                      | Identifies site search feature.                                                           |
| **`form`**          | Significant form area (`<form aria-label="...">`).       | `role="form"`.                                        | Requires accessible label to be exposed as a landmark.                                    |
| **`region`**        | Generic named section (`<section aria-label="...">`).    | `role="region"`.                                      | **Must** have accessible label (`aria-label` or `aria-labelledby`) to be a landmark.      |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `LandmarkOptions`

```ts
export interface LandmarkOptions {
  /** Whether bound to matching native HTML5 tag (default: true) */
  native?: boolean;
}
```

#### `LandmarkProps`

```ts
export interface LandmarkProps {
  /** Accessible label (required for multiple navs, form, and region) */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

---

## State & Lifecycle Rules

1. **Label Compilation**:
  - `label` compiles to `aria-label`; `labelledby` compiles to `aria-labelledby`.

2. **Native Optimization**:
  - When `native: true`, matching HTML5 elements (`<main>`, `<nav>`, `<aside>`, etc.) omit explicit `role` attributes.
  - For non-native tags (`<div>`), `role` is compiled into `.attributes`.

3. **Mandatory Labeling Rules**:
  - `region` and `form` only become landmarks if an accessible name is provided via `label` or `labelledby`.
