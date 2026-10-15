import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const production = [
  'tabs/revision-compare/revision-transfer-writer.js',
  'tabs/revision-compare/revision-transfer-verifier.js',
  'tabs/revision-compare/revision-transfer-result.js',
  'tabs/revision-compare/revision-transfer-artifacts.js',
  'tabs/revision-compare/revision-transfer-apply-state.js',
  'tabs/revision-compare/revision-transfer-contracts.js',
  'tabs/revision-compare/revision-transfer-completion.js',
  'tabs/revision-compare/revision-transfer-handover.js',
  'tabs/revision-compare/revision-transfer-completion-state.js',
  'tabs/revision-compare/revision-transfer-completion-controller.js',
  'tabs/revision-compare/revision-transfer-completion-view.js',
  'tabs/revision-compare/revision-transfer-completion-workspace-state.js',
  'tabs/revision-compare/revision-workspace-state.js',
];
const sources = new Map();
for (const path of production) {
  const source = await readFile(path, 'utf8');
  sources.set(path, source);
  assert(source.trimEnd().split('\n').length < 300, `${path} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default\b/, `${path} must use named exports`);
  assert.doesNotMatch(source, /xml-compare\/|tabs\/xml-compare-tab|\.github\/workflows/);
  assert.doesNotMatch(source, /Date\.now|Math\.random|randomUUID|getRandomValues/);
}

const applySource = [
  sources.get('tabs/revision-compare/revision-transfer-writer.js'),
  sources.get('tabs/revision-compare/revision-transfer-verifier.js'),
  sources.get('tabs/revision-compare/revision-transfer-result.js'),
  sources.get('tabs/revision-compare/revision-transfer-artifacts.js'),
  sources.get('tabs/revision-compare/revision-transfer-apply-state.js'),
].join('\n');
assert.doesNotMatch(applySource, /createObjectURL|DOMParser|globalThis\.document|globalThis\.window|\bdocument\.(?:create|query|body|addEventListener)|\bwindow\.(?:addEventListener|location)|renderer|THREE/);
assert.doesNotMatch(applySource, /click\(|download\s*=|createElement\(['"]a['"]\)|Blob\s*\(/);
assert.doesNotMatch(applySource, /workbench3d|viewer state|visible row|table row/i);

const writer = sources.get('tabs/revision-compare/revision-transfer-writer.js');
const verifier = sources.get('tabs/revision-compare/revision-transfer-verifier.js');
const applyState = sources.get('tabs/revision-compare/revision-transfer-apply-state.js');
const contracts = sources.get('tabs/revision-compare/revision-transfer-contracts.js');
const completion = sources.get('tabs/revision-compare/revision-transfer-completion.js');
const handover = sources.get('tabs/revision-compare/revision-transfer-handover.js');
const workspace = sources.get('tabs/revision-compare/revision-workspace-state.js');
assert.match(writer, /plan\.operations\.map\([^\n]*validateOperation/);
assert.match(writer, /const mutable = cloneJson\(revB\.parsedValue\)/);
assert.match(writer, /validated\.forEach\([^\n]*applyValidatedOperation/);
assert.match(writer, /JSON\.stringify\(value, null, REVISION_COMPARE_TRANSFER_WRITER_POLICY\.indentationSpaces\)/);
assert.doesNotMatch(writer, /stableStringify\(value\).*patchedTargetText/s,
  'target serialization must not recursively canonical-sort the engineering document');
assert.match(verifier, /discoverChanges\(input\.originalSnapshot\.parsedValue, input\.patchedSnapshot\.parsedValue\)/);
assert.match(verifier, /Unrelated mutation detected/);
assert.match(applyState, /RevisionCompareTransferApplyRequest\.v1/);
assert.match(applyState, /applyGeneration/);
assert.match(applyState, /result: null, audit: null, proof: null, manifest: null/);
assert.match(contracts, /APPLYING: 'APPLYING'/);
assert.match(contracts, /APPLIED: 'APPLIED'/);
assert.match(completion, /RevisionCompareTransferCompletionReport\.v1/);
assert.match(handover, /RevisionCompareTransferHandoverBundle\.v1/);
assert.match(workspace, /RevisionCompareWorkspaceState\.v12/);
assert.doesNotMatch(workspace.match(/export function setWorkspacePresentation[^\n]+/)?.[0] ?? '', /Authority|Apply|Completion/);
assert.doesNotMatch(workspace.match(/export function setWorkspaceViewerBackend[^\n]+/)?.[0] ?? '', /Authority|Apply|Completion/);

console.log('revision-compare-transfer-apply-scope-guard.test.mjs passed');
