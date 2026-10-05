---
name: airlib-testing
description: Author test suites for AirLib applications and reusable libraries, covering application state models, UI component interactions, IRPC procedures, route lifecycle guards, full-stack Worker integrations, and library driver authoring.
---

# AirLib Testing Guide & Conventions

Conventions and patterns for authoring test suites across AirLib applications and reusable libraries.

---

## Core Testing Architecture

Tests operate under three distinct isolation boundaries:

| Surface | Isolation Boundary | Module / Source |
|---|---|---|
| **App State & Business Logic** | `withContext(fn)` | `@airlib/react` or `@airlib/solid` |
| **UI Components & DOM Views** | `withContext(fn)` + `@testing-library/react` | `@airlib/react` or `@airlib/solid` |
| **IRPC Backend Procedures** | `withContext(fn)` / `withContext(seed, fn)` | `@irpclib/irpc` |
| **Worker / Full-Stack HTTP** | Request boundary (`worker.fetch(req)`) | Application `worker.ts` |

### Mocking Boundary

Never mock application logic, stores, components, or IRPC procedures. When tests interact with external infrastructure, mock external I/O boundaries only (e.g., Postgres, Redis, external `fetch`, third-party APIs).

---

## Testing Applications

### Application State & Business Logic

Application stores (e.g. cart stores, authentication states, multi-step wizards) use AirLib reactive proxies. Because reactivity is synchronous, assertions execute immediately without timers or polling.

Wrap state tests in `withContext()` to prevent state leakage and global scope warnings:

```typescript
import { describe, expect, it } from 'vitest';
import { withContext } from '@airlib/react';
import { createCartStore } from '../src/stores/cart.js';

describe('CartStore', () => {
  it('updates items and calculates totals synchronously', () => {
    withContext(() => {
      const cart = createCartStore();

      cart.addItem({ id: 'prod-1', price: 50, quantity: 2 });
      expect(cart.totalItems).toBe(2);
      expect(cart.subtotal).toBe(100);

      cart.applyCoupon('DISCOUNT10');
      expect(cart.total).toBe(90);

      cart.removeItem('prod-1');
      expect(cart.totalItems).toBe(0);
      expect(cart.total).toBe(0);
    });
  });
});
```

---

### UI Components & User Interactions

Test application components using `@testing-library/react` (or `@testing-library/solid`) and `@testing-library/user-event`.

Wrap the test in `withContext()`. When asserting DOM changes resulting from state mutations or events, wrap the step in `act()` to flush React's internal microtask batching queue:

```typescript
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { withContext } from '@airlib/react';
import { AddToCartButton } from '../src/components/AddToCartButton.js';
import { createCartStore } from '../src/stores/cart.js';

describe('AddToCartButton Component', () => {
  it('increments item quantity upon click', async () => {
    await withContext(async () => {
      const user = userEvent.setup();
      const cart = createCartStore();

      render(<AddToCartButton cart={cart} item={{ id: 'prod-1', price: 20 }} />);

      const button = screen.getByRole('button', { name: /add to cart/i });
      await act(async () => {
        await user.click(button);
      });

      expect(cart.totalItems).toBe(1);
      expect(screen.getByText(/1 in cart/i)).toBeInTheDocument();
    });
  });
});
```

---

### IRPC Backend Procedures & Handlers

#### Colocated Handler Testing

For unit testing procedures in `pages/` or `src/api/`, import the procedure stub (`function.ts` or `index.ts`) and the handler (`constructor.ts`) in the same test file. This registers the handler locally without starting network servers.

Wrap procedure execution in `withContext(fn)` (or `withContext(seed, fn)` to seed context values). If the handler interacts with external services, mock only the external I/O boundary (such as a Postgres client or payment API):

```typescript
import { describe, expect, it, vi } from 'vitest';
import { withContext } from '@irpclib/irpc';
import { createOrder } from '../src/api/order/index.js';
import '../src/api/order/constructor.js';

// Mock external third-party package directly, never internal application files
vi.mock('postgres', () => ({
  default: vi.fn(() => vi.fn(async () => [{ id: 'ord-101', status: 'created' }])),
}));

describe('createOrder Procedure', () => {
  it('creates an order within an authenticated context', async () => {
    await withContext([['USER_ID', 'usr-789']], async () => {
      const order = await createOrder({ productId: 'prod-1', quantity: 2 });
      expect(order.userId).toBe('usr-789');
      expect(order.items).toHaveLength(1);
    });
  });

  it('rejects with expected error message on invalid quantity', async () => {
    await withContext([['USER_ID', 'usr-789']], async () => {
      await expect(
        createOrder({ productId: 'prod-1', quantity: 0 })
      ).rejects.toThrow('Quantity must be greater than zero');
    });
  });
});
```

---

### Route Lifecycle: Guards & Providers

Routes declared in `route.ts` attach security guards (`.guard()`) and data loaders (`.provide()`). Test route handlers in isolation by executing their guard or provider functions with mock request and route states:

```typescript
import { describe, expect, it } from 'vitest';
import { withContext } from '@irpclib/irpc';
import { adminGuard } from '../pages/admin/route.js';

describe('Admin Route Guard', () => {
  it('allows access for admin role', async () => {
    await withContext([['USER_ROLE', 'admin']], async () => {
      const allowed = await adminGuard();
      expect(allowed).toBe(true);
    });
  });

  it('rejects access for non-admin users', async () => {
    await withContext([['USER_ROLE', 'guest']], async () => {
      await expect(adminGuard()).rejects.toThrow('Access denied');
    });
  });
});
```

---

### Full Application Integration (RPC & Worker)

To test complete application flows (client stub dispatch -> transport serialization -> HTTP routing -> server handlers -> response deserialization) within a single test runner process:

1. Forward client `globalThis.fetch` to `worker.fetch(req)`.
2. Configure the IRPC module with `{ bypassLocal: true }` inside the client's `withContext()`.
3. Do NOT import server `constructor.js` files in the test; `worker.js` handles server execution.
4. Reset `{ bypassLocal: false }` in `afterEach()`.

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withContext } from '@irpclib/irpc';
import { checkoutRpc, checkout } from '../src/api/checkout/index.js';
import worker from '../src/worker.js';

describe('Checkout Integration Flow', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const req = new Request(input instanceof Request ? input : String(input), init);
      return worker.fetch(req);
    });
  });

  afterEach(() => {
    checkoutRpc.configure({ bypassLocal: false });
    vi.restoreAllMocks();
  });

  it('executes full round-trip checkout through worker HTTP pipeline', async () => {
    await withContext([['AUTH_TOKEN', 'valid-token']], async () => {
      checkoutRpc.configure({ bypassLocal: true });

      const result = await checkout({ cartId: 'cart-123', paymentMethod: 'card' });
      expect(result.status).toBe('completed');
    });
  });

  it('returns UnhandledCall (404) for routes not handled by worker', async () => {
    const response = await worker.fetch(new Request('http://localhost/unknown'));
    expect(response.status).toBe(404);
  });
});
```

---

## Testing Reusable Libraries

### Headless State Coordinators

Libraries frequently export headless state factories (e.g., table managers, form coordinators, query hooks). Test these logic controllers directly in `withContext()` without mounting UI components:

```typescript
import { describe, expect, it } from 'vitest';
import { withContext } from '@airlib/react';
import { createPaginationCoordinator } from '../src/index.js';

describe('createPaginationCoordinator (Headless Library)', () => {
  it('manages page bounds and offsets synchronously', () => {
    withContext(() => {
      const pager = createPaginationCoordinator({ totalItems: 100, pageSize: 10 });

      expect(pager.currentPage).toBe(1);
      expect(pager.totalPages).toBe(10);

      pager.nextPage();
      expect(pager.currentPage).toBe(2);
      expect(pager.offset).toBe(10);

      pager.goToPage(10);
      pager.nextPage();
      expect(pager.currentPage).toBe(10); // Clamped to bounds
    });
  });
});
```

---

### Pluggable Drivers & Adapters

When authoring modular libraries with the `IRPCAdapter` and `IRPCDriver` patterns, test driver implementations against the adapter's dispatch contract using `withContext()`:

```typescript
import { describe, expect, it } from 'vitest';
import { withContext } from '@irpclib/irpc';
import { PaymentAdapter } from '../src/adapter.js';
import { StripeDriver } from '../src/drivers/stripe/index.js';

describe('StripeDriver Implementation', () => {
  it('processes charges through adapter dispatch', async () => {
    await withContext([['STRIPE_API_KEY', 'sk_test_mock']], async () => {
      const adapter = new PaymentAdapter();
      adapter.use(new StripeDriver());

      const result = await adapter.charge({ amount: 2500, currency: 'usd' });
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
    });
  });
});
```

---

### Side-Effect Isolation Testing

To verify that importing client entrypoints (`index.ts`) does not register server handlers or execute server constructors, assert that calling the stub dispatches to `fetch`. If a handler was accidentally registered locally, the call would be intercepted without firing `fetch`.

```typescript
import { describe, expect, it, vi } from 'vitest';
import { withContext } from '@irpclib/irpc';
import { chat } from '../src/index.js';

describe('Library Client Entry Isolation', () => {
  it('dispatches to fetch because no local handler is registered', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ text: 'mock response' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await withContext(async () => {
      await chat(['Hello']);
    });

    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
```

---

## Summary Checklist

| Task | Pattern |
|---|---|
| **App State Models** | Wrap in `withContext(() => { ... })`; assert synchronously. |
| **Component Views** | Wrap in `await withContext(async () => { ... })`; use `@testing-library/react` and `act()`. |
| **Colocated IRPC Unit Tests** | Import stub + constructor locally; wrap in `withContext(fn)` or `withContext(seed, fn)`. |
| **Error Handling** | Assert descriptive error messages via `expect(...).rejects.toThrow('Message')`. |
| **Worker Integration Tests** | Call `worker.fetch(req)` directly; request context is isolated automatically. |
| **Full RPC Integration** | Set `module.configure({ bypassLocal: true })` inside client `withContext()`; forward `globalThis.fetch` to `worker.fetch`. |
| **Driver Implementations** | Instantiate adapter and driver inside `withContext(seed, fn)` or `withContext(store, fn)`. |
| **External I/O (Postgres, fetch)** | Mock only external boundaries (`vi.mock()`, `vi.spyOn()`); run real application logic. |
| **Library Client Exports** | Spy on `fetch`; assert calling the stub triggers `fetch` (confirming no local handler interception). |
