# Session Storage

This guide establishes the conventions for managing transient, tab-isolated state using `session()` from `@airlib/storage`.

---

## Transient Tab-Scoped State

The `session()` function creates a reactive object synchronized with browser `sessionStorage`. Data persists across page navigations and refreshes within the same tab, but is completely cleared when the tab or browser window is closed:

```typescript
import { session } from '@airlib/storage';

export const formDraft = session('contact-draft', {
  name: '',
  email: '',
  message: '',
});

// Mutate directly—persists across navigation within the active tab
formDraft.name = 'Alice';
formDraft.email = 'alice@example.com';
```

---

## Naming Conventions & Versioning

Like persistent storage, session storage supports schema versioning and automatic cleanup of prior keys:

```typescript
// Simple key
const cart = session('cart-items', { items: [] });

// Versioned key with cleanup of previous release
const wizardState = session('checkout-wizard@2.0.0:1.0.0', {
  step: 1,
  address: null,
});
```

---

## UI Component Integration

Use session stores directly in components to retain user inputs while navigating:

#### React
```tsx
import { setup } from '@airlib/react';
import { session } from '@airlib/storage';

const draftState = session('feedback-draft@1.0.0', { comment: '' });

export const FeedbackBox = setup(() => {
  const updateComment = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    draftState.comment = e.target.value;
  };

  return () => (
    <div>
      <textarea value={draftState.comment} onInput={updateComment} />
      <span>Characters: {draftState.comment.length}</span>
    </div>
  );
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { session } from '@airlib/storage';

const draftState = session('feedback-draft@1.0.0', { comment: '' });

export const FeedbackBox = setup(() => {
  const updateComment = (e: InputEvent & { currentTarget: HTMLTextAreaElement }) => {
    draftState.comment = e.currentTarget.value;
  };

  return () => (
    <div>
      <textarea value={draftState.comment} onInput={updateComment} />
      <span>Characters: {draftState.comment.length}</span>
    </div>
  );
});
```

---

## Lifecycle & Teardown (`session.leave`)

When a component unmounts or a temporary workflow finishes, call `session.leave()` to disconnect storage listeners:

```typescript
import { session } from '@airlib/storage';

const searchFilters = session('active-filters', { category: 'all' });

// Clear listener upon completion
session.leave(searchFilters);
```

---

## Architectural Considerations

- **Tab Isolation**: Each browser tab maintains its own isolated `sessionStorage` instance. Changes made in one tab do not affect other tabs.
- **Ideal Use Cases**: Wizard progress, unsubmitted form drafts, transient filters, and active modal steps.
- **Capacity**: Limited to ~5–10MB per origin. For large binary data or complex offline datasets, use [IndexedDB Tables](./indexed-tables.md).
