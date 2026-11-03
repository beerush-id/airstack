# Document Head & SEO

This guide explains how to manage page titles, meta descriptions, Open Graph preview cards, Twitter/X cards, canonical URLs, and structured JSON-LD data using the `<Head>` component.

---

## Page Metadata Basics

Render `<Head>` inside any page or component to configure document `<head>` properties. It works identically during Server-Side Rendering (SSR) and client-side navigation.

### React Example

```tsx
import { Head, page } from '@airlib/react';
import { dashboardRoute } from './route.js';

export default page(dashboardRoute).render(() => (
  <>
    <Head
      meta={{
        title: 'Project Analytics | Dashboard',
        description: 'Real-time telemetry and performance analytics.',
        keywords: ['analytics', 'telemetry', 'dashboard'],
        canonical: 'https://example.com/dashboard',
        image: 'https://example.com/og-cover.png',
      }}
    />
    <main className="dashboard-view">
      <h1>Analytics</h1>
    </main>
  </>
));
```

### SolidJS Example

```tsx
import { Head, page } from '@airlib/solid';
import { dashboardRoute } from './route.js';

export default page(dashboardRoute).render(() => (
  <>
    <Head
      meta={{
        title: 'Project Analytics | Dashboard',
        description: 'Real-time telemetry and performance analytics.',
        keywords: ['analytics', 'telemetry', 'dashboard'],
        canonical: 'https://example.com/dashboard',
        image: 'https://example.com/og-cover.png',
      }}
    />
    <main class="dashboard-view">
      <h1>Analytics</h1>
    </main>
  </>
));
```

---

## Automatic Social Platform Fallbacks

When you set basic metadata, `<Head>` automatically derives the required meta tags for Open Graph and Twitter/X:

- **`og:title` & `twitter:title`**: Fall back to document `title`.
- **`og:description` & `twitter:description`**: Fall back to `description`.
- **`og:url`**: Falls back to `canonical`.
- **`twitter:image`**: Falls back to `image` or `og.image`.
- **`twitter:card`**: Automatically defaults to `'summary_large_image'` when an image is specified, or `'summary'` otherwise.

---

## Structured Data (JSON-LD)

To provide rich snippets for search engines (e.g. articles, products, organizations), pass a JSON-LD object directly into `meta.jsonLd`:

```tsx
<Head
  meta={{
    title: 'Getting Started Guide',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: 'Getting Started with AirLib',
      description: 'Step-by-step introduction to fine-grained reactivity.',
      author: {
        '@type': 'Organization',
        name: 'Beerush',
      },
    },
  }}
/>
```

---

## Metadata API Reference

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Page document title. |
| `description` | `string` | Meta description for search results. |
| `keywords` | `string[]` | Meta keyword tags. |
| `canonical` | `string` | Canonical URL to prevent duplicate content indexing. |
| `image` | `string` | Primary preview image for social cards. |
| `robots` | `string` | Robots indexing instructions (e.g. `'noindex, nofollow'`). |
| `jsonLd` | `Record<string, unknown>` | Structured data object serialized into `<script type="application/ld+json">`. |
