# InputXmlChangeSetService.v1

## Purpose

Derive explicit, reviewable changes from `CategorizedInputXML` normalized blocks and apply only approved changes to embedded `OriginalElement` source evidence.

The service is transport-neutral and contains no UI, worker, HTTP or CII integration.

## Public API

```javascript
import {
  createInputXmlChangeSetService,
} from '../../xml-compare/inputxml-changeset-api/index.js';

const service = createInputXmlChangeSetService();
```

Operations:

```text
getCapabilities()
derive(request)
validateChangeSet(changeSet)
apply(request)
```

## Derive request

```json
{
  "requestId": "optional-client-id",
  "source": {
    "filename": "model_categorized_enriched.xml",
    "content": "<CategorizedInputXML schema=\"categorized-inputxml/v3\">...</CategorizedInputXML>"
  }
}
```

## Change contract

Each proposed change uses `InputXmlChange.v1`:

```json
{
  "changeId": "change-...",
  "lineId": "L-100",
  "elementKey": "10->20",
  "fromNode": "10",
  "toNode": "20",
  "field": "DELTA_X",
  "operation": "replace",
  "beforeValue": "100",
  "afterValue": "150",
  "sourceElementFingerprint": "element-...",
  "risk": "geometry",
  "approvalRequired": true,
  "status": "proposed"
}
```

Supported fields:

```text
LINE_ID
FROM_NAME
TO_NAME
NAME (replacement only)
DELTA_X
DELTA_Y
DELTA_Z
DIAMETER
WALL_THICK
INSUL_THICK
```

`FROM_NODE` and `TO_NODE` are not supported changes. Their divergence creates `NODE_IDENTITY_CONFLICT`.

## Apply request

```json
{
  "source": {
    "filename": "model_categorized_enriched.xml",
    "content": "..."
  },
  "changeSet": {
    "schema": "InputXmlChangeSet.v1",
    "changes": [],
    "conflicts": []
  },
  "approvedChangeIds": ["change-..."]
}
```

Approval is explicit. Unapproved changes are retained as `skipped` receipt rows and are not applied.

## Preconditions

At application time, the service re-derives the current change set and requires the approved change to match:

```text
change ID
line and element identity
node pair
field
operation
before value
after value
source-element fingerprint
risk classification
```

A mismatch is reported as `stale-change-precondition` or `change-definition-mismatch`.

## Output

A successful apply response contains:

```text
reconciled-categorized-xml
reconciled-inputxml
application-receipt
```

Artifact roles:

```text
categorized-source-evidence-synchronized
approved-changes-applied
reconciliation-audit
```

The reconciled categorized artifact retains normalized blocks and updates only approved `OriginalElement` attributes. The reconciled InputXML is reconstructed from that synchronized source evidence.

## Validation

The service verifies:

```text
CAESARII XML_TYPE="Input"
PIPINGMODEL presence
PIPINGELEMENT count
approved target element identity
approved field values
```

A failed validation returns no artifacts.

## Non-goals

```text
node renumbering
restraint or SIF reconciliation
displacement or force reconciliation
normalized-block mutation
automatic approvals
CII conversion
UI / HTTP / worker integration
```
