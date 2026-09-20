# IndexedDB Structured Tables

This guide establishes the conventions for managing structured client-side relational tables, secondary indexes, and query pagination using `createTable` from `@airlib/storage/db`.

---

## 1. Defining Structured Tables

Use `createTable` to create a reactive, indexed table in IndexedDB. Specify field indexes to optimize search and filter operations:

```typescript
import { createTable } from '@airlib/storage/db';

type Product = {
  name: string;
  category: string;
  price: number;
};

type ProductRow = Product & {
  id: string;
  created_at: Date;
  updated_at: Date;
};

// Create table with secondary indexes on 'category' and 'price'
export const productTable = createTable<Product, ProductRow>(
  'products',
  1,
  ['category', 'price']
);
```

---

## 2. CRUD Operations

All table mutations update in-memory reactive state optimistically and flush to IndexedDB in the background. Use `table.promise()` when sequential execution must await database confirmation:

### Adding Records
```typescript
const newProduct = productTable.add({
  name: 'Mechanical Keyboard',
  category: 'Electronics',
  price: 120,
});

// Await disk write completion
await productTable.promise(newProduct);
console.log('Created ID:', newProduct.data.id);
```

### Retrieving and Updating Records
```typescript
const item = productTable.get(productId);
await productTable.promise(item);

// Update properties directly on reactive row data
item.data.price = 99;
```

### Deleting Records
```typescript
const removed = productTable.remove(productId);
await productTable.promise(removed);
```

### Memory Management (`table.leave`)
Decrement reference counts and release cached reactive row instances when unmounting:
```typescript
// Release cached row by ID
productTable.leave(productId);
```

---

## 3. Querying & Index Searching

### List All Records
```typescript
const allProducts = productTable.list(undefined, 25);
await productTable.promise(allProducts);

console.log(`Loaded ${allProducts.data.length} of ${allProducts.count} items`);
```

### Filtering with Predicate Functions
```typescript
const cheapProducts = productTable.list(
  (product) => product.data.price < 50,
  10
);
await productTable.promise(cheapProducts);
```

### Querying by Secondary Index (`IDBKeyRange`)
Use `listByIndex` with native `IDBKeyRange` for $O(\log N)$ performance on indexed fields:

```typescript
// Exact index match
const electronics = productTable.listByIndex(
  'category',
  IDBKeyRange.only('Electronics')
);
await productTable.promise(electronics);

// Range query on indexed numbers
const highEnd = productTable.listByIndex(
  'price',
  IDBKeyRange.lowerBound(100) // price >= 100
);
await productTable.promise(highEnd);
```

---

## 4. UI Component Integration

Because `RowListState` is reactive, UI lists update automatically when records are added or removed:

#### React
```tsx
import { setup, onMount, For } from '@airlib/react';
import { productTable } from './db.js';

export const ProductCatalog = setup(() => {
  const products = productTable.list(undefined, 20);

  onMount(async () => {
    await productTable.promise(products);
  });

  const addItem = () => {
    productTable.add({
      name: 'Wireless Mouse',
      category: 'Electronics',
      price: 45,
    });
  };

  return () => (
    <div>
      <button type="button" onClick={addItem}>Add Product</button>
      <span>Total: {products.count}</span>

      <ul>
        <For each={() => products.data}>
          {(item) => (
            <li key={item.id}>
              {item.name} — ${item.price}
            </li>
          )}
        </For>
      </ul>
    </div>
  );
});
```

#### SolidJS
```tsx
import { setup, onMount, For } from '@airlib/solid';
import { productTable } from './db.js';

export const ProductCatalog = setup(() => {
  const products = productTable.list(undefined, 20);

  onMount(async () => {
    await productTable.promise(products);
  });

  const addItem = () => {
    productTable.add({
      name: 'Wireless Mouse',
      category: 'Electronics',
      price: 45,
    });
  };

  return () => (
    <div>
      <button type="button" onClick={addItem}>Add Product</button>
      <span>Total: {products.count}</span>

      <ul>
        <For each={products.data}>
          {(item) => (
            <li>
              {item.name} — ${item.price}
            </li>
          )}
        </For>
      </ul>
    </div>
  );
});
```

---

## 5. Seeding Default Fixtures

Seed tables with default data when the database is first initialized:

```typescript
export const countryTable = createTable(
  'countries',
  1,
  ['code'],
  undefined,
  'geo-db',
  [
    { id: '1', name: 'United States', code: 'US', population: 331000000 },
    { id: '2', name: 'Canada', code: 'CA', population: 38000000 },
  ]
);
```

Seeds are inserted only when the underlying IndexedDB table is completely empty.
