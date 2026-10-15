import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createLinewiseUniversalPreset } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { createUniversalLoadedPreviewBundle, createUniversalLoadedPreviewBundle as makeBundle, UNIVERSAL_LOADED_PREVIEW_BUNDLE_SCHEMA } from '../xml-compare/universal-categorizer/universal-loaded-preview-bundle.js';
import { createUniversalPreviewModel, createUniversalPreviewModelFromLoadedData } from '../xml-compare/universal-categorizer/universal-preview-model.js';
import { createUniversalWorkspaceViewModel } from '../xml-compare/universal-categorizer/universal-workspace-view-model.js';
import { findForbiddenUxc001Changes } from '../xml-compare/universal-categorizer/universal-source-registry.js';

const profile = createLinewiseUniversalPreset();
const sourceInputsA = {
  mainXml: { columns: ['DocumentRoot'], rows: [] },
  lineIdLookup: { rows: [{ TO_NODE: '102', FROM_NODE: '101', LINE_ID: 'LOADED-100' }] },
  coordinateLookup: { rows: [{ GLOBAL_Y: '20', NODE: '101', GLOBAL_X: '10', GLOBAL_Z: '30' }] },
  restraintLookup: { rows: [{ TAG: 'RS-102', NODE: '102', TYPE: 'GUIDE', STIFFNESS: '500', GAP: '3' }] },
};
const sourceInputsB = {
  restraintLookup: { rows: [{ GAP: '3', STIFFNESS: '500', TYPE: 'GUIDE', NODE: '102', TAG: 'RS-102' }] },
  coordinateLookup: { rows: [{ GLOBAL_Z: '30', GLOBAL_X: '10', NODE: '101', GLOBAL_Y: '20' }] },
  lineIdLookup: { rows: [{ LINE_ID: 'LOADED-100', FROM_NODE: '101', TO_NODE: '102' }] },
  mainXml: { rows: [], columns: ['DocumentRoot'] },
};
const targetRows = [
  { label: 'Element 101-102', elementKey: '101+102', levelId: 'element' },
  { nodeNumber: '101', label: 'Node 101', levelId: 'node' },
  { label: 'Node 102', levelId: 'node', nodeNumber: '102' },
];
const bundleA = createUniversalLoadedPreviewBundle({ profile, sourceInputs: sourceInputsA, targetRows });
const bundleB = makeBundle({ profile, sourceInputs: sourceInputsB, targetRows });
assert.equal(bundleA.schema, UNIVERSAL_LOADED_PREVIEW_BUNDLE_SCHEMA);
assert.equal(bundleA.profileId, 'linewise-universal-preset');
assert.equal(bundleA.exportLocked, true);
assert.equal(bundleA.summary.targetRows, 3);
assert.equal(bundleA.summary.sourceRows, 3);
assert.deepEqual(bundleA.sourceInputs.coordinateLookup.columns, ['GLOBAL_X', 'GLOBAL_Y', 'GLOBAL_Z', 'NODE']);
assert.deepEqual(bundleA.targetRows[0], { elementKey: '101+102', label: 'Element 101-102', levelId: 'element' });
assert.equal(JSON.stringify(bundleA), JSON.stringify(bundleB), 'Loaded preview bundle must be deterministic for equivalent inputs');
const emptyBundle = createUniversalLoadedPreviewBundle({ profile, sourceInputs: {}, targetRows: [] });
const diagnosticCodes = emptyBundle.diagnostics.map((item) => item.code);
assert.ok(diagnosticCodes.includes('UXC_LOADED_SOURCE_MISSING'));
assert.ok(diagnosticCodes.includes('UXC_LOADED_SOURCE_ROWS_EMPTY'));
assert.ok(diagnosticCodes.includes('UXC_LOADED_TARGET_ROWS_EMPTY'));
assert.equal(emptyBundle.exportLocked, true);
const preview = createUniversalPreviewModel({ profile, previewBundle: bundleA });
assert.equal(preview.previewBundleSchema, UNIVERSAL_LOADED_PREVIEW_BUNDLE_SCHEMA);
assert.equal(preview.exportLocked, true);
assert.ok(preview.tree.nodes.some((node) => node.label === 'Element 101-102'));
assert.ok(preview.tree.nodes.some((node) => node.label === 'Node 101'));
assert.ok(preview.tree.nodes.some((node) => node.label === 'Node 102'));
assert.ok(preview.pivot.rows.some((row) => row.block === 'LineBlock' && row.field === 'LINE_ID' && row.value === 'LOADED-100'));
assert.ok(preview.pivot.rows.some((row) => row.block === 'DerivedCoordinateBlock' && row.field === 'GLOBAL_X' && row.value === '10'));
assert.ok(preview.pivot.rows.some((row) => row.block === 'RestraintsBlock' && row.field === 'TAG' && row.value === 'RS-102'));
const previewFromLoadedData = createUniversalPreviewModelFromLoadedData({ profile, sourceInputs: sourceInputsA, targetRows });
assert.equal(previewFromLoadedData.previewBundleSchema, UNIVERSAL_LOADED_PREVIEW_BUNDLE_SCHEMA);
assert.ok(previewFromLoadedData.pivot.rows.some((row) => row.value === 'LOADED-100'));
const workspace = createUniversalWorkspaceViewModel({ profile, previewBundle: bundleA });
assert.equal(workspace.samplePreview.previewBundleSchema, UNIVERSAL_LOADED_PREVIEW_BUNDLE_SCHEMA);
assert.equal(workspace.exportGate.blocked, true);
assert.ok(workspace.samplePreview.pivot.rows.some((row) => row.value === 'RS-102'));
const changedForbiddenFiles = findForbiddenUxc001Changes(changedFilesFromGit());
assert.deepEqual(changedForbiddenFiles, [], `UXC-009 modified forbidden files: ${changedForbiddenFiles.join(', ')}`);
function changedFilesFromGit() {
  const baseRef = safeGitRef(process.env.GITHUB_BASE_REF || 'main');
  const commands = [`git fetch --no-tags --depth=1 origin ${baseRef}:refs/remotes/origin/${baseRef} && git diff --name-only --diff-filter=ACMRTUXB origin/${baseRef}...HEAD`, `git diff --name-only --diff-filter=ACMRTUXB origin/${baseRef}...HEAD`, `git diff --name-only --diff-filter=ACMRTUXB ${baseRef}...HEAD`];
  for (const command of commands) { try { const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))]; } catch {} }
  return [];
}
function safeGitRef(value) { const ref = String(value || 'main').trim(); return /^[A-Za-z0-9._/-]+$/.test(ref) ? ref : 'main'; }
console.log('xml-compare-universal-loaded-preview-bundle tests passed');
