import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyCiiTransferDelta } from '../tabs/cii-workspace/cii-workspace-transfer-policy.js';
import { _test as scopedUiTest } from '../tabs/cii-workspace/cii-workspace-transfer-scope-ui.js';

const qualifiedNodeName = Object.freeze({
  category: 'NODE_NAME', property: 'Node name / to-name', changed: true,
  sourceValue: 'P-101A', targetValue: '', authority: 'CII_NODENAME_FIXED_LAYOUT',
});
const nodeClassification = classifyCiiTransferDelta(qualifiedNodeName);
assert.equal(nodeClassification.family, 'NODE_NAME');
assert.equal(nodeClassification.action, 'COPY');
assert.equal(nodeClassification.status, 'PREVIEW_READY');
assert.equal(nodeClassification.policyAuthority, 'CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD');

const noLayoutAuthority = classifyCiiTransferDelta(Object.freeze({ ...qualifiedNodeName, authority: 'UNQUALIFIED' }));
assert.equal(noLayoutAuthority.status, 'BLOCKED');
assert(noLayoutAuthority.blockers.includes('NODENAME_FIXED_LAYOUT_AUTHORITY_REQUIRED'));

const overwriteBlocked = classifyCiiTransferDelta(Object.freeze({ ...qualifiedNodeName, targetValue: 'OLD' }));
assert.equal(overwriteBlocked.status, 'BLOCKED');
assert(overwriteBlocked.blockers.includes('TARGET_NODENAME_NONBLANK'));
const overwriteExplicit = classifyCiiTransferDelta(Object.freeze({ ...qualifiedNodeName, targetValue: 'OLD' }), { allowNodeNameOverwrite: true });
assert.equal(overwriteExplicit.status, 'PREVIEW_READY');

const sifStillBlocked = classifyCiiTransferDelta(Object.freeze({
  category: 'SIF_TEE', property: 'SIF/Tee raw code (field 2)', changed: true,
  sourceValue: 2, targetValue: 1, authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD',
}));
assert.equal(sifStillBlocked.action, 'COPY');
assert.equal(sifStillBlocked.status, 'BLOCKED');
assert(sifStillBlocked.blockers.includes('SIF_TEE_FIELD_SEMANTICS_UNQUALIFIED'));

assert.equal(scopedUiTest.writerLabel(Object.freeze({ writerVersion: '1C' })), 'Writer 1C');
const raw1c = Object.freeze({ writerVersion: '1C', transferPlan: Object.freeze({
  sourceDocument: Object.freeze({ contentSha256: 'SRC' }), targetDocument: Object.freeze({ contentSha256: 'TGT' }),
  operations: Object.freeze([Object.freeze({
    operationId: 'op:name', action: 'COPY', family: 'NODE_NAME', property: 'Node name / to-name', status: 'PREVIEW_READY', blockers: Object.freeze([]),
  })]),
}), review: Object.freeze({ reviewedCorrespondenceIds: Object.freeze(['c1']), lockedCorrespondenceIds: Object.freeze([]), rejectedCorrespondenceIds: Object.freeze([]) }) });
const scopedMarkup = scopedUiTest.scopePanelMarkup(raw1c, new Map([['op:name', 'APPLY']]), Object.freeze({
  writerVersion: '1C', transferPlan: Object.freeze({ transferScope: Object.freeze({ status: 'UNBOUND' }) }),
}), false);
assert(scopedMarkup.includes('Writer 1C'));
assert(scopedMarkup.includes('<b>Writer:</b> 1C'));

const [coreSource, scopeSource, shellSource, tabSource] = await Promise.all([
  readFile(new URL('../tabs/cii-workspace/cii-workspace-core.js', import.meta.url), 'utf8'),
  readFile(new URL('../tabs/cii-workspace/cii-workspace-transfer-scope.js', import.meta.url), 'utf8'),
  readFile(new URL('../tabs/cii-workspace/cii-workspace-shell.js', import.meta.url), 'utf8'),
  readFile(new URL('../tabs/cii-workspace/cii-workspace-tab.js', import.meta.url), 'utf8'),
]);
assert(coreSource.includes("['1A', '1B', '1C', '2']"), 'core writer-version dispatcher must enumerate 1A/1B/1C/2');
assert(coreSource.includes("? options.writerVersion : '1B'"), 'production default must remain Writer 1B');
assert(coreSource.includes('ONE_ORIGINAL_PREIMAGE_COMPOSITE_1A_1B_1C'), 'Writer 1C contract must advertise one-preimage lower+1C composition');
assert(scopeSource.includes("preview?.writerVersion === '1C'"), 'scope readiness must route Writer 1C explicitly');
assert(scopeSource.includes('ciiWriterCompositeReadiness(transferPlan, preview.targetDocument)'), 'scope Writer 1C readiness must use composite TARGET custody');
assert(shellSource.includes('.arrayBuffer()'), 'workspace file reads must preserve original file bytes');
assert(shellSource.includes('applyCiiWorkspaceTargetWriter1C'), 'shell may invoke Writer 1C only through explicit version routing');
assert(tabSource.includes('context.writerVersion'), 'product host may deliberately request a qualified writer version');
assert(!tabSource.includes("writerVersion: '1C'"), 'product tile must not silently switch the default to Writer 1C');
assert(!tabSource.includes("writerVersion: '2'"), 'product tile must not silently switch the default to Writer 2');

console.log('CII Writer 1C policy, composite routing, Writer 2 compatibility, byte-input and default-authority guards passed.');
