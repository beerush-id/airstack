import { $bind, $use, mutable, page } from '@airlib/react';
import { Layout, Sidebar } from '@airlib/react/mdx';
import { Toggle } from '@airlib/react-aui';
import Footer from '../../components/Footer.js';
import Header from '../../components/Header.js';
import { navs } from './nav.js';
import docsRoute from './route.js';

const theme = mutable({ dark: false });

export default page(docsRoute).render(({ children }) => (
  <>
    <Header />
    <main className="docs-main">
      <Layout nav={navs} className="docs-shell">
        <Layout.Snippet for={'sidebar'}>
          {() => (
            <>
              <Toggle pressed={$bind(theme, 'dark')} data-theme={$use(() => (theme.dark ? 'dark' : 'light'))}>
                Toggle Theme
              </Toggle>
              <Sidebar nav={navs} collapsible />
            </>
          )}
        </Layout.Snippet>
        {children}
      </Layout>
    </main>
    <Footer />
  </>
));
