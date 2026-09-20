---
name: airlib-storage
description: Use when building client-side persistent storage, reactive localStorage or sessionStorage sync, IndexedDB key-value stores, or indexed relational client tables in an AirLib project
---

# AirLib Storage Router

The client-side persistence and local database guide for applications built with **@airlib/storage** in AirLib.

IMPORTANT: Read only what you need. Match your architectural concern to the decision matrix below, then read only the corresponding topic guide in `contents/`. Do not load all files into context.

---

## Storage Decision Matrix: What are you building?

| What architectural concern are you addressing? | Topic Guide to Read |
|---|---|
| **"How do I persist reactive user settings or preferences across browser sessions and tabs?"** | [contents/local-storage.md](./contents/local-storage.md) |
| **"How do I keep transient form drafts or navigation state alive within a tab without cross-session leaks?"** | [contents/session-storage.md](./contents/session-storage.md) |
| **"How do I store larger key-value datasets in IndexedDB with optimistic in-memory caching?"** | [contents/kv-store.md](./contents/kv-store.md) |
| **"How do I manage structured records, query indexed fields, or paginate collections in IndexedDB?"** | [contents/indexed-tables.md](./contents/indexed-tables.md) |

---

## Symbol & Code Lookup

Saw an unfamiliar symbol, method, or property in storage code? Look it up here to find the relevant guide:

| Symbol / Keyword Seen in Code | Topic Guide to Read |
|---|---|
| `persistent`, `persistent.leave`, `@version:prevVersion`, `@airlib/storage` | [contents/local-storage.md](./contents/local-storage.md) |
| `session`, `session.leave`, `@airlib/storage` | [contents/session-storage.md](./contents/session-storage.md) |
| `createKVStore`, `kv`, `kv.remove`, `store.ready`, `store.leave`, `store.store`, `@airlib/storage/db` | [contents/kv-store.md](./contents/kv-store.md) |
| `createTable`, `table.add`, `table.get`, `table.remove`, `table.leave`, `table.list`, `table.listByIndex`, `table.promise`, `table.seed`, `IDBKeyRange`, `@airlib/storage/db` | [contents/indexed-tables.md](./contents/indexed-tables.md) |

---

## Questions & Tasks Covered by Each Topic

### 1. [Persistent Storage (Local Storage)](./contents/local-storage.md)
Load this topic when you need to answer:
- How do I automatically synchronize a reactive state object with browser local storage?
- How does the storage engine detect and mirror state mutations made from other open tabs?
- How do I version persistent state schemas and migrate away old keys?
- How do I disconnect a component or store from local storage sync to free memory?

### 2. [Session Storage](./contents/session-storage.md)
Load this topic when you need to answer:
- How do I preserve form drafts or active wizard steps across page refreshes within the same tab?
- How do I ensure temporary user data is discarded when the tab or browser window closes?
- How do I version session state keys?
- How do I tear down session storage listeners on component unmount?

### 3. [IndexedDB Key-Value Store](./contents/kv-store.md)
Load this topic when you need to answer:
- When should I choose IndexedDB key-value storage over standard local storage?
- How do I read and write to the global default key-value store?
- How do I create an isolated, named key-value database?
- How do I await asynchronous IndexedDB write flushes before proceeding?
- How do I seed initial key-value records when a database is first opened?

### 4. [IndexedDB Structured Tables](./contents/indexed-tables.md)
Load this topic when you need to answer:
- How do I create structured, typed tables in IndexedDB?
- How do I define indexes for fields to enable fast lookup and range filtering?
- How do I add, retrieve, update, and delete individual records?
- How do I query records using index ranges (`IDBKeyRange`) or custom predicate filters?
- How do I implement client-side pagination with record limits, directions, and total counts?
- How do I wait for table operations to complete using promise conversion?
- How do I seed tables with default dataset fixtures?
