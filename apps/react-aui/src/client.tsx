import { hydrateRoot } from 'react-dom/client';
import App from './app.js';
import router from './router.js';

import './app.css';
import { acceptInteractions } from '@airlib/react/browser';

router
  .activate(window.location.href)
  .then(() => {
    hydrateRoot(document.getElementById('root')!, <App />);
  })
  .then(() => acceptInteractions());