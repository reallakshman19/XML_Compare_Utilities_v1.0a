import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';
import { extractCiiWriter1CSifEvidence } from '../tabs/cii-workspace/cii-workspace-writer1c-sif-custody.js';
import { buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { applyCiiWorkspaceTargetWriter2 } from '../tabs/cii-workspace/cii-workspace-core.js';
import {
  applyCiiWriter2CompositePlanContract, ciiWriter2CompositeReadiness,
} from '../tabs/cii-workspace/cii-workspace-writer2-composite-routing.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import {
  CII_WRITER_2_SIF_CREATE_BLOCKER, CII_WRITER_2_SIF_DELETE_POLICY,
} from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';
import {
  CII_WRITER_2_HANGER_CREATE_BLOCKER, CII_WRITER_2_HANGER_DELETE_POLICY,
} from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
function numericRow(values) { return values.map((value, index) => String(value ?? 0).padStart(WIDTHS[index], ' ')).join(''); }
function packedIntegerRow(values) { return `  ${values.map((value) => String(value).padStart(13, ' ')).join('')}`; }
function elementBlock(from, to, sifPointer, nodePointer) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 0, 100]);
  rows[13] = numericRow([0, 0, 0, 0, sifPointer, nodePointer]);
  return rows;
}
function sifBlock() {
  return Array.from({ length: 10 }, (_, row) => numericRow([row + 1, row + 2, row + 3, row + 4, row + 5, row + 6]));
}
function executionRows() {
  return [numericRow([0, 0, 0, 2, 0, 1]), numericRow([0, 0, 21, 21, 0, 0]), numericRow([0, 0, 0, 0, 0, 3]), numericRow([3])];
}
function hangerOpaqueRows(node) {
  return [
    numericRow([101, 25, 0, 0, 0, 0]),
    numericRow([0, 9999, 0, 0, 0, 0]),
    `       ${String(`H${node}`).length.toString().padStart(5, ' ')} H${node}`,
    '           0 ',
  ];
}
function fixtureBody() {
  return [
    '#$ VERSION', numericRow([5, 11, 1256, 0, 0, 0]),
    '#$ CONTROL', numericRow([1, 0, 1, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 1, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elementBlock(10, 20, 1, 0),
    '#$ NODENAME',
    '#$ SIF&TEES', ...sifBlock(),
    '#$ MISCEL_1', numericRow([106]),
    numericRow([1, 25, 0, 9999, 1, 1]), packedIntegerRow([1, 0, 1, 1, 1]),
    packedIntegerRow([20]), ...hangerOpaqueRows(20), packedIntegerRow([20, 0, 1, 0]),
    packedIntegerRow([10]), packedIntegerRow([20]), packedIntegerRow([30]), packedIntegerRow([40]),
    ...executionRows(),
    '#$ REDUCERS', numericRow([0, 0, 0, 0, 0, 0]),
  ].join('\r\n') + '\r\n';
}
function fixtureBytes() { return new TextEncoder().encode(fixtureBody()); }
function fixtureDocument() {
  const physicalFile = createCiiPhysicalFile(fixtureBytes());
  const parsed = Object.freeze({
    nodes: Object.freeze({ 10: Object.freeze({}), 20: Object.freeze({}) }),
    elements: Object.freeze([Object.freeze({ index: 0, from: 10, to: 20 })]),
  });
  const nodeNameEvidence = extractCiiNodeNameEvidence(physicalFile.text, parsed, { physicalFile });
  const sifWriter1CEvidence = extractCiiWriter1CSifEvidence(physicalFile.text, parsed, { physicalFile });
  const hangerEvidence = buildCiiHangerEvidence(physicalFile.text, parsed);
  return Object.freeze({ contentSha256: 'target', physicalFile, writer1CByteEligible: true, parsed, nodeNameEvidence,
    nodeNames: nodeNameEvidence.names, sifWriter1CEvidence, hangerEvidence });
}
function graph() {
  return Object.freeze({ edges: Object.freeze([Object.freeze({ elementId: 'E1', parsedElementIndex: 0, from: '10', to: '20' })]) });
}
function nodeCreate() {
  return Object.freeze({
    operationId: 'NODE-CREATE-20', family: 'NODE_NAME', property: 'Node name / to-name', action: 'COPY', status: 'PREVIEW_READY', blockers: Object.freeze([]),
    evidenceAuthority: 'CII_NODENAME_FIXED_LAYOUT', sourceEvidence: Object.freeze({ identity: 'SRC-20', value: 'P-20', authority: 'CII_NODENAME_FIXED_LAYOUT' }),
    targetEvidence: Object.freeze({ identity: '20', value: '' }), before: '', proposed: 'P-20', matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function sifPresence(id, source, target) {
  return Object.freeze({
    operationId: id, family: 'SIF_TEE', property: 'SIF/Tee record presence', action: source ? 'CREATE' : 'DELETE', status: 'BLOCKED',
    blockers: Object.freeze(['SIF_TEE_CARDINALITY_OR_SEMANTIC_REWRITE_REQUIRES_FUTURE_QUALIFICATION']), evidenceAuthority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD',
    sourceEvidence: Object.freeze({ identity: 'SRC-E1', value: source, authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD' }),
    targetEvidence: Object.freeze({ identity: 'E1', value: target }), before: target, proposed: source, matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function hangerPresence(id, source, target) {
  return Object.freeze({
    operationId: id, family: 'HANGER', property: 'Hanger presence', action: source ? 'CREATE' : 'DELETE', status: 'BLOCKED',
    blockers: Object.freeze(['HANGER_CARDINALITY_REQUIRES_WRITER_2_QUALIFICATION']), evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
    sourceEvidence: Object.freeze({ identity: 'SRC-20', value: source, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: '20', value: target }), before: target, proposed: source, matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function rawPlan(operations, blockers = ['NO_TRANSFERABLE_PREVIEW_OPERATIONS'], hashes = { source: 'source', target: 'target' }) {
  return Object.freeze({
    status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY', blockers: Object.freeze(blockers), mutationAuthority: 'WRITER_1B_CONDITIONAL',
    sourceDocument: Object.freeze({ contentSha256: hashes.source }), targetDocument: Object.freeze({ contentSha256: hashes.target }),
    operations: Object.freeze(operations), policy: Object.freeze({ sifTeeMutation: 'BLOCKED_EXCEPT_WRITER_1C_V11_ITEM3_ITEM4', hangerMutation: 'BLOCKED' }),
  });
}
function sortedIds(rows) {
  return rows.map((item) => String(item.operationId)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function bound(contracted, decisions = () => 'APPLY') {
  const operations = []; const excludedOperations = [];
  for (const operation of contracted.operations) {
    if (operation.action === 'KEEP') { operations.push(Object.freeze({ ...operation, scopeDecision: 'KEEP' })); continue; }
    if (decisions(operation) === 'APPLY') operations.push(Object.freeze({ ...operation, scopeDecision: 'APPLY' }));
    else excludedOperations.push(Object.freeze({ ...operation, scopeDecision: 'EXCLUDE' }));
  }
  const applied = operations.filter((item) => item.action !== 'KEEP' && item.scopeDecision === 'APPLY');
  const excluded = excludedOperations.filter((item) => item.action !== 'KEEP');
  const appliedOperationIds = sortedIds(applied); const excludedOperationIds = sortedIds(excluded);
  const candidateOperationIds = [...appliedOperationIds, ...excludedOperationIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return Object.freeze({ ...contracted, status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze(operations),
    excludedOperations: Object.freeze(excludedOperations), transferScope: Object.freeze({
      status: 'BOUND', mode: 'EXPLICIT_APPLY_EXCLUDE', authority: 'USER_EXPLICIT_OPERATION_SCOPE', scopeId: 'writer2-product-routing-test',
      sourceSha256: contracted.sourceDocument.contentSha256, targetSha256: contracted.targetDocument.contentSha256,
      candidateOperationIds: Object.freeze(candidateOperationIds), appliedOperationIds: Object.freeze(appliedOperationIds),
      excludedOperationIds: Object.freeze(excludedOperationIds),
    }) });
}

{
  const routed = applyCiiWriter2CompositePlanContract(rawPlan([
    nodeCreate(), sifPresence('SIF-DELETE-E1', false, true), hangerPresence('HANGER-DELETE-20', false, true),
  ]));
  assert.equal(routed.status, 'PREVIEW_READY');
  assert.equal(routed.summary.writer2CompositeMutationCount, 3);
  assert.equal(routed.summary.nodeNameMutationCount, 1);
  assert.equal(routed.summary.sifDeleteMutationCount, 1);
  assert.equal(routed.summary.hangerDeleteMutationCount, 1);
  const node = routed.operations.find((item) => item.operationId === 'NODE-CREATE-20');
  const sif = routed.operations.find((item) => item.operationId === 'SIF-DELETE-E1');
  const hanger = routed.operations.find((item) => item.operationId === 'HANGER-DELETE-20');
  assert.equal(node.action, 'CREATE'); assert.equal(node.policyAuthority, CII_WRITER_2_NODENAME_RELOCATION_POLICY);
  assert.equal(sif.action, 'DELETE'); assert.equal(sif.status, 'PREVIEW_READY'); assert.equal(sif.policyAuthority, CII_WRITER_2_SIF_DELETE_POLICY);
  assert.equal(hanger.action, 'DELETE'); assert.equal(hanger.status, 'PREVIEW_READY'); assert.equal(hanger.policyAuthority, CII_WRITER_2_HANGER_DELETE_POLICY);
  assert(!routed.blockers.includes('NO_TRANSFERABLE_PREVIEW_OPERATIONS'));
  assert.equal(routed.policy.mixedCardinalityMutation, 'ONE_ORIGINAL_PREIMAGE_COMPOSITE');
  assert.equal(routed.policy.hangerMutation, 'EXISTING_HANGER_DELETE_ALL_OR_QUALIFIED_PARTIAL');
  assert.equal(routed.policy.hangerPartialMultiDelete, 'QUALIFIED_POSITIONAL_RECORD_COMPACTION_ONLY');

  const before = fixtureDocument();
  assert.equal(before.hangerEvidence.status, 'QUALIFIED');
  assert.equal(before.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
  const unbound = ciiWriter2CompositeReadiness(routed, before, graph());
  assert.equal(unbound.ready, false);
  assert(unbound.blockers.includes('WRITER_2_COMPOSITE_BOUND_TRANSFER_SCOPE_REQUIRED'));
  const ready = ciiWriter2CompositeReadiness(bound(routed), before, graph());
  assert.equal(ready.ready, true, ready.blockers.join('|'));
  assert.equal(ready.mutationCount, 3);
  assert.deepEqual(ready.familyMutationCounts, { nodeName: 1, sifDelete: 1, hangerDelete: 1 });
  assert.equal(ready.hangerTransactionClass, 'DELETE_ALL');
  assert.equal(ready.components.nodeName.appendedRows[0].toName, 'P-20');
  assert.equal(ready.components.sifDelete.blockCountAfter, 0);
  assert.equal(ready.components.hangerDeleteAll.countAfter, 0);
  assert.equal(ready.components.hangerDeleteAll.compaction.deleteAll, true);
  assert.equal(ready.components.hangerPartialDelete, null);
}

{
  const routed = applyCiiWriter2CompositePlanContract(rawPlan([nodeCreate(), sifPresence('SIF-CREATE-E1', true, false)]));
  assert.equal(routed.status, 'PREVIEW_READY', 'blocked SIF CREATE may coexist with an independently transferable NODENAME operation');
  const create = routed.operations.find((item) => item.operationId === 'SIF-CREATE-E1');
  assert.equal(create.action, 'CREATE'); assert.equal(create.status, 'BLOCKED');
  assert(create.blockers.includes(CII_WRITER_2_SIF_CREATE_BLOCKER));
  const readiness = ciiWriter2CompositeReadiness(bound(routed), fixtureDocument(), graph());
  assert.equal(readiness.ready, false);
  assert(readiness.blockers.includes(CII_WRITER_2_SIF_CREATE_BLOCKER));
}

{
  const routed = applyCiiWriter2CompositePlanContract(rawPlan([nodeCreate(), hangerPresence('HANGER-CREATE-20', true, false)]));
  assert.equal(routed.status, 'PREVIEW_READY', 'blocked HANGER CREATE may coexist with an independently transferable NODENAME operation');
  const create = routed.operations.find((item) => item.operationId === 'HANGER-CREATE-20');
  assert.equal(create.action, 'CREATE'); assert.equal(create.status, 'BLOCKED');
  assert(create.blockers.includes(CII_WRITER_2_HANGER_CREATE_BLOCKER));
  const readiness = ciiWriter2CompositeReadiness(bound(routed), fixtureDocument(), graph());
  assert.equal(readiness.ready, false);
  assert(readiness.blockers.includes(CII_WRITER_2_HANGER_CREATE_BLOCKER));
}

{
  const routed = applyCiiWriter2CompositePlanContract(rawPlan([nodeCreate(), hangerPresence('HANGER-DELETE-20', false, true)]));
  const scoped = bound(routed);
  const forged = Object.freeze({ ...scoped, transferScope: Object.freeze({
    ...scoped.transferScope, appliedOperationIds: Object.freeze([...scoped.transferScope.appliedOperationIds, scoped.transferScope.appliedOperationIds[0]]),
  }) });
  const readiness = ciiWriter2CompositeReadiness(forged, fixtureDocument(), graph());
  assert.equal(readiness.ready, false, 'duplicate parent-scope testimony must fail before apply');
  assert(readiness.blockers.includes('WRITER_2_COMPOSITE_SCOPE_APPLY_IDS_DUPLICATE'));
}

{
  const process = Object.freeze({ operationId: 'PROCESS-P3', family: 'PROCESS', property: 'P3', action: 'COPY', status: 'PREVIEW_READY', blockers: Object.freeze([]),
    sourceEvidence: Object.freeze({ value: 10 }), targetEvidence: Object.freeze({ value: 5 }), before: 5, proposed: 10, matchAuthority: Object.freeze({ status: 'REVIEWED' }) });
  const routed = applyCiiWriter2CompositePlanContract(rawPlan([nodeCreate(), process], []));
  assert.equal(routed.status, 'PREVIEW_READY');
  const blockedProcess = routed.operations.find((item) => item.operationId === 'PROCESS-P3');
  assert.equal(blockedProcess.action, 'BLOCKED');
  const readiness = ciiWriter2CompositeReadiness(bound(routed), fixtureDocument(), graph());
  assert.equal(readiness.ready, false);
  assert(readiness.blockers.includes('WRITER_2_COMPOSITE_UNSUPPORTED_APPLY:PROCESS-P3'));
}

{
  const bytes = fixtureBytes();
  const before = await intakeCiiWorkspaceDocument(bytes, 'writer2-product-hanger.cii', { side: 'TARGET', cryptoRef: webcrypto });
  assert.equal(before.hangerEvidence.status, 'QUALIFIED');
  assert.equal(before.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
  const routed = applyCiiWriter2CompositePlanContract(rawPlan([
    nodeCreate(), sifPresence('SIF-DELETE-E1', false, true), hangerPresence('HANGER-DELETE-20', false, true),
  ], ['NO_TRANSFERABLE_PREVIEW_OPERATIONS'], { source: 'source-product-test', target: before.contentSha256 }));
  const transferPlan = bound(routed);
  const readiness = ciiWriter2CompositeReadiness(transferPlan, before, graph());
  assert.equal(readiness.ready, true, readiness.blockers.join('|'));
  assert.equal(readiness.hangerTransactionClass, 'DELETE_ALL');
  const preview = Object.freeze({ writerVersion: '2', targetDocument: before, transferPlan, correspondence: Object.freeze({}) });
  const applied = await applyCiiWorkspaceTargetWriter2(preview, bytes, { cryptoRef: webcrypto });
  assert.equal(applied.status, 'PASS');
  assert.equal(applied.writer, 'WRITER_2');
  assert.equal(applied.validation.status, 'PASS');
  assert.equal(applied.validation.schema, 'CIIWorkspaceWriter2CompositeHangerValidation.v1');
  assert.equal(applied.validation.productValidatorClass, 'DELETE_ALL');
  assert.equal(applied.validation.nodeNameOperations, 1);
  assert.equal(applied.validation.sifDeleteOperations, 1);
  assert.equal(applied.validation.hangerDeleteOperations, 1);
  const after = await intakeCiiWorkspaceDocument(new TextEncoder().encode(applied.byteString), applied.fileName, { side: 'TARGET', cryptoRef: webcrypto });
  assert.equal(after.nodeNames['20'], 'P-20');
  assert.equal(after.sifWriter1CEvidence.controlBlockCount, 0);
  assert.equal(after.hangerEvidence.count, 0);
  assert.equal(after.hangerEvidence.layout, CII_HANGER_LAYOUTS.NONE);
}

{
  const core = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-core.js', import.meta.url), 'utf8');
  const scope = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-transfer-scope.js', import.meta.url), 'utf8');
  const ui = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-transfer-scope-ui.js', import.meta.url), 'utf8');
  const tab = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-tab.js', import.meta.url), 'utf8');
  assert(core.includes("['1A', '1B', '1C', '2']"));
  assert(core.includes("? options.writerVersion : '1B'"), 'production default must remain Writer 1B');
  assert(core.includes("if (version === '2') {\n    engineeringDeltas = baseDeltas;"), 'Writer 2 must not inherit Writer1B/1C augmentation families');
  assert(core.includes('applyCiiWriter2CompositePlanContract(rawTransferPlan)'));
  assert(core.includes('ciiWriter2CompositeReadiness(plan, targetDocument, targetGraph)'));
  assert(core.includes('applyCiiWriter2CompositeWithHangerDeleteAll as applyCiiWriter2Composite'));
  assert(core.includes("from './cii-workspace-writer2-composite-hanger.js'"));
  assert(core.includes('validateCiiWriter2ProductRoundTrip'));
  assert(core.includes("from './cii-workspace-writer2-product-validation.js'"));
  assert(core.includes('applyCiiWriter2Composite({ targetDocument: currentTarget, targetGraph, transferPlan: preview.transferPlan })'));
  assert(core.includes('validateCiiWriter2ProductRoundTrip(currentTarget, modifiedTarget, targetGraph, preview.transferPlan, writerResult)'));
  assert(!core.includes("from './cii-workspace-writer2-composite.js'"));
  assert(!core.includes("from './cii-workspace-writer2-composite-validation.js'"));
  assert(!core.includes('applyCiiWriter2NodeNameRelocation({ targetDocument: currentTarget'));
  assert(!core.includes('validateCiiWriter2NodeNameRoundTrip(currentTarget, modifiedTarget'));
  assert(scope.includes('ciiWriter2CompositeReadiness(transferPlan, preview.targetDocument, targetGraph)'));
  assert(scope.includes('adaptCiiDocumentToTopologyGraph(preview.targetDocument)'));
  assert(ui.includes('applyCiiWorkspaceTargetWriter2'));
  assert(ui.includes("['WRITER_1C', 'WRITER_2'].includes(applied?.writer)"));
  assert(tab.includes('mountCiiWorkspaceScopedEngineeringShell'));
  assert(!tab.includes("writerVersion: '2'"), 'product tile must not silently switch the default to Writer 2');
}

console.log('Writer 2 product routing preserves qualified delete-all while admitting separately qualified partial HANGER through one-preimage composite authority.');