# InputXML Producer Worker Adapter Evidence

Date: 2026-07-14
Base: `17b78713dd5762d49407108af2ec0440f91bb85e`
Validated cleaned candidate: `8b291aa78d2daae02fec861bfe49ae634d27abe6`
Pull request: #290

## Delivered operation

```text
producer.categorizeInputXml
```

Worker protocol remains:

```text
categorized-inputxml-worker/v1
```

Worker implementation version:

```text
1.1.0
```

## Delivered path

```text
producer-generated InputXML
→ InputXmlProducerCategorizeRequest.v1
→ InputXML structural validation
→ existing inputXmlToCategorizedInputXml()
→ CategorizedInputXmlService.v1 require-v3 validation
→ InputXmlProducerCategorizeResult.v1
```

## Trace evidence

Successful results retain:

- producer ID;
- repository;
- module;
- operation;
- producer version;
- source artifact role;
- source filename;
- calculated source fingerprint;
- calculated categorized artifact fingerprint;
- InputXML element count;
- categorized line, element and node counts;
- categorized service validation evidence.

The output artifact role is:

```text
categorized-review-document
```

## Failure evidence

The focused tests prove structured failures with `artifact: null` for:

- missing producer identity;
- empty InputXML;
- invalid root;
- non-Input XML type;
- missing piping model;
- zero piping elements.

Engineering failures remain successful transport envelopes containing an unsuccessful service result. Protocol and runtime failures remain failed worker envelopes.

## End-to-end proof

The worker integration test now starts with raw InputXML rather than importing the converter directly:

```text
raw InputXML
→ client.producer.categorizeInputXml()
→ categorized validation
→ normalized DELTA_X review change
→ change-set derivation
→ explicit approval
→ reconciled InputXML
```

The test confirms preservation of bend and restraint source evidence.

## Work Pack boundaries

- no XML Compare sideload adoption;
- no InputXML Workspace adoption;
- no Workbench3D adoption;
- no `3D_Converters` adoption;
- no CII sidecar adoption;
- no UI, HTTP, storage, Pyodide or CII conversion;
- no InputXML mutation, repair or enrichment;
- existing converter and merged service directories remain protected.

## Source quality

- 18 substantive changed files after transient cleanup;
- new production modules: 19–208 lines;
- worker client remains below 300 lines;
- named exports only;
- checked functions and class methods remain at or below 40 lines;
- no UI, storage, network, Pyodide or CII runtime coupling.

## Validation

Cleaned candidate workflow results:

- CategorizedInputXML Worker Transport run `29320231379`: passed;
- XML Compare Utilities run `29320231334`: passed;
- Pages semantic validation run `29320231272`: passed.

The dedicated run passed:

- diff scope and protected-path checks;
- JavaScript syntax;
- module and function size checks;
- standalone producer adapter tests;
- ten-operation protocol and dispatcher tests;
- runtime cancellation tests;
- raw InputXML worker integration;
- client lifecycle tests;
- full repository `npm test`.
