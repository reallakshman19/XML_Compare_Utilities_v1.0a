# CategorizedInputXML API Service Audit

Date: 2026-07-14
Base: `main` at `055d064a41196ca29203c51daa9314d30f7cd0f2`

## Scope

This Work Pack adds a service-only JavaScript API for the XML Compare `CategorizedInputXML` document. It does not add UI, HTTP, worker, CII conversion, runtime switching, or InputXML mutation.

## Existing format

The generated XML Compare artifact uses:

```xml
<CategorizedInputXML schema="categorized-inputxml/v3">
  <Line id="...">
    <LineBlock>...</LineBlock>
    <LineBlocks>...</LineBlocks>
    <Element fromNode="..." toNode="..." elementKey="...">
      ... categorized blocks ...
      <NodesBlock>...</NodesBlock>
      <OriginalElement><![CDATA[<PIPINGELEMENT .../>]]></OriginalElement>
    </Element>
  </Line>
</CategorizedInputXML>
```

Relevant existing modules:

- `xml-compare/CategorizedInputXmlConverter.js`
- `xml-compare/XmlCompareCategorizedXmlTree.js`
- `xml-compare/XmlCompareTransferPatchEngine.js`
- `xml-compare/XmlCompareLinewiseWorkspaceModel.js`

## Authority finding

The document contains two representations:

1. normalized categorized blocks used for comparison and transfer;
2. embedded `OriginalElement` InputXML evidence used by reverse conversion.

These representations can diverge. Existing reverse conversion primarily restores `OriginalElement` evidence and therefore does not prove that normalized block edits were applied to InputXML.

## Service boundary

The new service will expose only named, request-scoped functions:

- capabilities;
- validation;
- inspection and summary;
- deterministic tree serialization;
- strict source-evidence InputXML export.

The service will diagnose:

- invalid root/schema;
- missing or duplicate line/element/node identities;
- missing or duplicate `OriginalElement` evidence;
- line, node and selected engineering-field divergence;
- derived coordinate evidence not present in the source element;
- extension blocks outside the generated v3 taxonomy;
- source-export readiness.

## Explicit exclusions

- no normalized-block-to-InputXML reconciliation or mutation;
- no CII writer or converter call;
- no UI, DOM, storage, event, worker or HTTP code;
- no edits to current XML Compare runtime modules;
- no fallback that strips the categorized wrapper when source evidence is absent;
- no default exports, mocks, shims, snapshot churn or broad refactor.

## Compatibility policy

The existing parser, serializer and reverse converter remain unchanged. The service may use them as adapters, but must wrap source export with stricter readiness checks so missing evidence fails explicitly.

## Acceptance

The Work Pack is complete when focused tests prove:

- generated v3 documents validate and summarize deterministically;
- normalized/source divergence is visible;
- extension blocks are retained and diagnosed;
- strict source export succeeds only when every element has one usable `OriginalElement`;
- serialization is deterministic;
- all new JavaScript modules remain below 300 lines, use named exports and contain no function above 40 lines where practical;
- the full repository test suite remains green.
