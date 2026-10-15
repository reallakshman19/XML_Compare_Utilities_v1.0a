# CategorizedInputXML Browser Worker Transport

Browser-worker transport for:

- `InputXmlProducerService.v1`
- `CategorizedInputXmlService.v1`
- `InputXmlChangeSetService.v1`

## Public entrypoint

```text
xml-compare/categorized-inputxml-worker/index.js
```

## Worker entrypoint

```text
xml-compare/categorized-inputxml-worker/categorized-inputxml.worker.js
```

## Client construction

```javascript
import {
  createCategorizedInputXmlWorkerClient,
} from '../../xml-compare/categorized-inputxml-worker/index.js';

const client = createCategorizedInputXmlWorkerClient();
```

## Raw InputXML categorization

```javascript
const result = await client.producer.categorizeInputXml({
  producer: {
    id: 'xml-builder',
    repository: 'reallaksh19/3D_Converters',
    module: 'tabs/xml-builder-tab.js',
    operation: 'buildXmlCiiCustomInputXml',
    artifactRole: 'generated-inputxml',
  },
  source: {
    filename: 'model.input.xml',
    content: inputXml,
  },
});
```

The successful artifact role is `categorized-review-document`. The result includes producer trace, source/output fingerprints, element counts, and categorized-service validation evidence.

The default constructor creates a module worker. Tests or alternate hosts may inject a Worker-compatible object explicitly.

No producer module is switched by this transport. No UI, HTTP, storage, CII conversion, InputXML mutation, or service reconciliation is included.
