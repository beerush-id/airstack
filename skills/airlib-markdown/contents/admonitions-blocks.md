# Admonitions & Badges

AirLib Extended Markdown provides built-in callouts (admonitions), collapsible content blocks, and inline badges to structure documentation and highlight critical information.

---

## Admonitions & Callouts Syntax

AirLib Extended Markdown supports both triple-colon directive syntax and GitHub-style alert callouts:

### Triple-Colon Directive Syntax
```mdx
:::note[General Information]
Notes provide supplementary context and non-urgent background details.
:::

:::tip[Best Practice]
Tips highlight recommended patterns and keyboard shortcuts that save time.
:::

:::warning[Important Constraint]
Warnings alert readers to potential misconfigurations or runtime surprises.
:::

:::danger[Breaking Change]
Danger blocks warn of breaking changes, security risks, or data loss.
:::
```

### GitHub Alert Syntax
```mdx
> [!NOTE]
> General information or supplementary context.

> [!TIP]
> Recommended practices and performance shortcuts.

> [!WARNING]
> Deprecations and potential runtime hazards.

> [!CAUTION]
> Edge cases requiring careful implementation.

> [!IMPORTANT]
> Critical architecture requirements that must not be skipped.
```

---

## Available Admonition Types

| Type | Default Title | Intended Use Case |
|---|---|---|
| `note` | Note | General information or neutral context. |
| `tip` | Tip | Recommended practices, shortcuts, performance tips. |
| `info` | Info | Supplementary reference details. |
| `warning` | Warning | Deprecations, subtle gotchas, or runtime hazards. |
| `danger` | Danger | Breaking changes, irreversible operations, security alerts. |
| `important` | Important | Critical architecture requirements that must not be skipped. |
| `caution` | Caution | Edge cases requiring careful implementation. |
| `details` | Details | Collapsible sections hidden by default. |
| `interactive` | Live Demo | Interactive runnable component preview. |

---

## Collapsible Admonitions

Add the `{collapsible}` attribute to allow readers to expand or collapse long explanations on demand:

```mdx
:::note[Click to expand advanced configuration]{collapsible}
Detailed environment variable setup that most developers can safely skip.
:::
```

The `details` type is collapsible by default and renders as a native HTML `<details>` element:

```mdx
:::details[Advanced Transport Flags]
Deep technical options for custom WebSocket backoff intervals.
:::
```

---

## Programmatic JSX Components

For dynamic views or programmatic assembly in `.tsx` files or MDX templates, import admonition components from `@airlib/react/mdx` or `@airlib/solid/mdx`:

```tsx
import { Admonition, DangerBlock, NoteBlock, TipBlock, WarningBlock } from '@airlib/react/mdx';

// Generic component with type prop
<Admonition type="tip" title="Pro Tip">
  Use route colocation to keep procedures next to views.
</Admonition>

// Named shorthand blocks
<TipBlock title="Refactor Safe">
  Always navigate using route objects.
</TipBlock>

<WarningBlock title="Deprecated Method">
  This method will be removed in v3.0.
</WarningBlock>
```

---

## Status & Version Badges

Badges display concise status, version, or category markers inline with prose:

### Markdown Syntax
```mdx
The `createRouter()` API :badge[v2.0]{variant="neutral"} replaces legacy router declarations.
```

### JSX Component
```tsx
import { Badge } from '@airlib/react/mdx';

<Badge variant="tip" text="Stable" />
<Badge variant="info" text="New" />
<Badge variant="warning" text="Deprecated" />
<Badge variant="danger" text="Breaking" />
<Badge variant="neutral" text="v2.1.0" />
```

| Variant | Purpose |
|---|---|
| `tip` | Stable, recommended, production-ready. |
| `info` | New additions, upcoming capabilities. |
| `warning` | Deprecated, scheduled for modification. |
| `danger` | Breaking changes, removals. |
| `neutral` | Semantic version numbers, tags, categories. |

---

## Tables & GitHub Flavored Markdown (GFM)

AirLib Extended Markdown natively renders GitHub Flavored Markdown (GFM) tables with automatic responsive behavior and alternating row backgrounds:

### Pipe Table Syntax

```mdx
| Option | Type | Default | Description |
|:---|:---:|---:|:---|
| `ssg` | `boolean` | `false` | Enable static site generation. |
| `image` | `boolean` | `true` | Enable responsive image optimization. |
| `markdown` | `boolean` | `true` | Enable MDX page and route compilation. |
```

### Table Features
- **Responsive Wrapper**: Tables are automatically wrapped in a container that allows smooth horizontal scrolling on mobile viewports without overflowing page layouts.
- **Column Alignment**: Standard GFM alignment markers (`:---` for left, `:---:` for center, `---:` for right) control text alignment across headers and body cells.
- **Alternating Rows**: Rows automatically feature alternating background shading to maximize legibility for wide datasets.

### Additional GFM Features
- **Task Lists**: `- [x] Completed task` and `- [ ] Pending task`
- **Strikethrough**: `~~deprecated parameter~~`
- **Autolinks**: Bare URLs (e.g. `https://beerush.io`) automatically convert into clickable anchors.
