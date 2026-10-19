import { Head, page } from '@airlib/react';
import { AriaCatalogue } from '@/components/aria/AriaCatalogue.js';
import { AriaCta } from '@/components/aria/AriaCta.js';
import { AriaHero } from '@/components/aria/AriaHero.js';
import { AriaKeyboard } from '@/components/aria/AriaKeyboard.js';
import { AriaPatterns } from '@/components/aria/AriaPatterns.js';
import { AriaShowcase } from '@/components/aria/AriaShowcase.js';
import { AriaSteps } from '@/components/aria/AriaSteps.js';
import ariaRoute from './route.js';

export default page(ariaRoute).render(() => {
  return (
    <>
      <Head
        meta={{
          title: 'Headless WAI-ARIA Kits for React & SolidJS',
          description:
            'Headless, reactive WAI-ARIA controllers that compile roles, states, focus order, and keyboard contracts onto your own markup. 54 patterns for React, SolidJS, and plain DOM — no wrappers, no styles, no lock-in.',
          keywords: [
            'Headless UI',
            'WAI-ARIA',
            'Accessibility',
            'ARIA Attributes',
            'React Accessibility',
            'SolidJS Accessibility',
            'Accessible Components',
            'Keyboard Navigation',
            'Focus Management',
            'Design System Primitives',
            'AirLib',
            'Aria',
          ],
        }}
      />
      <AriaHero />
      <AriaShowcase />
      <AriaPatterns />
      <AriaKeyboard />
      <AriaSteps />
      <AriaCatalogue />
      <AriaCta />
    </>
  );
});
