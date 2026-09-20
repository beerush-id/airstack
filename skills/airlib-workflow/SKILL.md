---
name: airlib-workflow
description: Use when orchestrating multi-step asynchronous pipelines, sequential executions, conditional branching, error recovery, reactive stepper UI bindings, or global pipeline monitoring in an AirLib project
---

# AirLib Workflow Router

The orchestration guide for asynchronous execution pipelines built with **AirLib Workflows**.

IMPORTANT: Read only what you need. Match your architectural concern to the decision matrix below, then read only the corresponding topic guide in `contents/`. Do not load all files into context.

---

## Workflow Decision Matrix: What are you building?

| What architectural concern are you addressing? | Topic Guide to Read |
|---|---|
| **"How do I define sequential async pipelines, chain steps, or inherit/extend a base pipeline?"** | [contents/pipelines-composition.md](./contents/pipelines-composition.md) |
| **"How do I trap step failures, supply fallback data to resume execution, or guarantee cleanup?"** | [contents/errors-recovery.md](./contents/errors-recovery.md) |
| **"How do I route logic conditionally into isolated execution branches without nested if/else trees?"** | [contents/branching-switch.md](./contents/branching-switch.md) |
| **"How do I bind pipelines to reactive UI state, show step progress, build wizards, or persist across reloads?"** | [contents/reactive-stepper.md](./contents/reactive-stepper.md) |
| **"How do I enforce strict type-safe data boundaries using Zod, Valibot, or step output schemas?"** | [contents/schema-validation.md](./contents/schema-validation.md) |
| **"How do I capture global telemetry, log pipeline errors, or build live admin monitoring dashboards?"** | [contents/observability-monitoring.md](./contents/observability-monitoring.md) |

---

## Symbol & Code Lookup

Saw an unfamiliar symbol, method, or property in workflow code? Look it up here to find the relevant guide:

| Symbol / Keyword Seen in Code | Topic Guide to Read |
|---|---|
| `plan`, `plan<Input>()`, `plan(baseFlow)`, `.then()`, `irpc.construct` | [contents/pipelines-composition.md](./contents/pipelines-composition.md) |
| `.catch((err, originalInput) => ...)`, `.finally((input, error) => ...)` | [contents/errors-recovery.md](./contents/errors-recovery.md) |
| `.switch(key, branches)`, `.switch(matcher, branches)`, `resolve((input) => ...)` | [contents/branching-switch.md](./contents/branching-switch.md) |
| `WorkflowStepper`, `.once()`, `.with()`, `.when()`, `.later()`, `dispatch()`, `step()`, `run()`, `snapshot()`, `hydrate()` | [contents/reactive-stepper.md](./contents/reactive-stepper.md) |
| `plan({ input, output })`, `.then(fn, { output })` | [contents/schema-validation.md](./contents/schema-validation.md) |
| `WORKFLOW_STORE`, `WORKFLOW_STORE.subscribe`, `DEQUEUE_WORKFLOW`, `workflows.size`, `steps.size`, `runningWorkflows.size` | [contents/observability-monitoring.md](./contents/observability-monitoring.md) |

---

## Questions & Tasks Covered by Each Topic

### 1. [Pipelines & Composition](./contents/pipelines-composition.md)
Load this topic when you need to answer:
- How do I structure and execute a multi-step asynchronous process?
- How do I pass intermediate results from one operation to the next without shared mutable state?
- How do I reuse common setup steps (like token verification) across multiple distinct workflows?
- How do I expose an asynchronous workflow over an API endpoint?
- How do I trigger and await workflows from user interface components?

### 2. [Errors & Recovery](./contents/errors-recovery.md)
Load this topic when you need to answer:
- What happens to downstream operations when an intermediate step in a pipeline fails?
- How do I intercept failures and supply fallback data so subsequent steps can continue?
- How do I access original request parameters during failure recovery?
- How do I guarantee resource cleanup (like releasing file locks) regardless of success or failure?

### 3. [Branching Logic](./contents/branching-switch.md)
Load this topic when you need to answer:
- How do I execute different business logic paths based on input payload properties without nested conditionals?
- How do I handle unexpected input values with a default fallback branch?
- How do I determine execution paths using dynamic or asynchronous conditions?
- How do I keep conditional execution logic isolated across branches?

### 4. [Reactive Steppers & UI Bindings](./contents/reactive-stepper.md)
Load this topic when you need to answer:
- How do I display live progress and step names in the UI while a background task runs?
- How do I automatically re-run a pipeline when reactive input state changes?
- How do I debounce user keystrokes before triggering an asynchronous pipeline?
- How do I defer execution until a user explicitly clicks a button or triggers an event?
- How do I build multi-step wizard forms that advance one step at a time?
- How do I resume interrupted workflows or wizards after a page refresh or browser crash?

### 5. [Schema Validation](./contents/schema-validation.md)
Load this topic when you need to answer:
- How do I enforce strict runtime type boundaries on workflow inputs and outputs?
- How do I automatically apply default values to incoming workflow parameters?
- How do I validate intermediate step outputs to prevent corrupted state from propagating?

### 6. [Observability & Monitoring](./contents/observability-monitoring.md)
Load this topic when you need to answer:
- How do I monitor and trace all executing workflows across the application?
- How do I export execution metrics, durations, and uncaught errors to external logging backends?
- How do I build live administrative dashboards showing active and completed pipeline counts?
