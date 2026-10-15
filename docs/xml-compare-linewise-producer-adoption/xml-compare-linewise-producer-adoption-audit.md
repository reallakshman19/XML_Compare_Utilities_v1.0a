# XML Compare Line-wise Sideload Producer Adoption Audit

Date: 2026-07-14
Base: `main` at `4b2290670b0bf5886630d18af9d359ee1b45a4c9`

## Scope

This Work Pack integrates the XML Compare tab's native **Line-wise XML Enrichment / Categorized XML** sideload path with the merged browser-worker operation:

```text
producer.categorizeInputXml
```

It does not change sideload matching, XML mutation, enrichment, restraint/coordinate logic, worker protocol, producer service semantics, InputXML reconciliation, CII conversion, InputXML Workspace, Workbench3D, or either `3D_Converters` producer.

## Previous runtime

The pre-adoption path was:

```text
XmlCompareLinewiseWorkflowActions.applyLinewiseSideload()
→ applyXmlCompareSideload()
→ enriched InputXML stored in workflow state
→ ensureCategorized()
→ direct inputXmlToCategorizedInputXml() call on the UI thread
```

The XML Compare tab click handler called `applyLinewiseSideload()` synchronously. Categorized preview, export and canvas loading then called `ensureCategorized()`, which invoked the converter directly.

## Adoption problem

The producer API and worker transport were available, but this runtime did not invoke them. The line-wise module therefore lacked:

- producer identity and repository/module/operation trace;
- source and categorized fingerprints;
- producer-service InputXML validation;
- categorized-service validation receipt;
- worker cancellation/timeout/error boundary;
- explicit distinction between sideload success and categorization success.

## Delivered boundary

```text
existing applyXmlCompareSideload()
→ unchanged enriched InputXML
→ client.producer.categorizeInputXml()
→ producer receipt + categorized-review-document
→ preview/export/canvas
```

## Authority rules

1. `applyXmlCompareSideload()` remains the only sideload mutation authority.
2. `InputXmlProducerService.v1` validates and categorizes the post-sideload InputXML.
3. The worker transport owns asynchronous execution only.
4. The categorized artifact returned by the worker becomes the categorized preview/export/canvas artifact for that sideload run.
5. A worker or producer validation failure never removes or alters the enriched InputXML result.
6. After a sideload run, categorized actions never silently fall back to direct UI-thread categorization when the worker receipt is missing, stale, running or failed.
7. Direct categorization remains available for ordinary imported InputXML that has not entered the sideload adoption path.
8. `XmlCompareLinewiseWorkflowActions.js` and `XmlCompareLinewiseWorkflowState.js` remain producer-agnostic and unchanged.

## Adapter-owned state

The XML Compare tab owns a separate immutable adapter state:

```text
linewiseProducerAdoption.status
linewiseProducerAdoption.sourceFingerprint
linewiseProducerAdoption.result
linewiseProducerAdoption.error
```

Statuses:

```text
idle
running
success
failed
```

The source fingerprint binds a worker receipt to the exact `lastEnriched` InputXML bytes. A mismatched receipt cannot authorize categorized preview, export or canvas loading.

The tab also owns:

```text
linewiseWorkerClient
linewiseProducerAbort
```

This avoids adding transport concerns to the protected line-wise workflow model.

## UI behavior

The sideload and preview/canvas surfaces show:

- worker status;
- producer ID;
- source fingerprint;
- categorized fingerprint;
- source and categorized element counts;
- error/diagnostic summary;
- downloadable producer receipt JSON.

Categorized preview/export/canvas actions are blocked while the current sideload output has no matching successful receipt. Enriched/InputXML preview and export remain available.

Editing sideload inputs invalidates the adapter receipt until the user applies sideload again.

## Lifecycle

The XML Compare tab owns one lazy worker client. Superseded requests are aborted. The worker client is closed and terminated when the tab cleanup function runs.

## Explicit exclusions

- no changes to `XmlCompareSideloadEnricher.js` or its helper modules;
- no changes to `XmlCompareLinewiseWorkflowActions.js` or `XmlCompareLinewiseWorkflowState.js`;
- no changes to worker/service/converter implementation;
- no automatic `InputXmlChangeSet` derivation or application;
- no UI for approval/reconciliation;
- no HTTP, storage, Pyodide or CII call;
- no adoption by InputXML Workspace or other producers;
- no broad XML Compare tab refactor.

## Verification

Permanent workflow `XML Compare Line-wise Producer Adoption` proves:

- protected line-wise engine and sideload authority files are unchanged;
- sideload output bytes are identical before and after worker adoption;
- the worker receives the enriched InputXML and XML Compare producer trace;
- successful worker categorization becomes the preview/export/canvas artifact;
- worker validation and transport failures preserve enriched InputXML and block categorized actions;
- stale fingerprints cannot authorize categorized output;
- producer receipt JSON is available;
- the worker client is lazily created and closed with the tab lifecycle;
- direct non-sideload categorization remains compatible;
- JavaScript syntax and shared sideload/worker regressions pass;
- the full repository suite remains green.
