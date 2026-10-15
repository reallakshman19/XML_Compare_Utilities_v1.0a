# InputXmlChangeSet.v1 Reconciliation API

Service-only API for deriving, validating and applying approved changes from XML Compare `CategorizedInputXML` to embedded InputXML source evidence.

## Public entrypoint

```text
xml-compare/inputxml-changeset-api/index.js
```

## Authority rule

```text
normalized categorized blocks
→ explicit InputXmlChangeSet.v1
→ explicit approvals
→ synchronized OriginalElement evidence
→ validated reconciled InputXML
```

No normalized change is authoritative until it appears in an approved change set and passes application preconditions and output validation.

See `api-contract-v1.md` for the request, change, receipt and artifact contracts.
