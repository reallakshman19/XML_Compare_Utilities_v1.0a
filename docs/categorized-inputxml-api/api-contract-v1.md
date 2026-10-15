# CategorizedInputXmlService.v1

## Purpose

Provide a transport-neutral, service-only API for XML Compare `CategorizedInputXML` documents.

The service is a review/document API. It is not an InputXML mutation engine and does not call CII conversion.

## Import

```javascript
import {
  createCategorizedInputXmlService,
} from '../../xml-compare/categorized-inputxml-api/index.js';

const service = createCategorizedInputXmlService();
```

## Request

```json
{
  "schema": "CategorizedInputXmlServiceRequest.v1",
  "requestId": "optional-client-id",
  "source": {
    "filename": "model_categorized_enriched.xml",
    "content": "<CategorizedInputXML ... />"
  },
  "options": {
    "schemaPolicy": "allow-compatible",
    "diagnosticsLevel": "full"
  }
}
```

Policies:

- `schemaPolicy`: `allow-compatible` or `require-v3`;
- `diagnosticsLevel`: `full` or `errors-only`.

## Operations

### `getCapabilities()`

Returns supported operations and explicitly declares unsupported write behavior.

### `validate(request)`

Returns validity, counts, diagnostics and source-export readiness without exposing the read model.

### `inspect(request)`

Returns the same validation evidence plus `CategorizedInputXmlReadModel.v1`.

### `serialize(request)`

Parses and deterministically serializes a valid categorized document. It does not rewrite normalized data from `OriginalElement` or vice versa.

### `exportSourceInputXml(request)`

Reconstructs InputXML from embedded source evidence only.

The operation requires exactly one usable `OriginalElement` for every categorized element. The artifact role is:

```text
source-evidence-reconstruction
```

It does not apply normalized block changes.

## Diagnostics

Each diagnostic uses `CategorizedInputXmlDiagnostic.v1` and contains:

```text
severity
code
message
location
sourceValue
normalizedValue
action
```

Important codes include:

```text
ROOT_INVALID
SCHEMA_MISSING
SCHEMA_COMPATIBLE_NON_V3
LINE_ID_DUPLICATE
ELEMENT_KEY_DUPLICATE
ORIGINAL_ELEMENT_MISSING
ORIGINAL_ELEMENT_DUPLICATE
ORIGINAL_ELEMENT_INVALID
IDENTITY_DIVERGENCE
NORMALIZED_SOURCE_DIVERGENCE
NORMALIZED_FIELD_NOT_IN_SOURCE
DERIVED_COORDINATE_NOT_IN_SOURCE
EXTENSION_BLOCK
SOURCE_EXPORT_NOT_READY
SOURCE_EXPORT_ELEMENT_COUNT_MISMATCH
```

## Authority rule

```text
Categorized normalized blocks = review/transfer representation
OriginalElement             = embedded source evidence
Source export               = evidence reconstruction only
InputXML reconciliation     = unsupported in v1
```

A document can therefore be valid for comparison while not being ready for source InputXML export.
