import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  'tabs/revision-compare/revision-compare-engineering-svg-scene.js',
  'tabs/revision-compare/revision-compare-engineering-svg-viewer.js',
  'tabs/revision-compare/revision-compare-svg-surfaces.js',
  'tabs/revision-compare/revision-compare-svg-viewport.js',
  'tabs/revision-compare/revision-compare-svg-styles.js',
  'tabs/revision-compare/revision-compare-viewer-backend.js',
  'tabs/revision-compare/revision-compare-viewer-contract.js',
  'tabs/revision-compare/revision-compare-viewer-policy.js',
  'tabs/revision-compare/revision-compare-property-evidence.js',
  'tabs/revision-compare/revision-compare-property-inspector.js',
];
const forbidden = [
  'command-gateway', 'edit-runtime', 'overlay-runtime', 'edit-coordinator', 'draft-store',
  'property-mutation', 'interaction-session', 'snap-acquisition', 'precision-geometry-mutation',
  'engineering-svg-workspace-shell', 'workbench3d/', 'localStorage', 'sessionStorage',
  'window.addEventListener', 'document.addEventListener', 'revision-compare-worker',
  'revision-compare-service', 'revision-load-service', 'MutationObserver', 'setInterval(', 'setTimeout(',
];
for (const path of files) {
  const source = await readFile(path, 'utf8');
  assert(source.trimEnd().split('\n').length < 300, `${path} must remain below 300 lines`);
  assert.equal(/export\s+default/.test(source), false, `${path} must use named exports`);
  for (const token of forbidden) assert.equal(source.includes(token), false, `${path} reaches forbidden ${token}`);
}

const policyPaths = [
  'tabs/revision-compare/revision-compare-viewer-policy.js',
  'tabs/revision-compare/revision-compare-lifecycle.js',
  'tabs/revision-compare/revision-compare-viewer-adapter.js',
  'tabs/revision-compare/revision-compare-review-view.js',
  'tabs/revision-compare/revision-compare-workspace.js',
];
for (const path of policyPaths) {
  const source = await readFile(path, 'utf8');
  for (const token of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'URLSearchParams']) {
    assert.equal(source.includes(token), false, `${path} must not persist viewer preference through ${token}`);
  }
}

const policy = await readFile('tabs/revision-compare/revision-compare-viewer-policy.js', 'utf8');
assert.match(policy, /RevisionCompareViewerPolicy\.v1/);
assert.match(policy, /defaultBackend.*SVG/s);
assert.match(policy, /defaultSvgPresentation.*overlay/s);
assert.match(policy, /EXPLICIT_USER_ACTION/);
assert.match(policy, /WORKSPACE_ONLY/);
assert.match(policy, /recoveryBackendForSvgFailure.*WEBGL/s);
assert.match(policy, /recoveryBackendForWebglFailure.*SVG/s);

const backendSource = await readFile('tabs/revision-compare/revision-compare-viewer-backend.js', 'utf8');
const reviewSource = await readFile('tabs/revision-compare/revision-compare-review-view.js', 'utf8');
const workspaceSource = await readFile('tabs/revision-compare/revision-compare-workspace.js', 'utf8');
const activeUi = [backendSource, reviewSource, workspaceSource].join('\n');
assert.doesNotMatch(activeUi, /SVG preview/, 'active Revision Compare terminology must use Engineering SVG');
assert.match(backendSource, /Engineering SVG/);
assert.match(backendSource, /3D \(WebGL\)/);
assert.match(reviewSource, /Return to \$\{revisionCompareViewerBackendLabel\(backend\)\}/);
assert.match(workspaceSource, /Return to \$\{revisionCompareViewerBackendLabel\(backend\)\}/);
assert.match(reviewSource, /recoveryBackendForSvgFailure/);
assert.match(reviewSource, /recoveryBackendForWebglFailure/);

const viewport = await readFile('tabs/revision-compare/revision-compare-svg-viewport.js', 'utf8');
assert.match(viewport, /REVISION_COMPARE_SVG_FINE_PAN = 0\.05/);
assert.match(viewport, /REVISION_COMPARE_SVG_COARSE_PAN = 0\.20/);
assert.match(viewport, /REVISION_COMPARE_SVG_KEYBOARD_ZOOM_FACTOR = 1\.20/);
assert.match(viewport, /Object\.freeze\(\{ x: 0\.5, y: 0\.5 \}\)/);
assert.match(viewport, /normalizeRevisionCompareSvgViewportKey/);
assert.match(viewport, /addEventListener\('keydown'/);
assert.match(viewport, /removeEventListener\('keydown'/);
assert.match(viewport, /listeners\.size \* 7/);
assert.doesNotMatch(viewport, /case ['"]Enter|case ['"] |Home|End|PageUp|PageDown|Escape/);

const surfaces = await readFile('tabs/revision-compare/revision-compare-svg-surfaces.js', 'utf8');
assert.match(surfaces, /setAttribute\('role', 'group'\)/);
assert.match(surfaces, /setAttribute\('tabindex', '0'\)/);
assert.match(surfaces, /data-revc-svg-keyboard-surface/);
assert.match(surfaces, /aria-describedby/);
assert.match(surfaces, /aria-keyshortcuts/);
assert.match(surfaces, /Revision comparison Engineering SVG overlay/);
assert.match(surfaces, /Revision comparison Rev A source Engineering SVG pane/);
assert.match(surfaces, /Revision comparison Rev B target Engineering SVG pane/);
assert.match(surfaces, /data-revc-svg-keyboard-instructions/);
assert.doesNotMatch(surfaces, /SVG preview/);

const styles = await readFile('tabs/revision-compare/revision-compare-svg-styles.js', 'utf8');
assert.match(styles, /data-revc-svg-keyboard-surface.*:focus-visible/s);
assert.match(styles, /outline:\s*3px/);

const evidence = await readFile('tabs/revision-compare/revision-compare-property-evidence.js', 'utf8');
assert.match(evidence, /RevisionDifferenceRow\.v1\.changedProperties/);
assert.match(evidence, /previousValue:\s*property\.revAValue/);
assert.match(evidence, /value:\s*property\.revBValue/);
assert.match(evidence, /previousSource:\s*property\.revAEvidencePath/);
assert.match(evidence, /source:\s*property\.revBEvidencePath/);
assert.match(evidence, /INVALID_EVIDENCE_PATH/);
assert.match(evidence, /validEvidencePath/);
assert.match(evidence, /editable:\s*false/);
assert.doesNotMatch(evidence, /unit:\s*['"`]/, 'Revision Compare must not infer property units');
assert.doesNotMatch(evidence, /fetch\(|readFile\(|source-document|revision-load-service/);
assert.match(evidence, /sourceDocumentLookups:\s*0/);

const inspector = await readFile('tabs/revision-compare/revision-compare-property-inspector.js', 'utf8');
assert.doesNotMatch(inspector, /setBackend|setPresentationMode|setSelection|fitAll|fitSelection|previewPair/);
assert.doesNotMatch(inspector, /EngineeringSvgWorkspaceShell|commandGateway|createEngineeringSvgDraftStore/);
assert.doesNotMatch(inspector, /Open file|Browse|Copy path|Resolve|Navigate|Locate source|Reveal in folder/i);
assert.doesNotMatch(inspector, /<a\b|createElement\(['"]a['"]\)/);

const packageSource = await readFile('tabs/revision-compare/revision-evidence-package.js', 'utf8');
assert(packageSource.trimEnd().split('\n').length < 300, 'evidence package module must remain below 300 lines');
assert.match(packageSource, /RevisionCompareEvidencePackage\.v1/);
assert.match(packageSource, /createRevisionSessionManifest/);
assert.match(packageSource, /createRevisionScopeManifest/);
assert.match(packageSource, /createReviewSessionExport/);
assert.match(packageSource, /createDecisionLedgerExport/);
assert.match(packageSource, /sha256Text/);
assert.match(packageSource, /Object\.keys\(value\)\.sort\(\)/);
assert.match(packageSource, /REVISION_COMPARE_EVIDENCE_PACKAGE_ID_PREFIX.*contentSha256/s);
assert.doesNotMatch(packageSource, /Date\.now|Math\.random|randomUUID|crypto\.getRandomValues|global counter/i);
assert.doesNotMatch(packageSource, /viewer|viewport|fitHistory|selectedDifference|queue|DOM|Blob|createObjectURL|THREE/);
assert.doesNotMatch(packageSource, /source-document|revision-load-service|fileHandle|rawBytes|arrayBuffer\(|\.text\(\)/);
assert.doesNotMatch(packageSource, /parseRevisionCompareEvidencePackage|importRevisionCompareEvidencePackage|restoreWorkspace/);
assert.doesNotMatch(packageSource, /package (?:is )?(?:approved|signed|final|complete)|sign-off/i);
assert.doesNotMatch(packageSource, /new Map|new Set/);

const importSource = await readFile('tabs/revision-compare/revision-evidence-package-import.js', 'utf8');
const stateSource = await readFile('tabs/revision-compare/revision-workspace-state.js', 'utf8');
const viewSource = await readFile('tabs/revision-compare/revision-compare-view.js', 'utf8');
const signOffSource = await readFile('tabs/revision-compare/revision-sign-off.js', 'utf8');
for (const [path, source] of [
  ['revision-evidence-package-import.js', importSource], ['revision-workspace-state.js', stateSource],
  ['revision-compare-workspace.js', workspaceSource], ['revision-compare-view.js', viewSource],
  ['revision-sign-off.js', signOffSource],
]) {
  assert(source.trimEnd().split('\n').length < 300, `${path} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default\b/, `${path} must use named exports`);
}
assert.match(importSource, /JSON\.parse/);
assert.match(importSource, /canonicalRevisionCompareEvidenceValue/);
assert.match(importSource, /revisionCompareEvidencePackageHashMaterial/);
assert.match(importSource, /sha256Text/);
assert.match(importSource, /verifyReviewSessionRecord/);
assert.match(importSource, /verifyDecisionEvidenceRecord/);
assert.match(importSource, /Package authenticity is not established\./);
assert.doesNotMatch(importSource, /eval\s*\(|new Function|Function\s*\(|DOMParser|fetch\s*\(|XMLHttpRequest|WebSocket/);
assert.doesNotMatch(importSource, /revision-load-service|revision-compare-service|revision-compare-worker|createRevisionCompareAudit|projectCompareRecords|matchBoundedCandidates/);
assert.doesNotMatch(importSource, /source-document|rawUploadedBytes|fileHandle|arrayBuffer\(|createObjectURL|Blob|path\.resolve|readFile\(/);
assert.doesNotMatch(importSource, /package (?:is )?(?:authenticated|signed|approved|certified|final|trusted)/i);
assert.match(stateSource, /RevisionCompareWorkspaceState\.v12/);
assert.match(stateSource, /RevisionEvidencePackageImportState\.v1/);
assert.match(stateSource, /RevisionCompareSignOffState\.v1/);
assert.match(workspaceSource, /data-revc-evidence-package-import/);
assert.match(workspaceSource, /verifyRevisionCompareEvidencePackageJson/);
assert.match(viewSource, /user-facing "Import evidence package" option is intentionally removed/);
assert.doesNotMatch(viewSource, />Import evidence package</);
assert.match(viewSource, /REVISION_EVIDENCE_PACKAGE_AUTHENTICITY_STATEMENT/);
assert.match(workspaceSource, /data-revc-download-evidence-package/);
assert.match(workspaceSource, /Download evidence package/);
assert.match(workspaceSource, /revisionCompareEvidencePackageReadiness/);

assert.match(signOffSource, /RevisionCompareSignOffReport\.v1/);
assert.match(signOffSource, /RevisionCompareSignOffState\.v1/);
assert.match(signOffSource, /createRevisionCompareEvidencePackage/);
assert.match(signOffSource, /canonicalRevisionCompareEvidenceValue/);
assert.match(signOffSource, /sha256Text/);
assert.match(signOffSource, /revision-sign-off:/);
assert.match(signOffSource, /This is a self-declared review completion record\. Declarant identity and cryptographic authenticity are not established\./);
assert.match(signOffSource, /I confirm that I reviewed the complete Revision Compare evidence set identified by this report and that all review items and ambiguity decisions are resolved in the recorded states\./);
assert.match(signOffSource, /does not cover transfer intent, plans, or patched target output/);
assert.doesNotMatch(signOffSource, /Date\.now|Math\.random|randomUUID|getRandomValues|privateKey|publicKey|certificate/i);
assert.doesNotMatch(signOffSource, /revision-compare-viewer|engineering-svg|property-inspector|revision-load-service|revision-compare-service|revision-compare-worker/);
assert.doesNotMatch(signOffSource, /authenticated|digitally signed|externally certified|organization-approved|engineering-approved|accepted for construction|final design authority/i);
for (const selector of [
  'data-revc-sign-off-name', 'data-revc-sign-off-role', 'data-revc-sign-off-organization',
  'data-revc-sign-off-confirm', 'data-revc-create-sign-off', 'data-revc-download-sign-off',
  'data-revc-create-new-sign-off',
]) assert.match(signOffSource, new RegExp(selector));
assert.match(workspaceSource, /createRevisionCompareSignOffReport/);
assert.match(workspaceSource, /revisionCompareSignOffAuthorityMatches/);
assert.match(workspaceSource, /setWorkspaceSignOffReport/);

const transferPaths = [
  'tabs/revision-compare/revision-json-document.js',
  'tabs/revision-compare/revision-transfer-contracts.js',
  'tabs/revision-compare/revision-transfer-policy.js',
  'tabs/revision-compare/revision-transfer-address.js',
  'tabs/revision-compare/revision-transfer-plan.js',
  'tabs/revision-compare/revision-transfer-writer.js',
  'tabs/revision-compare/revision-transfer-verifier.js',
  'tabs/revision-compare/revision-transfer-result.js',
  'tabs/revision-compare/revision-transfer-artifacts.js',
  'tabs/revision-compare/revision-transfer-apply-state.js',
];
for (const path of transferPaths) {
  const source = await readFile(path, 'utf8');
  assert(source.trimEnd().split('\n').length < 300, `${path} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default\b/, `${path} must use named exports`);
  assert.doesNotMatch(source, /xml-compare\/|tabs\/xml-compare-tab|createObjectURL|Blob\s*\(|DOMParser|globalThis\.document|globalThis\.window|renderer|THREE/);
}
const transferUiPaths = [
  'tabs/revision-compare/revision-transfer-controller.js',
  'tabs/revision-compare/revision-transfer-view.js',
  'tabs/revision-compare/revision-transfer-workspace-bindings.js',
];
const transferUiSources = [];
for (const path of transferUiPaths) {
  const source = await readFile(path, 'utf8'); transferUiSources.push(source);
  assert(source.trimEnd().split('\n').length < 300, `${path} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default|xml-compare\/|tabs\/xml-compare-tab|DOMParser|revision-compare-viewer|viewerAdapter|THREE|Date\.now|Math\.random/);
}
const transferUi = transferUiSources.join('\n');
for (const selector of [
  'data-revc-transfer-section', 'data-revc-transfer-pair', 'data-revc-transfer-field',
  'data-revc-create-transfer-plan', 'data-revc-apply-transfer', 'data-revc-download-patched-json',
  'data-revc-download-transfer-audit', 'data-revc-download-transfer-proof', 'data-revc-download-transfer-manifest',
]) assert.match(transferUi, new RegExp(selector));
assert.match(transferUi, /createRevisionCompareTransferSelection/);
assert.match(transferUi, /validateRevisionCompareTransferArtifact/);
assert.match(transferUi, /revokeObjectURL/);
assert.match(workspaceSource, /createRevisionCompareTransferWorkspaceBindings/);

const jsonDocumentSource = await readFile(transferPaths[0], 'utf8');
const transferContractsSource = await readFile(transferPaths[1], 'utf8');
const transferPolicySource = await readFile(transferPaths[2], 'utf8');
const transferAddressSource = await readFile(transferPaths[3], 'utf8');
const transferPlanSource = await readFile(transferPaths[4], 'utf8');
const transferWriterSource = await readFile(transferPaths[5], 'utf8');
const transferVerifierSource = await readFile(transferPaths[6], 'utf8');
const transferResultSource = await readFile(transferPaths[7], 'utf8');
const transferArtifactsSource = await readFile(transferPaths[8], 'utf8');
const transferApplyStateSource = await readFile(transferPaths[9], 'utf8');
const intakeSource = await readFile('tabs/revision-compare/revision-intake-state.js', 'utf8');
const loadSource = await readFile('tabs/revision-compare/revision-load-service.js', 'utf8');
assert.match(jsonDocumentSource, /RevisionCompareJsonDocumentSnapshot\.v1/);
assert.match(transferContractsSource, /RevisionCompareTransferSelection\.v1/);
assert.match(transferContractsSource, /RevisionCompareTransferOperation\.v1/);
assert.match(transferContractsSource, /RevisionCompareTransferPlan\.v1/);
assert.match(transferContractsSource, /RevisionCompareTransferState\.v1/);
assert.match(transferPolicySource, /revision-transfer-field-policy\.v1/);
assert.match(transferAddressSource, /Target entity address resolves to zero entities/);
assert.match(transferAddressSource, /Target entity address resolves to multiple entities/);
assert.match(transferContractsSource, /revision-transfer-plan:/);
assert.match(transferPlanSource, /REV_A_TO_REV_B/);
assert.match(transferWriterSource, /RevisionCompareTransferWriterPolicy\.v1/);
assert.match(transferVerifierSource, /RevisionCompareTransferProof\.v1/);
assert.match(transferResultSource, /RevisionCompareTransferResult\.v1/);
assert.match(transferArtifactsSource, /RevisionCompareTransferManifest\.v1/);
assert.match(transferApplyStateSource, /RevisionCompareTransferApplyRequest\.v1/);
assert.match(loadSource, /createRevisionCompareJsonDocumentSnapshot/);
assert.match(intakeSource, /jsonSnapshot/);
assert.match(stateSource, /transfer:\s*createRevisionCompareTransferState\(/);
assert.match(stateSource, /function authorityAfterChange/);
assert.match(stateSource, /function transferLifecycleChange/);
assert.match(stateSource, /setWorkspaceReviewSession.*authorityAfterChange/);
assert.match(stateSource, /setWorkspaceDecisionLedger.*authorityAfterChange/);
assert.match(stateSource, /startWorkspaceLoad.*authorityAfterChange/s);
assert.match(stateSource, /setWorkspacePresentation\(state, mode\).*deepFreeze/s);
assert.doesNotMatch(stateSource.match(/export function setWorkspacePresentation[^\n]+/)?.[0] ?? '', /authorityAfterChange/);

console.log('revision-compare-svg-dependency-guard.test.mjs passed');
