import { createApp } from '@airlib/react/ssr';
import { HTTPRouter } from '@irpclib/http/router';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { createWorker as createImageWorker, type ImageWorkerEnv } from '@irpclib/r2-image/worker';
import { WebSocketRouter } from '@irpclib/ws/router';
import { httpTransport, wsTransport } from './api.js';
import App from './app.js';
import router from './router.js';

const httpRouter = new HTTPRouter(httpTransport);
const wsRouter = new WebSocketRouter(wsTransport);

const app = createApp(router, App, {
  httpRouter,
  wsRouter,
});

const DEV_RESIZER = 'http://localhost:8080';

const images = createImageWorker();

export default {
  ...app,
  async fetch(req: Request, env: ImageWorkerEnv | undefined) {
    const url = new URL(req.url);

    if (url.pathname.startsWith(images.endpoint)) {
      const nextEnv = await resolveBinding<ImageWorkerEnv>(env);
      return images.fetch(req, { RESIZER: DEV_RESIZER, ...nextEnv });
    }

    return app.fetch(req, env);
  },
};
