import { Aria, JSXTranslator } from '@airlib/aria';
import { type AppEntry, Head, type HeadConfig, UIRouter } from '@airlib/react';
import { configure } from '@irpclib/r2-image';
import ogImage from '@/assets/og_image.png?asset' with { sizes: '1200' };
import { ThemeToggler } from '@/components/ThemeToggler.js';
import RootLayout from '@/pages/layout.js';
import router from './router.js';

Head.config(() => {
  const { pathname } = router.context;

  const origin = 'https://airlib.dev';
  const suffix = pathname.startsWith('/docs') ? ' — AirLib Documentation' : ' — AirLib';
  const imageUrl = ogImage.src.startsWith('/@fs') ? ogImage.src : new URL(ogImage.src, origin).href;

  return {
    suffix,
    defaults: {
      author: 'Nanang Mahdaen El Agung',
      robots: 'index, follow',
      og: {
        siteName: 'AirLib',
        type: 'website',
        image: imageUrl,
      },
      twitter: {
        card: 'summary_large_image',
        creator: '@mahdaen',
        image: imageUrl,
      },
    },
  } as HeadConfig;
});

Aria.translate(JSXTranslator);

/**
 * Configure image processing
 */
configure({
  endpoint: '/images',
  maxSize: 5 * 1024 * 1024, // 5MB
  sizes: [
    { name: 'thumbnail', size: 256, format: 'webp' },
    { name: 'preview', size: 512, format: 'webp' },
    { name: 'display', size: 1024, format: 'webp' },
  ],
  allowedSizes: [128, 256, 512, 1024, 2048],
});

export default (({ url }) => (
  <UIRouter router={router} root={RootLayout} url={url}>
    <ThemeToggler />
  </UIRouter>
)) satisfies AppEntry;
