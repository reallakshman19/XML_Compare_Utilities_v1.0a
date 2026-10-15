import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const production = [
  'tabs/revision-compare/revision-json-document.js',
  'tabs/revision-compare/revision-transfer-address.js',
  'tabs/revision-compare/revision-transfer-contracts.js',
  'tabs/revision-compare/revision-transfer-operation.js',
  'tabs/revision-compare/revision-transfer-plan.js',
  'tabs/revision-compare/revision-transfer-policy.js',
  'tabs/revision-compare/revision-intake-state.js',
  'tabs/revision-compare/revision-workspace-state.js',
];
const sources = new Map();
for (const path of production) {
  const source = await readFile(path, 'utf8');
  sources.set(path, source);
  assert(source.trimEnd().split('\n').length < 300, `${path} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default\b/, `${path} must use named exports`);
  assert.doesNotMatch(source, /xml-compare\/|tabs\/xml-compare-tab|\.github\/workflows/);
}
const transferSource = [...sources.entries()]
  .filter(([path]) => path.includes('revision-transfer-'))
  .map(([, source]) => source).join('\n');
assert.doesNotMatch(transferSource, /createObjectURL|DOMParser|globalThis\.document|globalThis\.window|document\.create|window\.|renderer|THREE/);
assert.doesNotMatch(transferSource, /applyTransfer|patched JSON|transfer result|transfer audit|transfer proof|transfer manifest|download/i);

const address = sources.get('tabs/revision-compare/revision-transfer-address.js');
const contracts = sources.get('tabs/revision-compare/revision-transfer-contracts.js');
const operation = sources.get('tabs/revision-compare/revision-transfer-operation.js');
const plan = sources.get('tabs/revision-compare/revision-transfer-plan.js');
const workspace = sources.get('tabs/revision-compare/revision-workspace-state.js');
assert.match(address, /REVISION_COMPARE_TARGET_STATE/);
assert.match(address, /PRESENT/);
assert.match(address, /ABSENT/);
assert.match(address, /array insertion/);
assert.match(operation, /REPLACE_EXISTING_PROPERTY/);
assert.match(operation, /ADD_MISSING_PROPERTY/);
assert.match(operation, /if \(present\) material\.beforeValue/);
assert.match(contracts, /RevisionCompareTransferAuthority\.v1/);
assert.match(contracts, /RevisionCompareTransferPlanRequest\.v1/);
assert.match(contracts, /nextGeneration/);
assert.match(contracts, /invalidateRevisionCompareTransferAuthority/);
assert.match(contracts, /canonicalEqual\(state\?\.authority, authority\)/);
assert.match(contracts, /requestMismatch/);
assert.doesNotMatch(contracts, /packageAuthority|evidencePackage/);
assert.doesNotMatch(plan, /package import|evidencePackage/);
assert.match(plan, /activity: authority\.activity/);
assert.match(workspace, /invalidateRevisionCompareTransferAuthority\(prior, next\)/);
assert.match(workspace, /reconcileRevisionCompareTransferAuthority\(state\.transfer, state\)/);
assert.match(workspace, /setWorkspaceReviewSession.*authorityAfterChange/s);
assert.match(workspace, /setWorkspaceReviewImportError.*authorityAfterChange/s);
assert.match(workspace, /setWorkspaceDecisionLedger.*authorityAfterChange/s);
assert.match(workspace, /setWorkspaceDecisionImportError.*authorityAfterChange/s);
assert.doesNotMatch(workspace.match(/export function setWorkspacePresentation[^\n]+/)?.[0] ?? '', /authorityAfterChange/);
assert.doesNotMatch(workspace, /startWorkspaceTransferPlan\(state, selection, generation\)/);
console.log('revision-compare-transfer-scope-guard.test.mjs passed');
