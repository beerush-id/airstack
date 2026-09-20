# Webhooks & REST Translation

Third-party webhooks (e.g. Stripe, GitHub, Shopify) send standard HTTP POST requests with raw JSON payloads. Because external services cannot communicate with IRPC's internal protocol, the server edge intercepts incoming REST calls and translates them directly into IRPC function executions.

---

## 1. Webhook Function Declarations

Webhook stubs are declared using `irpc.declare()`, with one strict rule: **they must accept exactly one argument**. 

The router maps the entire incoming JSON body directly into this single argument:

```typescript
// pages/webhooks/function.ts
import { irpc } from '@/src/api.js';

export interface StripeEventPayload {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

export type StripeWebhookFn = (event: StripeEventPayload) => Promise<void>;

/**
 * Webhook declaration accepting a single event payload.
 */
export const stripeWebhook = irpc.declare<StripeWebhookFn>('webhook.stripe', {
  seed: () => undefined,
});
```

### Handler Construction

```typescript
// pages/webhooks/constructor.ts
import { irpc } from '@/src/api.js';
import { stripeWebhook, type StripeEventPayload } from './function.js';
import { billingService } from '@/src/lib/billing.js';

irpc.construct(stripeWebhook, async (event: StripeEventPayload) => {
  switch (event.type) {
    case 'invoice.payment_succeeded':
      await billingService.markPaid(event.data.object.id as string);
      break;
    case 'customer.subscription.deleted':
      await billingService.cancelSubscription(event.data.object.id as string);
      break;
  }
});
```

---

## 2. Server Translation Adapters

The router provides two server-side translation methods depending on the runtime.

### 1. `router.resolveRest()` (Edge & Web Request Standard)

Used in runtimes exposing a standard Web `Request` object (**Bun**, **Cloudflare Workers**, **Next.js Edge**, **SvelteKit**):

```typescript
// server.ts (Bun / Cloudflare Workers)
import { HTTPRouter } from '@irpclib/http/router';
import { transport } from '@/src/api.js';

const router = new HTTPRouter(transport);

Bun.serve({
  async fetch(req: Request) {
    const url = new URL(req.url);

    // 1. Standard IRPC calls
    if (url.pathname === transport.endpoint && req.method === 'POST') {
      return router.resolve(req, [['token', req.headers.get('authorization')]]);
    }

    // 2. Incoming REST webhook endpoint
    if (url.pathname.startsWith('/rest/') && req.method === 'POST') {
      const functionName = url.pathname.replace('/rest/', '');

      // Passes the web Request directly; router parses JSON and maps to functionName
      return router.resolveRest(
        req,
        functionName,
        [['signature', req.headers.get('stripe-signature')]],
        // Custom response builder acknowledging receipt with 200 OK
        () => new Response('OK', { status: 200 })
      );
    }

    return new Response('Not Found', { status: 404 });
  },
});
```

### 2. `router.resolveJson()` (Express / Fastify)

Used in Node.js frameworks where middleware like `express.json()` pre-parses the stream into `req.body`:

```typescript
// server.ts (Express)
import express from 'express';
import { HTTPRouter } from '@irpclib/http/router';
import { transport } from '@/src/api.js';

const router = new HTTPRouter(transport);
const app = express();

app.use(express.json());

app.post('/rest/:name', async (req, res) => {
  const { name } = req.params;

  const response = await router.resolveJson(
    req.body,
    name,
    [['signature', req.headers['stripe-signature']]],
    () => new Response('OK', { status: 200 })
  );

  res.status(response.status).send(await response.text());
});
```

---

## 3. Webhook Security & Signatures

Validate incoming cryptographic signatures inside a Spec Hook or Guard using request context:

```typescript
// pages/webhooks/constructor.ts
import { irpc } from '@/src/api.js';
import { stripeWebhook } from './function.js';
import { getContext, GuardError } from '@irpclib/irpc';
import { verifyStripeSignature } from '@/src/lib/stripe.js';

irpc.guard(async (req) => {
  if (req.name === 'webhook.stripe') {
    const signature = getContext<string>('signature');
    const [payload] = req.args;

    const isValid = verifyStripeSignature(payload, signature);
    if (!isValid) {
      throw GuardError.failed('Invalid webhook signature');
    }
  }
});
```
