import assert from 'node:assert/strict';

import { inputXmlToCategorizedInputXml } from '../xml-compare/CategorizedInputXmlConverter.js';
import {
  INPUTXML_CHANGESET_SCHEMA,
  INPUTXML_CHANGESET_SERVICE_VERSION,
  applyCategorizedInputXmlChangeSet,
  createInputXmlChangeSetService,
  deriveCategorizedInputXmlChangeSet,
  getInputXmlChangeSetCapabilities,
  validateInputXmlChangeSet,
} from '../xml-compare/inputxml-changeset-api/index.js';

const inputXml = `<?xml version="1.0" encoding="UTF-8"?>
<CAESARII XML_TYPE="Input">
<PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="10" TO_NODE="20" LINE_ID="L-100" FROM_NAME="N10" TO_NAME="N20" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="219.1" WALL_THICK="8.18" INSUL_THICK="25">
  <BEND RADIUS="300" />
</PIPINGELEMENT>
<PIPINGELEMENT FROM_NODE="20" TO_NODE="30" LINE_ID="L-100" FROM_NAME="N20" DELTA_X="0" DELTA_Y="100" DELTA_Z="0" DIAMETER="219.1" WALL_THICK="8.18" INSUL_THICK="25" />
<RESTRAINT NODE="10" TYPE="14" STIFFNESS="1" GAP="0" MU="0" CNODE="0" />
</PIPINGMODEL>
</CAESARII>`;

function encodedAttr(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function editElement(xml = '', elementKey = '', edit = (value) => value) {
  const encoded = encodedAttr(elementKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(<Element\\b[^>]*elementKey="${encoded}"[^>]*>[\\s\\S]*?<\\/Element>)`);
  return xml.replace(pattern, (block) => edit(block));
}

function artifact(result = {}, id = '') {
  return result.artifacts.find((item) => item.id === id) || null;
}

let categorized = inputXmlToCategorizedInputXml(inputXml, { sourceName: 'change-set.input.xml' });
categorized = editElement(categorized, '10->20', (block) => block
  .replace('<DELTA_X>100</DELTA_X>', '<DELTA_X>150</DELTA_X>')
  .replace('<DIAMETER>219.1</DIAMETER>', '<DIAMETER>273.0</DIAMETER>'));
categorized = editElement(categorized, '20->30', (block) => block
  .replace('</NameBlock>', '      <TO_NAME>N30</TO_NAME>\n    </NameBlock>'));

const request = { source: { filename: 'change-set_categorized_enriched.xml', content: categorized } };
const capabilities = getInputXmlChangeSetCapabilities();
assert.equal(capabilities.serviceVersion, INPUTXML_CHANGESET_SERVICE_VERSION);
assert.deepEqual(capabilities.operations, ['derive', 'validateChangeSet', 'apply']);
assert.equal(capabilities.approval.explicitIdsRequired, true);
assert.equal(capabilities.approval.automaticApproval, false);
assert.ok(capabilities.supportedFields.includes('DELTA_X'));
assert.ok(!capabilities.supportedFields.includes('FROM_NODE'));

const service = createInputXmlChangeSetService();
assert.equal(Object.isFrozen(service), true);
assert.equal(typeof service.derive, 'function');
assert.equal(typeof service.validateChangeSet, 'function');
assert.equal(typeof service.apply, 'function');

const derivedA = deriveCategorizedInputXmlChangeSet(request);
const derivedB = deriveCategorizedInputXmlChangeSet(request);
assert.equal(derivedA.success, true);
assert.equal(derivedA.changeSet.schema, INPUTXML_CHANGESET_SCHEMA);
assert.equal(derivedA.changeSet.applyReady, true);
assert.equal(derivedA.changeSet.changeSetId, derivedB.changeSet.changeSetId);
assert.deepEqual(derivedA.changeSet.changes, derivedB.changeSet.changes);
assert.equal(derivedA.changeSet.summary.proposed, 3);
assert.equal(derivedA.changeSet.summary.additions, 1);
assert.equal(derivedA.changeSet.summary.replacements, 2);
assert.equal(derivedA.changeSet.summary.blockingConflicts, 0);
assert.deepEqual(derivedA.changeSet.changes.map((item) => item.field), ['DELTA_X', 'DIAMETER', 'TO_NAME']);
assert.ok(derivedA.changeSet.changes.every((item) => item.approvalRequired));
assert.ok(derivedA.changeSet.changes.every((item) => item.sourceElementFingerprint.startsWith('element-')));
assert.equal(derivedA.changeSet.changes.find((item) => item.field === 'TO_NAME').operation, 'add');
assert.equal(derivedA.changeSet.changes.some((item) => item.field === 'NAME'), false, 'generated NAME is not proposed as an addition');
assert.equal(validateInputXmlChangeSet(derivedA.changeSet).success, true);

const deltaChange = derivedA.changeSet.changes.find((item) => item.field === 'DELTA_X');
const diameterChange = derivedA.changeSet.changes.find((item) => item.field === 'DIAMETER');
const toNameChange = derivedA.changeSet.changes.find((item) => item.field === 'TO_NAME');
const partial = applyCategorizedInputXmlChangeSet({
  ...request,
  changeSet: derivedA.changeSet,
  approvedChangeIds: [deltaChange.changeId],
});
assert.equal(partial.success, true);
assert.equal(partial.receipt.applied, 1);
assert.equal(partial.receipt.skipped, 2);
assert.equal(partial.receipt.blocked, 0);
assert.equal(partial.outputValidation.success, true);
assert.equal(partial.outputValidation.elementCount, 2);
assert.deepEqual(partial.artifacts.map((item) => item.id), [
  'reconciled-categorized-xml', 'reconciled-inputxml', 'application-receipt',
]);
const partialInput = artifact(partial, 'reconciled-inputxml').text;
assert.match(partialInput, /FROM_NODE="10"[^>]*DELTA_X="150"/);
assert.match(partialInput, /FROM_NODE="10"[^>]*DIAMETER="219\.1"/);
assert.doesNotMatch(partialInput, /FROM_NODE="20"[^>]*TO_NAME="N30"/);
assert.ok(partialInput.includes('<BEND RADIUS="300" />'));
assert.ok(partialInput.includes('<RESTRAINT NODE="10"'));
const partialCategorized = artifact(partial, 'reconciled-categorized-xml').text;
assert.ok(partialCategorized.includes('<DELTA_X>150</DELTA_X>'));
assert.ok(partialCategorized.includes('DELTA_X="150"'));
assert.ok(partialCategorized.includes('<DIAMETER>273.0</DIAMETER>'));
assert.ok(partialCategorized.includes('DIAMETER="219.1"'));

const full = applyCategorizedInputXmlChangeSet({
  ...request,
  changeSet: derivedA.changeSet,
  approvedChangeIds: [toNameChange.changeId, diameterChange.changeId, deltaChange.changeId],
});
assert.equal(full.success, true);
assert.equal(full.receipt.applied, 3);
const fullInput = artifact(full, 'reconciled-inputxml').text;
assert.match(fullInput, /FROM_NODE="10"[^>]*DELTA_X="150"/);
assert.match(fullInput, /FROM_NODE="10"[^>]*DIAMETER="273\.0"/);
assert.match(fullInput, /FROM_NODE="20"[^>]*TO_NAME="N30"/);
assert.ok(artifact(full, 'application-receipt').text.includes('InputXmlChangeSetApplicationReceipt.v1'));

const noApproval = applyCategorizedInputXmlChangeSet({ ...request, changeSet: derivedA.changeSet, approvedChangeIds: [] });
assert.equal(noApproval.success, false);
assert.equal(noApproval.reason, 'no-current-approved-changes');
assert.equal(noApproval.artifacts.length, 0);

const staleSource = categorized.replace('DELTA_X="100"', 'DELTA_X="110"');
const stale = applyCategorizedInputXmlChangeSet({
  source: { filename: 'stale.xml', content: staleSource },
  changeSet: derivedA.changeSet,
  approvedChangeIds: [deltaChange.changeId],
});
assert.equal(stale.success, false);
assert.equal(stale.reason, 'approval-precondition-failed');
assert.ok(stale.receipt.rows.some((row) => row.changeId === deltaChange.changeId && row.status === 'conflicted'));
assert.equal(stale.artifacts.length, 0);

const identityConflictXml = categorized.replace(
  '<Element fromNode="10" toNode="20" elementKey="10-&gt;20">',
  '<Element fromNode="11" toNode="20" elementKey="10-&gt;20">',
);
const identityConflict = deriveCategorizedInputXmlChangeSet({
  source: { filename: 'identity-conflict.xml', content: identityConflictXml },
});
assert.equal(identityConflict.success, false);
assert.equal(identityConflict.changeSet.applyReady, false);
assert.ok(identityConflict.changeSet.conflicts.some((item) => item.code === 'NODE_IDENTITY_CONFLICT'));
const blockedIdentityApply = applyCategorizedInputXmlChangeSet({
  source: { filename: 'identity-conflict.xml', content: identityConflictXml },
  changeSet: identityConflict.changeSet,
  approvedChangeIds: identityConflict.changeSet.changes.map((item) => item.changeId),
});
assert.equal(blockedIdentityApply.success, false);
assert.equal(blockedIdentityApply.reason, 'change-set-has-blocking-conflicts');

const tamperedChangeSet = {
  ...derivedA.changeSet,
  changes: derivedA.changeSet.changes.map((item, index) => index === 0 ? { ...item, field: 'BoreMm' } : item),
};
const tamperedValidation = validateInputXmlChangeSet(tamperedChangeSet);
assert.equal(tamperedValidation.success, false);
assert.ok(tamperedValidation.issues.some((item) => item.code === 'FIELD_UNSUPPORTED'));
const tamperedApply = applyCategorizedInputXmlChangeSet({
  ...request,
  changeSet: tamperedChangeSet,
  approvedChangeIds: [tamperedChangeSet.changes[0].changeId],
});
assert.equal(tamperedApply.success, false);
assert.equal(tamperedApply.reason, 'change-set-invalid');

console.log('InputXmlChangeSet.v1 reconciliation API tests passed');
