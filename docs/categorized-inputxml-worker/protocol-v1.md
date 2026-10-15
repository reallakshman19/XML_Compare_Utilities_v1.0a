# CategorizedInputXML Worker Protocol v1

## Protocol

```text
categorized-inputxml-worker/v1
```

Worker implementation version:

```text
1.1.0
```

## Request envelope

```json
{
  "schema": "CategorizedInputXmlWorkerRequest.v1",
  "protocol": "categorized-inputxml-worker/v1",
  "kind": "request",
  "requestId": "client-1",
  "operation": "producer.categorizeInputXml",
  "payload": {}
}
```

## Cancel envelope

```json
{
  "schema": "CategorizedInputXmlWorkerCancel.v1",
  "protocol": "categorized-inputxml-worker/v1",
  "kind": "cancel",
  "requestId": "client-1",
  "reason": "user-cancelled"
}
```

## Response envelope

Success:

```json
{
  "schema": "CategorizedInputXmlWorkerResponse.v1",
  "protocol": "categorized-inputxml-worker/v1",
  "kind": "response",
  "requestId": "client-1",
  "operation": "producer.categorizeInputXml",
  "ok": true,
  "result": {},
  "error": null
}
```

Failure:

```json
{
  "schema": "CategorizedInputXmlWorkerResponse.v1",
  "protocol": "categorized-inputxml-worker/v1",
  "kind": "response",
  "requestId": "client-1",
  "operation": "categorized.inspect",
  "ok": false,
  "result": null,
  "error": {
    "code": "OPERATION_FAILED",
    "message": "Operation failed.",
    "operation": "categorized.inspect",
    "retryable": false,
    "causeName": "Error"
  }
}
```

Raw `Error` objects and stack traces are not part of the public response contract.

## Operations

```text
producer.categorizeInputXml
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

### Producer categorization payload

```json
{
  "schema": "InputXmlProducerCategorizeRequest.v1",
  "requestId": "producer-request-1",
  "producer": {
    "id": "xml-builder",
    "repository": "reallaksh19/3D_Converters",
    "module": "tabs/xml-builder-tab.js",
    "operation": "buildXmlCiiCustomInputXml",
    "version": "optional-version",
    "artifactRole": "generated-inputxml"
  },
  "source": {
    "filename": "model.input.xml",
    "content": "<CAESARII XML_TYPE=\"Input\">...</CAESARII>"
  }
}
```

The worker calculates source and output fingerprints. A successful result contains:

```text
InputXmlProducerCategorizeResult.v1
producer trace
source filename and fingerprint
categorized-review-document artifact
categorized artifact fingerprint
InputXML element count
categorized line/element/node summary
categorized service validation evidence
```

Engineering validation failures return `success: false` and `artifact: null` inside a successful worker response envelope. Protocol or runtime failures use a failed worker response envelope.

### Existing service payloads

Categorized operations accept the corresponding `CategorizedInputXmlServiceRequest.v1` request.

`changeset.validate` accepts:

```json
{
  "changeSet": {
    "schema": "InputXmlChangeSet.v1"
  }
}
```

## Client API

```javascript
const client = createCategorizedInputXmlWorkerClient();

const categorizedArtifact = await client.producer.categorizeInputXml(producerRequest);

await client.categorized.getCapabilities();
await client.categorized.validate(request);
await client.categorized.inspect(request);
await client.categorized.serialize(request);
await client.categorized.exportSourceInputXml(request);

await client.changeSet.getCapabilities();
await client.changeSet.derive(request);
await client.changeSet.validate(changeSet);
await client.changeSet.apply(applyRequest);
```

Every operation also accepts request options:

```javascript
{
  requestId: 'optional-explicit-id',
  signal: abortController.signal,
  timeoutMs: 30000,
}
```

## Producer authority

```text
InputXML producer remains generation authority
CategorizedInputXmlConverter remains categorization authority
CategorizedInputXmlService remains validation authority
worker remains transport authority
```

The producer operation does not repair, enrich, mutate, reconcile, or convert InputXML to CII.

## Cancellation semantics

Cancellation is cooperative.

- A queued request can be cancelled before dispatch.
- An asynchronous dispatch result is suppressed if cancellation arrives before completion.
- The client rejects immediately on abort or timeout and ignores late responses.
- A synchronous service call already executing in the worker cannot be pre-empted by a later message.

## Artifact transport

Artifacts remain inline strings inside structured-clone responses in v1.

```text
payload transport: structured-clone
artifact transport: inline-text
streaming: false
transferable artifacts: false
```

Transferable buffers or streaming require a separate measured Work Pack.

## Lifecycle

`client.close()` removes message/error listeners, rejects pending requests, and terminates the worker by default.

```javascript
client.close({ terminate: false });
```

can be used when the worker lifecycle is owned externally.
