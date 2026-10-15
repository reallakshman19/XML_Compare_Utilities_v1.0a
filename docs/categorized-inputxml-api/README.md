# CategorizedInputXML API Service

Service-only JavaScript API for validation, inspection, deterministic serialization and strict source-evidence export of XML Compare `CategorizedInputXML` documents.

## Public entrypoint

```text
xml-compare/categorized-inputxml-api/index.js
```

## Explicitly not included

- UI or DOM integration;
- HTTP routes;
- worker execution;
- local/session storage;
- InputXML mutation or normalized-block reconciliation;
- CII conversion;
- existing XML Compare runtime changes.

See `api-contract-v1.md` for request, result and diagnostic behavior.
