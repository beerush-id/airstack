import { Aria, JSXTranslator } from '@airlib/aria';
import { type AppEntry, Head, type HeadConfig, UIRouter } from '@airlib/react';
import RootLayout from '@/pages/layout.js';
import router from './router.js';

Head.config(() => {
  const { pathname } = router.context;
  const suffix = pathname.startsWith('/docs') ? ' — React AUI Docs' : ' — React AUI';

  return {
    suffix,
    defaults: {
      author: 'Nanang Mahdaen El Agung',
      robots: 'index, follow',
      og: {
        siteName: 'React AUI',
        type: 'website',
      },
      twitter: {
        card: 'summary',
        creator: '@mahdaen',
      },
    },
  } as HeadConfig;
});

Aria.translate(JSXTranslator);

export default (({ url }) => <UIRouter router={router} root={RootLayout} url={url} />) satisfies AppEntry;
