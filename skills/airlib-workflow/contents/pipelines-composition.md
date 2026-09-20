# Workflow Planning & Composition

This guide establishes the conventions for building, chaining, and composing sequential asynchronous execution pipelines using AirLib Workflows.

---

## Initializing Sequential Pipelines

Use `plan()` to initialize an executable pipeline. Sequential steps are chained with `.then()`, where each step receives the accumulated output of the preceding step:

```typescript
import { plan } from '@irpclib/irpc';

const checkoutFlow = plan<{ cartId: string; userId: string }>()
  .then(async (input) => {
    const cart = await db.carts.findById(input.cartId);
    return { ...input, cart };
  })
  .then(async (input) => {
    const payment = await stripe.charge(input.cart.total, input.userId);
    return { ...input, paymentId: payment.id };
  });

irpc.construct(checkout, (cartId, userId) => {
  return checkoutFlow({ cartId, userId });
});
```

---

## Component Integration

To trigger workflows on user events and track execution status in UI components, use `.later()`:

#### React
```tsx
import { setup } from '@airlib/react';
import { checkout } from './function.js';

export const CheckoutButton = setup((props: { cartId: string; userId: string }) => {
  const task = checkout.later();

  return () => (
    <button
      onClick={() => task.dispatch(props.cartId, props.userId)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Processing...' : 'Checkout'}
    </button>
  );
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { checkout } from './function.js';

export const CheckoutButton = setup((props: { cartId: string; userId: string }) => {
  const task = checkout.later();

  return () => (
    <button
      onClick={() => task.dispatch(props.cartId, props.userId)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Processing...' : 'Checkout'}
    </button>
  );
});
```

---

## Reusing and Extending Base Pipelines

When multiple workflows share common preliminary steps (such as token validation, permissions checks, or tenant resolution), define a base pipeline once and pass it to `plan()` to create independent, extended instances without duplicating logic:

```typescript
import { plan } from '@irpclib/irpc';

// 1. Define the shared authentication base
const authenticatedBase = plan<{ token: string }>()
  .then(async (input) => {
    const user = await verifyToken(input.token);
    return { user };
  });

// 2. Clone and extend safely for specific routes
const adminFlow = plan(authenticatedBase)
  .then((input) => {
    if (input.user.role !== 'admin') throw new Error('Unauthorized');
    return input;
  });

const userFlow = plan(authenticatedBase)
  .then((input) => {
    return { data: 'User Data' };
  });

irpc.construct(getAdminData, (token) => adminFlow({ token }));
irpc.construct(getUserData, (token) => userFlow({ token }));
```

#### React
```tsx
import { setup } from '@airlib/react';
import { getAdminData } from './function.js';

export const AdminPanel = setup((props: { token: string }) => {
  const task = getAdminData.later();

  return () => (
    <button
      onClick={() => task.dispatch(props.token)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Loading...' : 'Load Admin Data'}
    </button>
  );
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { getAdminData } from './function.js';

export const AdminPanel = setup((props: { token: string }) => {
  const task = getAdminData.later();

  return () => (
    <button
      onClick={() => task.dispatch(props.token)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Loading...' : 'Load Admin Data'}
    </button>
  );
});
```
