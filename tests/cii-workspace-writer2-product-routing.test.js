import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';
import {
  applyCiiWriter2NodeNamePlanContract, ciiWriter2NodeNameReadiness,
} from '../tabs/cii-workspace/cii-workspace-writer2-routing.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
function numericRow(values) { return values.map((value, index) => String(value ?? 0).padStart(WIDTHS[index], ' ')).join(''); }
function elementBlock(from, to, pointer) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 0, 100]);
  rows[13] = numericRow([0, 0, 0, 0, 0, pointer]);
  return rows;
}
function operation({ id, family = 'NODE_NAME', property = 'Node name / to-name', source = '', target = '', action = 'COPY', status = 'PREVIEW_READY', blockers = [], evidenceAuthority = 'CII_NODENAME_FIXED_LAYOUT' }) {
  return Object.freeze({
    operationId: id, family, property, action, status, blockers: Object.freeze(blockers), evidenceAuthority,
    sourceEvidence: Object.freeze({ identity: '20', value: source, authority: evidenceAuthority }),
    targetEvidence: Object.freeze({ identity: '20', value: target }), before: target, proposed: source,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function rawPlan(operations, blockers = []) {
  return Object.freeze({
    status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY', blockers: Object.freeze(blockers),
    mutationAuthority: 'WRITER_1B_CONDITIONAL',
    sourceDocument: Object.freeze({ contentSha256: 'source' }), targetDocument: Object.freeze({ contentSha256: 'target' }),
    operations: Object.freeze(operations), policy: Object.freeze({ processDefault: 'WRITER_1B_EXACT_FIXED_FIELDS_ONLY' }),
  });
}

{
  const routed = applyCiiWriter2NodeNamePlanContract(rawPlan([
    operation({ id: 'CREATE-20', source: 'P-20', target: '' }),
  ]));
  assert.equal(routed.status, 'PREVIEW_READY');
  assert.equal(routed.operations[0].action, 'CREATE');
  assert.equal(routed.operations[0].status, 'PREVIEW_READY');
  assert.equal(routed.operations[0].policyAuthority, CII_WRITER_2_NODENAME_RELOCATION_POLICY);
  assert.equal(routed.summary.writer2MutationCount, 1);
  assert.equal(routed.policy.nodeNameMutation, 'CREATE_DELETE_RELOCATION_ONLY');
}

{
  const routed = applyCiiWriter2NodeNamePlanContract(rawPlan([
    operation({ id: 'DELETE-20', source: '', target: 'P-20', action: 'DELETE', status: 'BLOCKED', blockers: ['NODE_NAME_DELETE_REQUIRES_EXPLICIT_POLICY'] }),
  ], ['NO_TRANSFERABLE_PREVIEW_OPERATIONS']));
  assert.equal(routed.status, 'PREVIEW_READY');
  assert.equal(routed.operations[0].action, 'DELETE');
  assert.equal(routed.operations[0].status, 'PREVIEW_READY');
  assert.equal(routed.summary.writer2MutationCount, 1);
  assert(!routed.blockers.includes('NO_TRANSFERABLE_PREVIEW_OPERATIONS'));
}

{
  const routed = applyCiiWriter2NodeNamePlanContract(rawPlan([
    operation({ id: 'OVERWRITE-20', source: 'NEW', target: 'OLD', status: 'BLOCKED', blockers: ['TARGET_NODENAME_NONBLANK'] }),
  ]));
  assert.equal(routed.status, 'BLOCKED');
  assert.equal(routed.operations[0].action, 'BLOCKED');
  assert.equal(routed.summary.writer2MutationCount, 0);
  assert(routed.operations[0].blockers.includes('WRITER_2_NODENAME_OVERWRITE_USE_WRITER_1C'));
  assert(routed.blockers.includes('NO_WRITER_2_NODENAME_TRANSFERABLE_OPERATIONS'));
}

{
  const routed = applyCiiWriter2NodeNamePlanContract(rawPlan([
    operation({ id: 'P3', family: 'PROCESS', property: 'P3', source: 10, target: 5, evidenceAuthority: 'PROTECTED_WRITER_ELEMENT_ROW4_P3_FIXED_FIELD' }),
  ]));
  assert.equal(routed.status, 'BLOCKED');
  assert.equal(routed.operations[0].action, 'BLOCKED');
  assert.equal(routed.summary.writer2MutationCount, 0);
  assert(routed.operations[0].blockers.includes('WRITER_2_PHASE1_NODENAME_ONLY'));
  assert(routed.blockers.includes('NO_WRITER_2_NODENAME_TRANSFERABLE_OPERATIONS'));
}

{
  const routed = applyCiiWriter2NodeNamePlanContract(rawPlan([
    operation({ id: 'KEEP-20', source: 'P-20', target: 'P-20', action: 'KEEP', status: 'PREVIEW_READY' }),
    operation({ id: 'GEOM', family: 'GEOMETRY', property: 'Node location', source: 0, target: 0, action: 'KEEP', status: 'PROTECTED', evidenceAuthority: 'PARSED_NATIVE_NODE_COORDINATES' }),
  ]));
  assert.equal(routed.summary.previewReadyCount, 1);
  assert.equal(routed.summary.protectedCount, 1);
  assert.equal(routed.summary.writer2MutationCount, 0);
  assert.equal(routed.status, 'BLOCKED');
  assert(routed.blockers.includes('NO_WRITER_2_NODENAME_TRANSFERABLE_OPERATIONS'));
}

{
  const routed = applyCiiWriter2NodeNamePlanContract(rawPlan([
    operation({ id: 'CREATE-20', source: 'P-20', target: '' }),
  ], ['CORRESPONDENCE_NOT_READY']));
  assert.equal(routed.status, 'BLOCKED');
  assert(routed.blockers.includes('CORRESPONDENCE_NOT_READY'));
}

{
  const body = [
    '#$ CONTROL', numericRow([1, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elementBlock(10, 20, 0), '#$ NODENAME', '#$ BEND',
  ].join('\r\n');
  const physicalFile = createCiiPhysicalFile(new TextEncoder().encode(body));
  const parsed = Object.freeze({ nodes: Object.freeze({ 10: Object.freeze({}), 20: Object.freeze({}) }),
    elements: Object.freeze([Object.freeze({ index: 0, from: 10, to: 20 })]) });
  const nodeNameEvidence = extractCiiNodeNameEvidence(physicalFile.text, parsed, { physicalFile });
  const targetDocument = Object.freeze({ physicalFile, writer1CByteEligible: true, nodeNameEvidence, nodeNames: Object.freeze({}) });
  const contracted = applyCiiWriter2NodeNamePlanContract(rawPlan([operation({ id: 'CREATE-20', source: 'P-20', target: '' })]));
  const unbound = ciiWriter2NodeNameReadiness(contracted, targetDocument);
  assert.equal(unbound.ready, false);
  assert(unbound.blockers.includes('WRITER_2_NODENAME_BOUND_TRANSFER_SCOPE_REQUIRED'));
  const bound = Object.freeze({ ...contracted, transferScope: Object.freeze({ status: 'BOUND' }),
    operations: Object.freeze(contracted.operations.map((item) => Object.freeze({ ...item, scopeDecision: 'APPLY' }))) });
  const ready = ciiWriter2NodeNameReadiness(bound, targetDocument);
  assert.equal(ready.ready, true);
  assert.equal(ready.mutationCount, 1);
  assert.equal(ready.relocationPlan.appendedRows[0].toName, 'P-20');
}

{
  const core = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-core.js', import.meta.url), 'utf8');
  const scope = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-transfer-scope.js', import.meta.url), 'utf8');
  const ui = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-transfer-scope-ui.js', import.meta.url), 'utf8');
  const shell = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-shell.js', import.meta.url), 'utf8');
  const engineeringUi = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-engineering-ui.js', import.meta.url), 'utf8');
  const bridge = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-writer-version-bridge.js', import.meta.url), 'utf8');
  const tab = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-tab.js', import.meta.url), 'utf8');
  assert(core.includes("['1A', '1B', '1C', '2']"));
  assert(core.includes("? options.writerVersion : '1B'"), 'production default must remain Writer 1B');
  assert(core.includes('applyCiiWorkspaceTargetWriter2'));
  assert(core.includes("version === '2' ? applyCiiWriter2CompositePlanContract"));
  assert(core.includes("['1C', '2'].includes(version)"));
  assert(core.includes('writer2HasRestraintApply(preview.transferPlan)'));
  assert(core.includes('applyCiiWriter2CompositeWithRestraintDelete({ targetDocument: currentTarget, targetGraph, transferPlan: preview.transferPlan })'));
  assert(core.includes('applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument: currentTarget, targetGraph, transferPlan: preview.transferPlan })'));
  assert(core.includes('validateCiiWriter2ProductRoundTrip(currentTarget, modifiedTarget, targetGraph, preview.transferPlan, writerResult)'));
  assert(!core.includes('validateCiiWriter2CompositeRoundTrip(currentTarget, modifiedTarget, targetGraph, preview.transferPlan, writerResult)'));
  assert(scope.includes("preview?.writerVersion === '2'"));
  assert(scope.includes('ciiWriter2CompositeReadiness(transferPlan, preview.targetDocument, targetGraph)'));
  assert(scope.includes("['1A', '1B', '1C', '2']"));

  assert(shell.includes('inspectCiiWorkspaceModelsWithVersionBridge'));
  assert(shell.includes('createCiiWorkspacePreviewWithVersionBridge'));
  assert(shell.includes('applyCiiWorkspaceTargetWriter2WithVersionBridge'));
  assert(shell.includes("options?.writerVersion === '2'"));
  assert(shell.includes("applied?.writer === 'WRITER_2'"));
  assert(shell.includes('CII_WRITER_2_VERSION_BRIDGE_VALIDATION_REQUIRED'));
  assert(shell.includes('CII_WRITER_2_BYTE_STRING_REQUIRED'));
  assert(shell.includes("applied?.writer === 'WRITER_1C'"));
  assert(!shell.includes("['WRITER_1C', 'WRITER_2'].includes(applied?.writer)"));
  assert(!shell.includes("if (version === '2') return applyCiiWorkspaceTargetWriter2;"));

  assert(engineeringUi.includes('inspectCiiWorkspaceModelsWithVersionBridge'));
  assert(engineeringUi.includes("options?.writerVersion === '2' ? inspectCiiWorkspaceModelsWithVersionBridge"));
  assert(engineeringUi.includes('new Uint8Array(await sourceFile.arrayBuffer())'));
  assert(engineeringUi.includes('new Uint8Array(await targetFile.arrayBuffer())'));
  assert(engineeringUi.includes("current?.writerVersion || options?.writerVersion || '1B'"));

  assert(ui.includes('applyCiiWorkspaceTargetWriter2WithVersionBridge'));
  assert(ui.includes('writer2BridgeReady'));
  assert(ui.includes('Boolean(preview?.versionBridge)'));
  assert(ui.includes('Writer 2 version-bridge evidence is missing'));
  assert(ui.includes("applied?.writer === 'WRITER_2'"));
  assert(ui.includes('CII_WRITER_2_VERSION_BRIDGE_VALIDATION_REQUIRED'));
  assert(ui.includes('CII_WRITER_2_BYTE_STRING_REQUIRED'));
  assert(ui.includes("applied?.writer === 'WRITER_1C'"));
  assert(!ui.includes("['WRITER_1C', 'WRITER_2'].includes(applied?.writer)"));
  assert(!ui.includes("if (version === '2') return applyCiiWorkspaceTargetWriter2;"));

  assert(bridge.includes('inspectCiiWorkspaceModelsWithVersionBridge'));
  assert(bridge.includes('createCiiWorkspacePreviewWithVersionBridge'));
  assert(bridge.includes('applyCiiWorkspaceTargetWriter2WithVersionBridge'));
  assert(bridge.includes("path: 'DIRECT_V11'"));
  assert(bridge.includes("path: 'V14_CHANGE_ISOLATED_VIA_V11'"));

  assert(tab.includes('mountCiiWorkspaceScopedEngineeringShell'));
  assert(tab.includes('const writerVersion = writerVersionOverride || context.writerVersion || null;'));
  assert(tab.includes('...(writerVersion ? { writerVersion } : {})'));
  assert(tab.includes("const openWriter2 = () => open('2');"));
  assert(!tab.includes("writerVersion: '2'"), 'product tile must not silently switch the default to Writer 2');
}

console.log('Writer 2 product routing is bridge-bound for V11/V14 and Writer2 export is byte/proof-authoritative while the production default remains Writer 1B.');
