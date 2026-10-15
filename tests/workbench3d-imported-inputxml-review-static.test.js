import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tab = readFileSync(new URL('../workbench3d/ui/workbench3d-tab.js', import.meta.url), 'utf8');
const review = readFileSync(new URL('../workbench3d/ui/imported-inputxml-review.js', import.meta.url), 'utf8');

assert.match(tab, /imported-inputxml-review\.js/);
assert.match(tab, /importedInputXmlReview: createImportedInputXmlReviewCollection\(\)/);
assert.match(tab, /function scheduleWorkbenchImportedInputXmlReview/);
assert.match(tab, /scheduleImportedInputXmlReview/);
assert.match(tab, /data-wb3d-import-review="\$\{side\}"/);
assert.match(tab, /download-imported-inputxml-review/);
assert.match(tab, /download-imported-inputxml-review-receipt/);
assert.match(tab, /importedInputXmlReviewText/);
assert.match(tab, /importedInputXmlReviewReceiptJson/);
assert.match(tab, /field === 'sourceXml' \|\| field === 'targetXml'/);
assert.match(tab, /scheduleWorkbenchImportedInputXmlReview\(container, s, side, 0\)/);
assert.match(tab, /scheduleWorkbenchImportedInputXmlReview\(container, state, 'source', 0\)/);
assert.match(tab, /scheduleWorkbenchImportedInputXmlReview\(container, state, 'target', 0\)/);
assert.match(tab, /closeImportedInputXmlReviewRuntime\(container\)/);

assert.match(review, /isGenuineCaesarInputXml/);
assert.match(review, /WORKBENCH_CAESAR_INPUTXML_ROOT_REQUIRED/);
assert.match(review, /source\.sourceSchema === XML_SCHEMA_KINDS\.INPUT_XML && !source\.genuineCaesarInputXml/);
assert.match(review, /source\.sourceSchema !== XML_SCHEMA_KINDS\.INPUT_XML/);
assert.match(review, /WORKBENCH_NODESET_REVIEW_EXCLUDED/);
assert.match(review, /if \(!started\.request\) return started\.review/);
assert.match(review, /WORKBENCH_REVIEW_REQUEST_MISMATCH/);
assert.match(review, /WORKBENCH_REVIEW_SOURCE_MISMATCH/);
assert.match(review, /WORKBENCH_REVIEW_ARTIFACT_MISMATCH/);
assert.match(review, /controller\?\.abort/);
assert.match(review, /runtime\.client\?\.close\?\.\(\)/);
assert.match(review, /__workbench3dImportedInputXmlReviewRuntime\.closed/);

const nodeSetBranch = review.slice(
  review.indexOf('export function startImportedInputXmlReview'),
  review.indexOf('function resultFailure'),
);
assert.doesNotMatch(nodeSetBranch, /createCategorizedInputXmlWorkerClient/);

console.log('Workbench3D imported InputXML review static integration passed.');
