# Workflow Branching Logic

This guide establishes declarative conditional routing in AirLib Workflows using `.switch()`, replacing deeply nested `if/else` statements with isolated, type-safe execution branches.

---

## 1. Key-Based Branching

When routing execution based on a known property value, pass the property key to `.switch()`. Each route receives an isolated branch builder:

```typescript
import { plan } from '@irpclib/irpc';

const paymentFlow = plan<{ method: 'card' | 'paypal'; amount: number }>()
  .switch('method', {
    card: (resolve) => resolve((input) => processCard(input.amount)),
    paypal: (resolve) => resolve((input) => processPaypal(input.amount)),
    default: (resolve) => resolve(() => { throw new Error('Invalid method'); }),
  });

irpc.construct(processPayment, (method, amount) => {
  return paymentFlow({ method, amount });
});
```

#### React
```tsx
import { setup } from '@airlib/react';
import { processPayment } from './function.js';

export const PaymentForm = setup(() => {
  const task = processPayment.later();

  return () => (
    <button
      onClick={() => task.dispatch('card', 100)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Processing...' : 'Pay Now'}
    </button>
  );
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { processPayment } from './function.js';

export const PaymentForm = setup(() => {
  const task = processPayment.later();

  return () => (
    <button
      onClick={() => task.dispatch('card', 100)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Processing...' : 'Pay Now'}
    </button>
  );
});
```

---

## 2. Matcher Function Branching

When routing requires asynchronous queries or complex evaluation across multiple fields, supply a synchronous or asynchronous matcher function:

```typescript
import { plan } from '@irpclib/irpc';

const riskAssessmentFlow = plan<{ userId: string }>()
  .switch(
    async (input) => {
      const score = await getRiskScore(input.userId);
      return score > 90 ? 'high' : 'low';
    },
    {
      high: (resolve) => resolve(() => flagForReview()),
      low: (resolve) => resolve(() => approveInstantly()),
    }
  );

irpc.construct(assessRisk, (userId) => riskAssessmentFlow({ userId }));
```

#### React
```tsx
import { setup } from '@airlib/react';
import { assessRisk } from './function.js';

export const RiskPanel = setup((props: { userId: string }) => {
  const task = assessRisk.later();

  return () => (
    <button
      onClick={() => task.dispatch(props.userId)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Assessing...' : 'Assess Risk'}
    </button>
  );
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { assessRisk } from './function.js';

export const RiskPanel = setup((props: { userId: string }) => {
  const task = assessRisk.later();

  return () => (
    <button
      onClick={() => task.dispatch(props.userId)}
      disabled={task.status === 'pending'}
    >
      {task.status === 'pending' ? 'Assessing...' : 'Assess Risk'}
    </button>
  );
});
```
