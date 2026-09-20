# Sitemap Generation

AirLib includes a built-in XML sitemap generator that automatically maps static and dynamic application routes for search engine indexing. When deployed with the Vite SSR engine, incoming requests to `/sitemap.xml` are intercepted and served automatically.

---

## 1. Automatic Static Route Mapping

All registered routes on the router tree are included in the sitemap by default:

```typescript
import { router } from '@/src/router.js';

const root = router.route();
root.route('/about');
root.route('/pricing');
root.route('/contact');
```

Requesting `/sitemap.xml` returns valid XML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
  </url>
  <url>
    <loc>https://example.com/about</loc>
  </url>
  <url>
    <loc>https://example.com/pricing</loc>
  </url>
  <url>
    <loc>https://example.com/contact</loc>
  </url>
</urlset>
```

---

## 2. Route Configuration (`sitemap`)

### Exclude Routes from Sitemap

To omit private, admin, or internal routes (and all of their child descendants) from search engine indexing, set `sitemap: false` in `route.config()`:

```typescript
// pages/admin/route.ts
export const adminRoute = route.config({
  sitemap: false,
});
```

### Custom Priority & Change Frequency

Configure metadata hints for search engines:

```typescript
// pages/pricing/route.ts
export const pricingRoute = route.config({
  sitemap: {
    priority: 0.9,
    changefreq: 'weekly',
  },
});
```

---

## 3. Dynamic Route Generation

Parameterized routes (e.g. `/posts/:slug`) cannot be discovered automatically because they require concrete data. Supply an asynchronous generator function to map application database entries into full URL paths:

```typescript
// pages/posts/[slug]/route.ts
export const postDetailRoute = route.config({
  sitemap: async (route) => {
    const posts = await fetchPublishedPosts();
    return posts.map((post) => route.url({ slug: post.slug }));
  },
});
```

The generator is called dynamically whenever `/sitemap.xml` is requested.

---

## 4. Multi-Language Alternates (`hreflang`)

For localized applications, define language prefixes and set `hreflang` with `nested: true` on the language root route:

```typescript
// pages/[lang]/route.ts
export const langRoute = route.config({
  sitemap: () => [
    { loc: '/en', nested: true, hreflang: 'en' },
    { loc: '/es', nested: true, hreflang: 'es' },
    { loc: '/fr', nested: true, hreflang: 'fr' },
  ],
});

// All child routes under pages/[lang]/ automatically inherit language variants and alternate cross-links
```

---

## 5. Programmatic Sitemap Generation

To generate an XML sitemap manually (for cron jobs, build scripts, or custom endpoints), call `router.sitemap()`:

```typescript
import { router } from '@/src/router.js';

const xml = await router.sitemap({
  baseUrl: 'https://example.com',
});
```

### SSR Worker Configuration

In serverless worker environments (Cloudflare Workers, Bun), configure sitemap parameters directly in `createApp`:

```typescript
// worker.ts
import { createApp } from '@airlib/react/ssr';
import { router, adminRoute } from './router.js';
import App from './app.js';

export default createApp(router, App, {
  sitemap: {
    baseUrl: 'https://example.com',
    exclude: [adminRoute], // Globally exclude specific route trees
  },
});
```
