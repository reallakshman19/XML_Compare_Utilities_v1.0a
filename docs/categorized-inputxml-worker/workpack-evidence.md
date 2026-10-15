# CategorizedInputXML Browser Worker Work Pack Evidence

Date: 2026-07-14
Synchronized base: `fcfb11d1fe537e5177a4bb9982641758db7e4c34`
Validated candidate before evidence: `9fbe0ce5127b6d123956787b5b30d7c9d76559fd`
Pull request: #286
Synchronization pull request: #287

## Delivered transport

```text
browser client
→ CategorizedInputXmlWorkerRequest.v1
→ queued worker runtime
→ operation dispatcher
→ CategorizedInputXmlService.v1 / InputXmlChangeSetService.v1
→ CategorizedInputXmlWorkerResponse.v1
```

Protocol:

```text
categorized-inputxml-worker/v1
```

Supported operations:

```text
categorized.capabilities
categorized.validate
categorized.inspect
categorized.serialize
categorized.exportSourceInputXml
changeset.capabilities
changeset.derive
changeset.validate
changeset.apply
```

## Transport behavior

- request/response correlation by explicit request ID;
- module-worker construction;
- duplicate request-ID rejection in the client and runtime;
- structured-clone-safe error responses without stack traces;
- queued operation ownership and runtime disposal;
- client abort, timeout, close and optional worker termination;
- cooperative queued/asynchronous cancellation;
- deterministic suppression of late responses after client rejection;
- inline-text artifact transport through structured clone;
- no streaming or transferable artifact buffers in v1.

## Cancellation boundary

The service implementations remain synchronous JavaScript. A cancel message cannot pre-empt a synchronous operation that is already executing in the worker event loop.

The implemented contract proves:

- cancellation before queued dispatch;
- cancellation while awaiting an asynchronous dispatcher result;
- immediate client rejection for `AbortSignal` and timeout;
- cancellation messages emitted by the client;
- late worker results ignored after local cancellation;
- no conversion of cancellation or failure into successful service results.

## End-to-end evidence

A real InputXML fixture is converted to `CategorizedInputXML`, edited in its normalized `DELTA_X`, and passed through the worker client.

The test proves:

```text
categorized capabilities
categorized validation
categorized inspection
categorized serialization
source-evidence InputXML export
change-set capabilities
change-set derivation
change-set validation
approved change-set application
```

It confirms:

- normalized/source divergence remains visible;
- source-evidence export retains the original `DELTA_X`;
- approved reconciliation updates `DELTA_X` in reconciled InputXML;
- bend evidence is preserved;
- restraint evidence is preserved;
- reconciliation receipt is returned;
- client and runtime queues are empty after completion.

## Source guards

- Work Pack is additive and limited to worker, tests, workflow and documentation paths;
- existing categorized and change-set service directories are byte-unchanged;
- production modules are 5–244 lines, below the 300-line limit;
- named exports only;
- identified top-level functions and class methods remain at or below 40 lines;
- no UI/tab or converter-runtime imports;
- no DOM, storage, network, XMLHttpRequest or Pyodide calls;
- no UI, HTTP, storage, CII conversion or runtime switch.

## Validation

Synchronized candidate run `29313790183` passed:

- Work Pack diff scope;
- existing service path protection;
- JavaScript syntax;
- structure and isolation checks;
- protocol and dispatcher tests;
- runtime queue, error and cancellation tests;
- browser-client lifecycle tests;
- real worker/service integration;
- full repository `npm test`.

Standard `XML Compare Utilities` run `29313790182` passed.

Pages semantic validation run `29313790226` passed.

The synchronized branch was ahead of `main` and behind by zero commits before this evidence commit.
