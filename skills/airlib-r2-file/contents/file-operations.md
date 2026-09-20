# Filesystem Operations

This guide establishes the conventions for creating, reading, updating, querying, and recovering files and directories using `@irpclib/r2-file`.

---

## Writing Content

The `write()` operation persists content to storage, supporting binary file streaming, discriminated string formats, and JSON objects:

```typescript
// Binary payload via IRPCFile
write(path: string, data: IRPCFile, options?: WriteOptions): Promise<FileInfo>

// String payload with discriminated encoding
write(path: string, data: string, options?: WriteOptions<'text' | 'base64' | 'data-url'>): Promise<FileInfo>

// JSON value (Object or Array)
write(path: string, data: Record<string, any> | any[], options?: WriteOptions<'json'>): Promise<FileInfo>
```

### Writing Binary Files

Package binary data in an `IRPCFile` with explicit `name`, `size`, and MIME `type`:

```typescript
import { write } from '@irpclib/r2-file';
import { IRPCFile } from '@irpclib/irpc';

const file = new IRPCFile(
  { name: 'document.pdf', size: 1048576, type: 'application/pdf' },
  fileBlob
);

const info = await write('~/docs/document.pdf', file, {
  public: true, // Make publicly accessible via direct GET
  metadata: { department: 'finance', author: 'Alice' },
});
```

### Writing Text & Encodings

Write plain text, Base64 strings, or data URLs directly:

```typescript
import { write } from '@irpclib/r2-file';

// Plain text (inferred as text/plain)
await write('~/logs/app.log', 'Application started successfully');

// Base64 string
await write('~/images/icon.png', base64String, {
  encoding: 'base64',
  type: 'image/png',
});

// Data URL
await write('~/images/avatar.jpg', 'data:image/jpeg;base64,...', {
  encoding: 'data-url',
});
```

### Writing JSON Values

Passing an object or array automatically serializes the content as `application/json`. For files under `maxEncodingSize` (500KB), the payload is cached write-through in D1 for instantaneous reads:

```typescript
import { write } from '@irpclib/r2-file';

await write('~/settings/theme.json', {
  mode: 'dark',
  accentColor: '#3b82f6',
  fontSize: 14,
});
```

### Write Constraints & Limits

- **`maxSize` (Default: 25MB)**: Maximum binary upload size. Calls exceeding this limit reject immediately with `EFBIG` before transferring bytes.
- **`maxEncodingSize` (Default: 500KB)**: Limits inline string and JSON transfers to protect worker memory. Payloads larger than this must be written as binary `IRPCFile` streams.

### Reactive UI Upload Integration (`write.later`)

Use `write.later()` to track binary upload progress and completion without blocking:

#### React
```tsx
import { setup, Show } from '@airlib/react';
import { write } from '@irpclib/r2-file';
import { IRPCFile } from '@irpclib/irpc';

export const FileUploader = setup<{ targetDir?: string }>((props) => {
  const uploader = write.later();

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const domFile = event.target.files?.[0];
    if (!domFile) return;

    const targetPath = `${props.targetDir ?? '~'}/${domFile.name}`;
    const irpcFile = new IRPCFile(
      { name: domFile.name, size: domFile.size, type: domFile.type },
      domFile
    );

    uploader.dispatch(targetPath, irpcFile);
  };

  return () => (
    <div className="file-uploader">
      <input type="file" onChange={handleUpload} disabled={uploader.status === 'pending'} />

      <Show when={() => uploader.status === 'pending'}>
        {() => <span>Uploading...</span>}
      </Show>

      <Show when={() => uploader.status === 'success'}>
        {() => <span className="text-green-500">Upload completed!</span>}
      </Show>

      <Show when={() => uploader.status === 'error' && uploader.error}>
        {({ message }) => <span className="text-red-500">{message}</span>}
      </Show>
    </div>
  );
});
```

#### SolidJS
```tsx
import { setup, Show } from '@airlib/solid';
import { write } from '@irpclib/r2-file';
import { IRPCFile } from '@irpclib/irpc';

export const FileUploader = setup<{ targetDir?: string }>((props) => {
  const uploader = write.later();

  const handleUpload = (event: Event & { currentTarget: HTMLInputElement }) => {
    const domFile = event.currentTarget.files?.[0];
    if (!domFile) return;

    const targetPath = `${props.targetDir ?? '~'}/${domFile.name}`;
    const irpcFile = new IRPCFile(
      { name: domFile.name, size: domFile.size, type: domFile.type },
      domFile
    );

    uploader.dispatch(targetPath, irpcFile);
  };

  return () => (
    <div class="file-uploader">
      <input type="file" onChange={handleUpload} disabled={uploader.status === 'pending'} />

      <Show when={uploader.status === 'pending'}>
        <span>Uploading...</span>
      </Show>

      <Show when={uploader.status === 'success'}>
        <span class="text-green-500">Upload completed!</span>
      </Show>

      <Show when={uploader.status === 'error' && uploader.error}>
        <span class="text-red-500">{uploader.error?.message}</span>
      </Show>
    </div>
  );
});
```

---

## Reading Content

The `read()` operation retrieves file content and adapts its return type based on the requested `encoding`:

```typescript
// Binary delivery returning an IRPCBlob
read(path: string, options?: ReadOptions): Promise<IRPCBlob | undefined>

// Decoded string representation
read(path: string, options: ReadOptions<'text' | 'base64' | 'data-url'>): Promise<string | undefined>

// Parsed JSON value
read<T>(path: string, options: ReadOptions<'json'>): Promise<T | undefined>
```

### Reading Binary Content

When reading without an explicit encoding option, `read()` resolves an `IRPCBlob`:

```typescript
import { read } from '@irpclib/r2-file';

// Imperative: Resolves pointer and downloads native Blob
const blob = await read('~/media/video.mp4');

if (blob) {
  console.log('Size:', blob.size, 'Type:', blob.type);
  const url = URL.createObjectURL(blob);
}
```

### Reactive UI Download Integration (`read.later`)

In reactive user interfaces, wrap file downloads with `read.later()` to track progress without blocking component rendering:

#### React
```tsx
import { setup, Show } from '@airlib/react';
import { read } from '@irpclib/r2-file';

export const DownloadButton = setup<{ href: string }>((props) => {
  const file = read.later();

  return () => (
    <div>
      <Show when={() => file.status === 'pending' || file.data?.status === 'pending'}>
        {() => <div>Downloading... {file.data?.downloaded ?? '0'}%</div>}
      </Show>

      <Show when={() => file.status !== 'pending' && file.data?.status !== 'pending'}>
        {() => (
          <button type="button" onClick={() => file.dispatch(props.href)}>
            Download File
          </button>
        )}
      </Show>
    </div>
  );
});
```

#### SolidJS
```tsx
import { setup, Show } from '@airlib/solid';
import { read } from '@irpclib/r2-file';

export const DownloadButton = setup<{ href: string }>((props) => {
  const file = read.later();

  return () => (
    <div>
      <Show when={file.status === 'pending' || file.data?.status === 'pending'}>
        <div>Downloading... {file.data?.downloaded ?? '0'}%</div>
      </Show>

      <Show when={file.status !== 'pending' && file.data?.status !== 'pending'}>
        <button type="button" onClick={() => file.dispatch(props.href)}>
          Download File
        </button>
      </Show>
    </div>
  );
});
```

### Reactive Document Viewer (`read.with`)

Bind file content directly into reactive views for real-time document preview:

#### React
```tsx
import { setup, Show } from '@airlib/react';
import { read } from '@irpclib/r2-file';

export const DocumentViewer = setup<{ path: string }>((props) => {
  const doc = read.with(() => [props.path, { encoding: 'text' }]);

  return () => (
    <div className="document-viewer">
      <Show when={() => doc.status === 'pending'}>
        {() => <div>Loading document...</div>}
      </Show>

      <Show when={() => doc.status === 'error' && doc.error}>
        {({ message }) => <div className="text-red-500">{message}</div>}
      </Show>

      <Show when={() => doc.status === 'success' && doc.data}>
        {(content) => <pre className="p-4 bg-gray-100 rounded">{content}</pre>}
      </Show>
    </div>
  );
});
```

#### SolidJS
```tsx
import { setup, Show } from '@airlib/solid';
import { read } from '@irpclib/r2-file';

export const DocumentViewer = setup<{ path: string }>((props) => {
  const doc = read.with(() => [props.path, { encoding: 'text' }]);

  return () => (
    <div class="document-viewer">
      <Show when={doc.status === 'pending'}>
        <div>Loading document...</div>
      </Show>

      <Show when={doc.status === 'error' && doc.error}>
        <div class="text-red-500">{doc.error?.message}</div>
      </Show>

      <Show when={doc.status === 'success' && doc.data}>
        <pre class="p-4 bg-gray-100 rounded">{doc.data}</pre>
      </Show>
    </div>
  );
});
```

### Reading Parsed JSON

Read and deserialize JSON documents with full TypeScript type safety:

```typescript
import { read } from '@irpclib/r2-file';

interface UserConfig {
  mode: 'light' | 'dark';
  accentColor: string;
}

const config = await read<UserConfig>('~/settings/theme.json', {
  encoding: 'json',
});

console.log('Mode:', config?.mode);
```

### Reading Text and Data URLs

```typescript
import { read } from '@irpclib/r2-file';

// Plain text
const notes = await read('~/notes.txt', { encoding: 'text' });

// Base64
const base64 = await read('~/avatar.png', { encoding: 'base64' });

// Dynamic Data URL (synthesized with the file's authoritative MIME type)
const dataUrl = await read('~/avatar.png', { encoding: 'data-url' });
```

---

## Metadata & Existence

### Inspecting Metadata (`stat`)

`stat()` returns a pure `FileInfo` stat descriptor without downloading file bytes. For symbolic links, it dynamically resolves the target's current metadata:

```typescript
import { stat } from '@irpclib/r2-file';

const info = await stat('~/documents/report.pdf');

if (info) {
  console.log(info.path);        // Canonical path: '/home/documents/report.pdf'
  console.log(info.name);        // 'report.pdf'
  console.log(info.size);        // Size in bytes
  console.log(info.type);        // 'application/pdf'
  console.log(info.mtime);       // Date instance
  console.log(info.etag);        // Entity tag for caching
  console.log(info.isDirectory); // false
  console.log(info.public);      // true / false
  console.log(info.metadata);    // Custom metadata tags
}
```

Pass `{ trash: true }` to inspect metadata for soft-deleted items:

```typescript
const trashedInfo = await stat('~/old-file.txt', { trash: true });
```

### Checking Presence (`exists`)

Check whether an entry exists in active storage (soft-deleted items return `false`):

```typescript
import { exists } from '@irpclib/r2-file';

if (await exists('~/documents/report.pdf')) {
  console.log('File exists');
}
```

---

## Directories & Listings

### Creating Directories (`mkdir`)

Creates directory markers in R2 and registers the directory hierarchy in D1:

```typescript
import { mkdir } from '@irpclib/r2-file';

await mkdir('~/projects/air-stack', {
  public: false,
  metadata: { project: 'air' },
});
```

### Listing Directories (`list`)

`list()` returns a paginated list of entries inside a directory with sorting and filtering:

```typescript
import { list } from '@irpclib/r2-file';

const { entries, nextCursor } = await list('~/projects', {
  limit: 50,
  sort: '-mtime', // Newest first
  filter: {
    type: 'application/pdf',
    size: { min: 1024, max: 10485760 }, // Between 1KB and 10MB
  },
});
```

### Sorting Options

Sort by any field with an optional `-` prefix for descending order:

```typescript
// Compound sorting: sort by type descending, then by name ascending
await list('~/media', {
  sort: ['-type', 'name'],
});
```

Supported sort fields: `'name'`, `'size'`, `'mtime'`, `'type'`, `'hidden'`, `'public'`, `'deletedAt'`.

### Filtering Options

- `filter.public` *(boolean)*: Filter by public or protected visibility.
- `filter.type` *(string)*: Exact MIME type matching.
- `filter.deleted` *(boolean)*: Filter by soft-deleted state.
- `filter.size` *(`{ min?: number, max?: number }`)*: Bounded byte range.
- `filter.mtime` *(`{ min?: Date | number, max?: Date | number }`)*: Modification timestamp range.
- `filter.metadata` *(`Record<string, string>`)*: Match custom metadata key/value pairs.

### Recursive Listings

Traverse the entire directory hierarchy:

```typescript
const { entries } = await list('~/src', { recursive: true });
```

### Reactive Directory Component (`list.with`)

Bind directory listings directly to UI components:

#### React
```tsx
import { setup, For, Show } from '@airlib/react';
import { list } from '@irpclib/r2-file';

export const FileExplorer = setup<{ path: string }>((props) => {
  const dir = list.with(() => [props.path]);

  return () => (
    <div>
      <Show when={() => dir.status === 'pending'}>
        {() => <div>Loading directory...</div>}
      </Show>

      <Show when={() => dir.status === 'success' && dir.data}>
        {({ entries }) => (
          <ul>
            <For each={() => entries}>
              {(entry) => (
                <li key={entry.path}>
                  {entry.name} ({entry.size} bytes)
                </li>
              )}
            </For>
          </ul>
        )}
      </Show>
    </div>
  );
});
```

#### SolidJS
```tsx
import { setup, For, Show } from '@airlib/solid';
import { list } from '@irpclib/r2-file';

export const FileExplorer = setup<{ path: string }>((props) => {
  const dir = list.with(() => [props.path]);

  return () => (
    <div>
      <Show when={dir.status === 'pending'}>
        <div>Loading directory...</div>
      </Show>

      <Show when={dir.status === 'success' && dir.data}>
        <ul>
          <For each={dir.data?.entries}>
            {(entry) => (
              <li>
                {entry.name} ({entry.size} bytes)
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
});
```

---

## Indexed Search (`search`)

When D1 is attached, `search()` executes fast SQL queries across file names and indexed tags:

```typescript
import { search } from '@irpclib/r2-file';

const results = await search('invoice-2026', {
  limit: 20,
  sort: '-mtime',
});
```

### Reactive Live File Search (`search.with`)

Bind live search queries to UI inputs for real-time file discovery:

#### React
```tsx
import { setup, mutable, For, Show } from '@airlib/react';
import { search } from '@irpclib/r2-file';

export const FileSearch = setup(() => {
  const form = mutable({ query: '' });
  const results = search.with(() => [form.query, { limit: 10 }]);

  return () => (
    <div className="file-search">
      <input
        type="search"
        placeholder="Search files..."
        value={form.query}
        onInput={(e) => (form.query = e.currentTarget.value)}
      />

      <Show when={() => results.status === 'pending'}>
        {() => <div>Searching...</div>}
      </Show>

      <Show when={() => results.status === 'success' && results.data}>
        {({ entries }) => (
          <ul>
            <For each={() => entries}>
              {(item) => (
                <li key={item.path}>
                  {item.name} ({item.size} bytes)
                </li>
              )}
            </For>
          </ul>
        )}
      </Show>
    </div>
  );
});
```

#### SolidJS
```tsx
import { setup, mutable, For, Show } from '@airlib/solid';
import { search } from '@irpclib/r2-file';

export const FileSearch = setup(() => {
  const form = mutable({ query: '' });
  const results = search.with(() => [form.query, { limit: 10 }]);

  return () => (
    <div class="file-search">
      <input
        type="search"
        placeholder="Search files..."
        value={form.query}
        onInput={(e) => (form.query = e.currentTarget.value)}
      />

      <Show when={results.status === 'pending'}>
        <div>Searching...</div>
      </Show>

      <Show when={results.status === 'success' && results.data}>
        <ul>
          <For each={results.data?.entries}>
            {(item) => (
              <li>
                {item.name} ({item.size} bytes)
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
});
```

---

## Copying & Moving

### Copying Resources (`copy`)

Copies a file or an entire directory tree. Both storage objects and metadata indexes are duplicated:

```typescript
import { copy } from '@irpclib/r2-file';

// Copy a single file
await copy('~/drafts/spec.md', '~/releases/spec.md');

// Copy an entire directory recursively
await copy('~/templates/react-app', '~/projects/my-new-app');
```

WARNING: `copy()` and `move()` never overwrite existing destinations. If the target path exists, the operation halts immediately with `EEXIST`. Remove the destination first to replace it.

### Moving Resources (`move`)

Relocates a file or directory tree to a new destination path:

```typescript
import { move } from '@irpclib/r2-file';

await move('~/temp/upload.tmp', '~/archive/upload-final.zip');
```

---

## Symbolic Links (`link`)

Creates an alias pointing to a target resource. Metadata and content resolution dynamically resolve to the target:

```typescript
import { link, stat, read } from '@irpclib/r2-file';

// Create a symbolic shortcut
await link('/shared/library/standard.css', '~/styles/app.css');

// Reading the symlink transparently returns target content
const css = await read('~/styles/app.css', { encoding: 'text' });

// Statting the symlink returns target metadata along with the link target
const info = await stat('~/styles/app.css');
console.log('Symlink target:', info?.link); // '/shared/library/standard.css'
```

---

## Deletion, Trash & Recovery

### Permanent Removal (`remove`)

By default, `remove()` permanently purges files and folders:

```typescript
import { remove } from '@irpclib/r2-file';

// Delete a single file
await remove('~/temp/cache.json');

// Delete an entire directory tree
await remove('~/old-project', { recursive: true });
```

### Soft Delete & Recycle Bin

Pass `{ soft: true }` to move entries into the trash instead of permanently purging them:

```typescript
import { remove, list, exists } from '@irpclib/r2-file';

// Move file to trash
await remove('~/important-report.pdf', { soft: true });

// Trashed files are immediately hidden from standard operations
await exists('~/important-report.pdf'); // false

// List files currently in the recycle bin
const { entries } = await list('~', { trash: true });
```

### Restoring Files (`restore`)

Brings a soft-deleted file or directory tree back from the trash with metadata and structure intact:

```typescript
import { restore } from '@irpclib/r2-file';

const restoredInfo = await restore('~/important-report.pdf');
console.log('Restored:', restoredInfo.path);
```
