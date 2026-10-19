import { HTTPTransport } from '@irpclib/http';
import { createPackage } from '@irpclib/irpc';
import { WebSocketTransport } from '@irpclib/ws';

export const irpc = createPackage({
  name: 'irpc',
  version: '1.0.0',
});

export const httpTransport = new HTTPTransport({
  endpoint: `/api/${irpc.href}`,
});

export const wsTransport = new WebSocketTransport({
  url: `/ws/${irpc.href}`,
});

// Switch to `wsTransport` to experience near-0 latency.
irpc.use(httpTransport);
