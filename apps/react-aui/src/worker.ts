import { createApp } from '@airlib/react/ssr';
import { HTTPRouter } from '@irpclib/http/router';
import { WebSocketRouter } from '@irpclib/ws/router';
import { httpTransport, wsTransport } from './api.js';
import App from './app.js';
import router from './router.js';

const httpRouter = new HTTPRouter(httpTransport);
const wsRouter = new WebSocketRouter(wsTransport);

export default createApp(router, App, { httpRouter, wsRouter });