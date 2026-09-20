# Responsive Images & Asset Optimization

This guide explains how to render optimized, responsive images with build-time WebP generation and zero Cumulative Layout Shift (CLS).

---

## 1. The Image Pipeline

Delivering responsive images typically requires manually generating multiple image variants, writing verbose `<picture>` and `srcset` tags, or paying high SaaS transformation fees.

AirLib automates this at build time using the Vite asset pipeline:
1. Importing an image with `?asset` generates modern WebP variants at target resolutions during build time.
2. The universal `<Image>` component automatically injects the correct `srcset`, `sizes`, and intrinsic aspect ratios.

---

## 2. Using the `<Image>` Component

### React Example

```tsx
import { Image } from '@airlib/react';
// Import asset with target sizes
import heroBanner from './assets/hero.jpg?asset' with { sizes: '350, 700, 1200' };

export function HeroSection() {
  return (
    <section className="hero">
      <Image
        from={heroBanner}
        alt="Platform hero banner"
        loading="eager"
        className="hero-image"
      />
      <h1>Next-Generation Web Apps</h1>
    </section>
  );
}
```

### SolidJS Example

```tsx
import { Image } from '@airlib/solid';
import heroBanner from './assets/hero.jpg?asset' with { sizes: '350, 700, 1200' };

export function HeroSection() {
  return (
    <section class="hero">
      <Image
        from={heroBanner}
        alt="Platform hero banner"
        loading="eager"
        class="hero-image"
      />
      <h1>Next-Generation Web Apps</h1>
    </section>
  );
}
```

---

## 3. Props Reference

| Prop | Type | Description |
|---|---|---|
| `from` | `ImageTransform` | The object returned by the `?asset` import. |
| `size` | `number` | Selects the closest generated variant at or above this width (e.g. `size={256}`). Omit for the full responsive `srcset`. |
| `src` | `string` | Override the resolved source URL. |
| `width` | `number` | Override the resolved width. |
| `height` | `number` | Override the resolved height. |
| `alt` | `string` | Descriptive image alt text. |
| `loading` | `'lazy' \| 'eager'` | Native image loading behavior (defaults to `'lazy'`). |

---

## 4. Key Benefits

- **Zero Layout Shift (CLS)**: The `<Image>` component automatically preserves intrinsic width and height dimensions before the asset loads.
- **Modern Formats**: Automatically converts heavy PNGs/JPEGs to optimized WebP formats at build time.
- **Zero Third-Party CDNs**: Image variants are generated statically during build time, requiring no dynamic transformation server or SaaS subscriptions.
