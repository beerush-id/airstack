# Workflow Observability & Monitoring

This guide establishes how to monitor execution states globally, subscribe to telemetry events, and build reactive admin dashboards without manual instrumentation in AirLib Workflows.

---

## Centralized Event Observation (`WORKFLOW_STORE`)

AirLib pipelines are inherently observable. The centralized `WORKFLOW_STORE` tracks all registered workflows, individual steps, and active executions without requiring explicit developer instrumentation inside business logic.

---

## Telemetry and External Logging

To forward execution events, durations, or failures to monitoring services (like Datadog, Sentry, or custom sinks), subscribe to `WORKFLOW_STORE`:

#### React
```typescript
import { WORKFLOW_STORE } from '@airlib/react';

WORKFLOW_STORE.subscribe((event) => {
  if (event.type === 'DEQUEUE_WORKFLOW') {
    if (event.error) {
      Datadog.logError(`Workflow ${event.instance.id} failed`, event.error);
    } else {
      Datadog.logSuccess(`Workflow ${event.instance.id} completed`, event.output);
    }
  }
});
```

#### SolidJS
```typescript
import { WORKFLOW_STORE } from '@airlib/solid';

WORKFLOW_STORE.subscribe((event) => {
  if (event.type === 'DEQUEUE_WORKFLOW') {
    if (event.error) {
      Datadog.logError(`Workflow ${event.instance.id} failed`, event.error);
    } else {
      Datadog.logSuccess(`Workflow ${event.instance.id} completed`, event.output);
    }
  }
});
```

---

## Dashboard Integration

`WORKFLOW_STORE` exposes reactive collections built on AirLib's `mutable` primitive. Admin dashboards can read `workflows.size`, `steps.size`, and `runningWorkflows.size` directly in templates without manual synchronization:

#### React
```tsx
import { setup, WORKFLOW_STORE } from '@airlib/react';

export const WorkflowDashboard = setup(() => {
  const { workflows, steps, runningWorkflows } = WORKFLOW_STORE;

  return () => (
    <div className="dashboard-stats">
      <span>Total Workflows: {workflows.size}</span>
      <span>Total Steps: {steps.size}</span>
      <span>Active Jobs: {runningWorkflows.size}</span>
    </div>
  );
});
```

#### SolidJS
```tsx
import { setup, WORKFLOW_STORE } from '@airlib/solid';

export const WorkflowDashboard = setup(() => {
  const { workflows, steps, runningWorkflows } = WORKFLOW_STORE;

  return (
    <div class="dashboard-stats">
      <span>Total Workflows: {workflows.size}</span>
      <span>Total Steps: {steps.size}</span>
      <span>Active Jobs: {runningWorkflows.size}</span>
    </div>
  );
});
```
