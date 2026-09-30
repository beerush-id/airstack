# Search-Input Specification — Retired

Search is not a separate unit: it is a `kind` of TextInput (`docs/text-input.md:12`), whose distinctive behavior is "`Escape` reverts `value` to the pre-edit state" (`:22`); a custom host compiles `role="searchbox"` (`:42`).

- **Entity alias**: `search-input` → `text-input` with `kind: 'search'`
- **Sheet status**: retired; author against [text-input.md](text-input.md).
