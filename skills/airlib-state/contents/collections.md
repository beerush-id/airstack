# Large Collections & SuperList

Rendering large data tables, virtualized lists, or real-time data feeds presents recurring architectural challenges:
- **Allocation & GC Churn**: Creating and tearing down row wrappers on rapid scroll triggers garbage collection pauses.
- **Scattered Selection State**: Maintaining separate lookup `Set`s and maps for checkboxes and selections easily gets out of sync when rows are re-ordered or deleted.
- **Index-Destroying Filters**: Running `.filter()` mutates array indexes, breaking selection references and pagination.
- **Continuous Re-sorting**: Sorting an entire dataset on every incoming row takes $O(N \log N)$ time.

`superList` solves these challenges in a single reactive collection by combining fixed-memory slots, automated selection tracking, non-destructive visibility filtering, and automated ordering.

---

## Virtualization with Reusable Reactive Slots

Instead of creating new wrapper objects on every scroll event, `superList` pre-allocates a fixed pool of reactive slots accessed via `.values`.

Each slot provides:
- **`row.value`**: The data item (or `undefined` if slot is empty).
- **`row.visible`**: Boolean indicating whether the row passes active filters.
- **`row.checked`**: Boolean indicating whether the item is selected.

```tsx
import { setup, For, Show, superList } from '@airlib/react'; // or '@airlib/solid'

export interface UserRow {
  id: number;
  name: string;
  department: string;
}

export const VirtualUserTable = setup(() => {
  const users = superList<UserRow>(
    [
      { id: 1, name: 'Alice', department: 'Engineering' },
      { id: 2, name: 'Bob', department: 'Design' },
    ],
    {
      size: 100, // Fixed pool size for virtual rendering
      orderBy: ['name', 'asc'],
    }
  );

  return () => (
    <table className="data-table">
      <tbody>
        <For each={() => users.values}>
          {(row) => (
            <Show when={() => row.value && row.visible}>
              {() => (
                <tr className={row.checked ? 'selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={() => users.toggle(row.value!)}
                    />
                  </td>
                  <td>{row.value?.name}</td>
                  <td>{row.value?.department}</td>
                </tr>
              )}
            </Show>
          )}
        </For>
      </tbody>
    </table>
  );
}, 'VirtualUserTable');
```

---

## Selection Management (`selection`)

Tracking selected items usually requires manual `Set` plumbing. `superList` maintains an integrated, reactive `selection` Set that updates automatically when rows are toggled:

```ts
import { superList } from '@airlib/react'; // or '@airlib/solid'

export const productList = superList([
  { id: 'p1', title: 'Keyboard' },
  { id: 'p2', title: 'Monitor' },
]);

// Select or toggle by index or value
productList.select(0);
productList.toggle(1);

// Reactive selection set — reads total count or inspects selected items
console.log(productList.selection.size); // 2

// Deselect
productList.deselect(0);
console.log(productList.selection.size); // 1
```

NOTE: When a row is deleted or replaced via `delete()` or `assign()`, it is automatically pruned from `selection`, preventing memory leaks and ghost selection bugs.

---

## Filtering Without Index Destruction (`hide` / `show`)

Standard `Array.prototype.filter()` produces a brand new array with mutated indices, breaking selection mapping and scroll offsets.

`superList` allows toggling visibility directly on slots without shifting data positions:

```ts
// Hide a range of rows (e.g. collapsed accordion sections or filtered-out rows)
users.hide(0, 10);

// Restore row visibility
users.show(0, 10);
```

---

## Continuous Automated Ordering (`orderBy`)

When new items are added, `superList` automatically inserts them into their correct sorted position using binary insertion:

```ts
import { superList } from '@airlib/react'; // or '@airlib/solid'

export const leaderboard = superList(
  [
    { id: 1, name: 'Alice', points: 300 },
    { id: 2, name: 'Bob', points: 150 },
  ],
  {
    orderBy: ['points', 'desc'],
  }
);

// Automatically inserted in sorted order without manual re-sorting
leaderboard.add([{ id: 3, name: 'Charlie', points: 450 }]);
```

---

## Collection Mutation API

| Method | Parameters | Concern / Purpose |
|---|---|---|
| `add(items)` | `T[]` | Inserts new items into sorted or indexed positions. |
| `assign(dataset)` | `T[]` | Replaces dataset, resets unused slots, and cleans stale selections. |
| `set(index, item)` | `number, T` | Replaces the item at a specific slot index. |
| `delete(start, count)` | `number, number` | Removes items and cleans up associated selections. |
| `select(target)` | `number \| T` | Marks item or index as selected (`checked = true`). |
| `deselect(target)` | `number \| T` | Unmarks item or index (`checked = false`). |
| `toggle(target)` | `number \| T` | Inverts selection state for item or index. |
| `hide(start, count)` | `number, number` | Marks slots as non-visible (`visible = false`). |
| `show(start, count)` | `number, number` | Restores slot visibility (`visible = true`). |
