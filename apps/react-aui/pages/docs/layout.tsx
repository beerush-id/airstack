import { page } from '@airlib/react';
import { Layout, Sidebar } from '@airlib/react/mdx';
import Footer from '../../components/Footer.js';
import Header from '../../components/Header.js';
import { navs } from './nav.js';
import docsRoute from './route.js';

export default page(docsRoute).render(({ children }) => (
  <>
    <Header />
    <main className="docs-main">
      <Layout nav={navs} className="docs-shell">
        <Layout.Snippet for={'sidebar'}>
          {() => (
            <>
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
