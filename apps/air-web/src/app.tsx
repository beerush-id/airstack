import { Aria, JSXTranslator } from '@airlib/aria';
import { type AppEntry, Head, type HeadConfig, UIRouter } from '@airlib/react';
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

export default (({ url }) => (
  <UIRouter router={router} root={RootLayout} url={url}>
    <ThemeToggler />
  </UIRouter>
)) satisfies AppEntry;
