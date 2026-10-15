# InputXML Producer Worker Adapter Audit

Date: 2026-07-14
Base: `main` at `17b78713dd5762d49407108af2ec0440f91bb85e`

## Scope

This Work Pack exposes the existing `InputXML → CategorizedInputXML` converter through the merged browser-worker transport.

It does not integrate or switch any producer module. It does not add UI, HTTP, storage, CII conversion, Pyodide, InputXML mutation, or normalized reconciliation.

## Existing authority

The existing authority remains:

```text
xml-compare/CategorizedInputXmlConverter.js
  inputXmlToCategorizedInputXml()
```

The converter emits:

```xml
<CategorizedInputXML schema="categorized-inputxml/v3" ...>
```

The existing worker exposes categorized-document and change-set operations only. It cannot currently accept raw InputXML.

## Missing boundary

The missing transport path is:

```text
producer-generated InputXML
→ producer request envelope
→ InputXML validation
→ inputXmlToCategorizedInputXml()
→ CategorizedInputXmlService.v1 validation
→ producer-tagged categorized artifact
```

## New operation

```text
producer.categorizeInputXml
```

Protocol remains:

```text
categorized-inputxml-worker/v1
```

Worker implementation version advances from `1.0.0` to `1.1.0`.

## Request authority

The operation requires:

```text
producer.id
source.filename
source.content
```

Optional producer trace fields:

```text
producer.repository
producer.module
producer.operation
producer.version
producer.artifactRole
```

The service must calculate source and output fingerprints. Callers may not supply authoritative fingerprints.

## Input validation

The producer adapter must reject:

- empty content;
- missing producer identity;
- non-`CAESARII` root;
- missing or non-Input `XML_TYPE`;
- missing `PIPINGMODEL`;
- zero `PIPINGELEMENT` records.

The adapter does not infer, repair, enrich, or mutate the supplied InputXML.

## Output contract

Successful output includes:

```text
InputXmlProducerCategorizeResult.v1
producer descriptor
source descriptor and fingerprint
categorized artifact and fingerprint
InputXML element count
categorized line/element/node summary
CategorizedInputXmlService.v1 validation evidence
```

Artifact role:

```text
categorized-review-document
```

The output is a review/transfer representation, not a replacement engineering source model.

## Failure contract

Engineering/input validation failures return a structured unsuccessful result with `artifact: null`.

Protocol, queue, runtime, and unexpected thrown failures remain worker failure envelopes.

## Explicit exclusions

- no XML Compare sideload adoption;
- no InputXML Workspace adoption;
- no Workbench3D adoption;
- no `3D_Converters` integration;
- no CII sidecar integration;
- no UI or event wiring;
- no producer runtime switch;
- no converter rewrite;
- no changes to CategorizedInputXML or InputXmlChangeSet service semantics.

## Acceptance

The Work Pack is complete when tests prove:

- valid InputXML is categorized through the worker;
- producer metadata and fingerprints are retained;
- generated v3 output passes the existing categorized service validator;
- invalid InputXML returns structured diagnostics and no artifact;
- the worker advertises and dispatches the new operation;
- existing nine worker operations remain unchanged;
- all new JavaScript modules remain below 300 lines;
- functions remain below 40 lines where practical;
- named exports only;
- the full repository test suite remains green.
