# CategorizedInputXML Browser Worker Transport Audit

Date: 2026-07-14
Base: `main` at `8d6d9cb2d955818c5c320b1b10a48f1b3d8eee40`

## Scope

This Work Pack adds a browser-worker transport around the two merged, transport-neutral services:

- `CategorizedInputXmlService.v1`
- `InputXmlChangeSetService.v1`

It does not add UI controls, HTTP routes, storage, CII conversion, runtime switching, or edits to either service implementation.

## Target boundary

```text
browser client
→ CategorizedInputXmlWorkerRequest.v1
→ queued worker runtime
→ operation dispatcher
→ existing service operation
→ CategorizedInputXmlWorkerResponse.v1
```

## Required operations

Categorized document service:

```text
categorized.capabilities
categorized.validate
categorized.inspect
categorized.serialize
categorized.exportSourceInputXml
```

Change-set reconciliation service:

```text
changeset.capabilities
changeset.derive
changeset.validate
changeset.apply
```

## Transport responsibilities

The worker layer owns only:

- request/response correlation;
- protocol validation;
- operation dispatch;
- structured error envelopes;
- queue state;
- duplicate-request protection;
- cooperative cancellation;
- client abort and timeout behavior;
- lifecycle cleanup.

It does not reinterpret service results or engineering semantics.

## Cancellation policy

The underlying services are synchronous pure JavaScript operations. A browser worker cannot process a new cancel message while a synchronous operation is actively executing.

The v1 contract therefore provides cooperative cancellation:

- queued requests can be cancelled before dispatch;
- asynchronous dispatch results are suppressed when cancellation arrives before completion;
- the browser client rejects immediately on `AbortSignal` or timeout and ignores late responses;
- cancellation never converts a failed service result into success.

## Error policy

Worker failures use a structured-clone-safe error object:

```text
code
message
operation
retryable
causeName
```

Raw `Error` objects and stack traces are not transferred as the public contract.

## Explicit exclusions

- no DOM or tab imports;
- no local/session storage;
- no network calls;
- no UI event wiring;
- no HTTP API;
- no Pyodide or Python worker;
- no CII conversion;
- no changes to existing service modules;
- no default exports, hidden mocks, shims, snapshots, or broad refactors.

## Acceptance

The Work Pack is complete when tests prove:

- every advertised operation reaches the correct service method;
- envelopes are versioned and validated;
- unknown operations and thrown errors return structured failures;
- duplicate request IDs are rejected;
- queued cancellation returns `REQUEST_CANCELLED`;
- client abort, timeout, close, and late-response suppression are deterministic;
- a real categorized document can be inspected, reconciled, and exported through the worker client;
- all new JavaScript modules remain under 300 lines and use named exports;
- functions remain under 40 lines where practical;
- existing service files remain byte-unchanged;
- the full repository test suite remains green.
