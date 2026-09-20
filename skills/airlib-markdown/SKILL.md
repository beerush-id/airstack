---
name: airlib-markdown
description: Use when authoring MDX documentation pages, rendering extended markdown with admonitions, tabbed code groups, executable blocks, interactive live demos, badges, or binding route state ($state) in an AirLib project
---

# AirLib Extended Markdown (MDX) Router

The guide for authoring documentation, content-driven routes, and rich prose with embedded reactive components using AirLib Extended Markdown (`.page.mdx` and `.mdx`).

IMPORTANT: Read only what you need. Match your problem or goal to the matrix below, then read only the corresponding topic document in `contents/`. Do not load all files into context.

---

## Markdown Decision Matrix: What are you building?

| What question are you trying to answer? | Topic Guide to Read |
|---|---|
| **"How do I configure frontmatter, connect MDX pages to file routes, access live route state ($state), or import MDX as components?"** | [contents/pages-routes.md](./contents/pages-routes.md) |
| **"How do I write callout boxes (admonitions, GitHub alerts), collapsible content, status badges, or responsive GFM tables?"** | [contents/admonitions-blocks.md](./contents/admonitions-blocks.md) |
| **"How do I create tabbed code blocks (code groups), executable blocks, or live interactive component demos?"** | [contents/code-demos.md](./contents/code-demos.md) |

---

## Symbol & Syntax Lookup

Saw an unfamiliar syntax, directive, or component in an MDX file? Look it up here to find the relevant guide:

| Symbol / Directive Seen in Code | Topic Guide to Read |
|---|---|
| `.page.mdx`, `.mdx`, `$state`, `$context`, `$children`, `nav`, `nav-icon`, `nav-priority`, `keywords` | [contents/pages-routes.md](./contents/pages-routes.md) |
| `:::note`, `:::tip`, `:::info`, `:::warning`, `:::danger`, `:::important`, `:::caution`, `:::details`, `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!CAUTION]`, `> [!IMPORTANT]`, `{collapsible}`, `<Admonition>`, `<NoteBlock>`, `<TipBlock>`, `<WarningBlock>`, `<DangerBlock>`, `:badge[...]`, `<Badge>`, `\| Table \|`, `:---:` | [contents/admonitions-blocks.md](./contents/admonitions-blocks.md) |
| `:::code-group`, ```` ```ts [Title] ````, `executable`, `executable="hidden"`, `module`, `:::interactive`, `{standalone}`, `<CodeGroup>`, `<CodeCopy>` | [contents/code-demos.md](./contents/code-demos.md) |

---

## Questions & Tasks Covered by Each Topic

### [MDX Pages & Route Integration](./contents/pages-routes.md)
Load this topic when you need to answer:
- What is the difference between `page.mdx` (routed page) and `.mdx` (reusable component)?
- How do I set navigation priorities, page titles, and search keywords in YAML frontmatter?
- How do I access live route state (`$state`), current URL (`$context`), or nested outlets (`$children`) in MDX?
- How do I embed reactive primitives (`mutable`, `Show`, `For`) directly in markdown?
- How do I import an `.mdx` file as a pre-compiled, zero-runtime component into a `.tsx` page?

### [Admonitions, Tables & Badges](./contents/admonitions-blocks.md)
Load this topic when you need to answer:
- Which 9 admonition types are supported in AirLib Markdown?
- How do I write callout blocks using either `:::type[Title]` or GitHub alert syntax (`> [!NOTE]`)?
- How do I make callouts or advanced sections collapsible (`{collapsible}`, `:::details`)?
- How do I use programmatic admonition components (`<Admonition>`, `<TipBlock>`, `<DangerBlock>`) in JSX?
- How do I add inline version or status badges (`:badge[...]`, `<Badge>`)?
- How do GFM pipe tables render with column alignment (`:---:`) and automatic horizontal scrolling on mobile?

### [Code Blocks & Interactive Demos](./contents/code-demos.md)
Load this topic when you need to answer:
- How do I add floating file titles and language labels to code fences?
- How do I execute code blocks inline (`executable`, `executable="hidden"`, `module`)?
- How do I create tabbed code blocks across frameworks or package managers (`:::code-group`)?
- How do I build live interactive component demos (`:::interactive`)?
- How do I run component code in a demo while hiding the code fences (`{standalone}`)?
