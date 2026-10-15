import assert from 'node:assert/strict';

import {
  applyTransferPatchPlan,
  createTransferAudit,
  createTransferPatchPlan,
  createTransferStage,
} from '../xml-compare/XmlCompareTransferStaging.js';

const stage = createTransferStage({
  sourceRecord: { uid: 'source-1', Name: 'Alpha' },
  targetRecord: { uid: 'target-1', Name: 'Beta' },
  scope: 'selected-field',
  selectedFields: ['Name'],
});

assert.equal(stage.schema, 'xml-compare-transfer-stage/v1');
assert.equal(stage.changes[0].action, 'replace');

const blocked = createTransferPatchPlan({ targetXml: '<Target />', stage: null });
assert.equal(blocked.ok, false);
assert.equal(blocked.diagnostics[0].code, 'transfer_stage_missing');

const targetXml = '<CategorizedInputXML><Line id="L1"><Element elementKey="1->2"><Node nodeNumber="2" role="TO"></Node></Element></Line></CategorizedInputXML>';
const sourceXml = '<CategorizedInputXML><Line id="L1"><Element elementKey="1->2"><Node nodeNumber="1" role="FROM"><RestraintsBlock NODE="1"><Item /></RestraintsBlock></Node></Element></Line></CategorizedInputXML>';
const previewPlan = {
  transferScope: 'node',
  selectedBlocks: ['RestraintsBlock'],
  pairs: [{ sourceNode: '1', targetNode: '2', sourceElement: '1->2', targetElement: '1->2', sourceRole: 'FROM', targetRole: 'TO' }],
};
const plan = createTransferPatchPlan({ targetXml, stage, previewPlan });
const result = applyTransferPatchPlan({ targetXml, sourceXml, patchPlan: plan });
assert.equal(result.ok, true);
assert.match(result.xmlText, /RestraintsBlock NODE="2"/);
assert.notEqual(result.xmlText, sourceXml);

const unresolved = applyTransferPatchPlan({ targetXml, sourceXml, patchPlan: createTransferPatchPlan({ targetXml, stage }) });
assert.equal(unresolved.ok, false);
assert.equal(unresolved.diagnostics[0].code, 'target_path_unresolved');

const audit = createTransferAudit({ stage, patchPlan: plan, result });
assert.equal(audit.resultOk, true);
assert.equal(audit.changes.length, 1);

console.log('XML Compare transfer staging tests passed');
