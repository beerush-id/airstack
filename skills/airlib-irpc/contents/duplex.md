# IRPC Duplex: Ask & Answer Within a Call

A streaming call is a two-way conversation. While a call is live, the server can ask the caller a question and wait for its answer, and the caller can ask the server back. Both sides use the same two methods: `ask()` sends a question, `answer()` registers who replies to it.

Duplex rides the call itself. It works the same over local execution, HTTP, WebSocket, and Broadcast; no extra endpoint, socket, or message channel is needed.

---

## Declaring the Questions (Query Map)

Questions are typed by a query map: each key is a question name, each value is the function shape of its answer. Pass the map as the second type argument of `RemoteState`. Duplex is available only on streaming declarations (`stream: true`), since a question needs a live call to travel on.

```typescript
// pages/assistant/function.ts
import type { RemoteState } from '@irpclib/irpc';
import { irpc } from '@/src/api.js';

export type AssistantQueries = {
  getState: () => { currentApp: string };
  confirm: (message: string, required?: boolean) => Promise<boolean>;
  getQuota: (unit: 'mb' | 'gb') => number;
};

export type AskAssistantFn = (prompt: string) => RemoteState<{ status: string }, AssistantQueries>;

export const askAssistant = irpc.declare<AskAssistantFn>({
  name: 'assistant.ask',
  stream: true,
  seed: () => ({ status: 'idle' }),
});
```

One map serves both directions. Whichever side calls `ask('getState')` gets the answer typed as `{ currentApp: string } | undefined`; whichever side calls `answer('getState', ...)` is type-checked against the same shape.

---

## Server Asks the Caller

Inside `stream()`, the handler's `state` carries `ask()`. The caller registers the reply with `answer()` on the call it holds:

```typescript
// pages/assistant/constructor.ts
import { irpc } from '@/src/api.js';
import { stream } from '@irpclib/irpc';
import { askAssistant } from './function.js';

irpc.construct(askAssistant, (prompt) => {
  return stream(async (state, resolve) => {
    state.data.status = `thinking: ${prompt}`;

    const app = await state.ask('getState');
    state.data.status = `working in ${app?.currentApp ?? 'nothing'}`;

    resolve();
  }, { status: 'idle' });
});
```

```typescript
// Caller
const call = askAssistant('open the Photos app');
call.answer('getState', () => ({ currentApp: 'Finder' }));

const final = await call;
```

Registering an answer right after the call is created is safe: questions sent before the transport is bound are queued and flushed once it is.

## Caller Asks the Server

The reverse uses the same methods with the roles swapped. The handler registers the answer on `state`; the caller asks on the call:

```typescript
irpc.construct(askAssistant, () => {
  return stream((state, resolve) => {
    state.answer('getQuota', (unit) => (unit === 'gb' ? 10 : 10240));
    // ... work, then resolve()
  }, { status: 'idle' });
});

const call = askAssistant('upload these photos');
const quota = await call.ask('getQuota', 'mb'); // 10240
```

## Both Directions in One Call

Answers can themselves ask. A caller answering `confirm` can ask the server something before it replies:

```typescript
call.answer('confirm', async (message) => {
  const quota = await call.ask('getQuota', 'gb');
  return quota !== undefined && quota > 1;
});
```

---

## Answer Semantics

| Situation | What the asker gets |
|---|---|
| Answer handler returns a value (sync or async) | A Promise resolving to that value, once. |
| No answer registered for that question | `undefined`. |
| The call is already closed when asking | `undefined`, immediately. |
| The call closes (resolve, reject, disconnect, abort) while the question is pending | `undefined`. Queued and in-flight questions settle; none hang. |
| Answer handler throws | The Promise rejects with an `IRPCError` carrying the handler's message. |

Answers are a single value, not a stream; for progressive data, mutate `state.data` instead. Blobs and files are encoded in both question arguments and answers, so binary data can travel either way.

Since every question can settle as `undefined`, always handle the missing-answer case (`app?.currentApp`).

## Timeouts: the Asker Decides

A question has no timeout of its own; it waits until answered or until the call closes. How long is "too long" depends on the question, so the asker enforces its own deadline:

```typescript
const deadline = new Promise<undefined>((resolve) => setTimeout(resolve, 20_000));
const app = await Promise.race([state.ask('getState'), deadline]);
```

The call's own `timeout` still bounds the whole call, and questions sent from the caller travel under that same `timeout`. A call that may wait on long questions needs a call allowed to run that long, such as `keepAlive: true`, which removes the call timeout.

## Answers on Reactive Calls

Answers registered on a reactive call (`.with()`, `.when()`, `.later()`) survive re-dispatch. Each new execution delegates its questions to the reader you hold, so register answers once on that reader.

---

## Deployment: One Live Call, One Instance

Questions and replies are routed by the call's id to the router instance that holds the live stream, in memory. If a reply lands on a different instance, nothing finds the stream: the reply is dropped, and the server's pending question waits until the call closes.

On a single server, or a single WebSocket connection, this is automatic. When running multiple instances (serverless workers, load-balanced servers), route every packet of a call to the same instance, for example a Durable Object keyed by session.

- **HTTP**: each question and each reply is its own `POST`, separate from the streaming call. Route all IRPC `POST`s of a session to the same instance. Inside a Durable Object, `HTTPRouter.resolve(request)` serves them.
- **WebSocket**: one socket pinned to one instance keeps a call together.
- **Routing key**: the front worker must see it before parsing the body. Use a header (`HTTPTransport` `headers`), a cookie, or the URL. `transport.sign()` credentials travel in the body, so they can't route. Browsers can't set WebSocket headers, so on WebSocket use the URL or a cookie.
- **Reconnect**: when a WebSocket drops, every live call and pending question fails on the caller; nothing resumes. Re-issue the calls after reconnecting, on a URL that reaches the same instance.

`Durable` (see [Distribution: Durable State](./distribution.md)) shares a reactive state object across instances; it does not route calls.
