import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const shell = read('../tabs/cii-workspace/cii-workspace-shell.js');
const scopedUi = read('../tabs/cii-workspace/cii-workspace-transfer-scope-ui.js');
const engineeringUi = read('../tabs/cii-workspace/cii-workspace-engineering-ui.js');
const tab = read('../tabs/cii-workspace/cii-workspace-tab.js');
const bridge = read('../tabs/cii-workspace/cii-workspace-writer-version-bridge.js');
const utilities = read('../tabs/psnm-utility-tab.js');

// Ordinary product default remains unchanged; Writer2 is explicit, not silently selected.
assert.match(utilities, /\['CII Workspace', '\.\/cii-workspace\/cii-workspace-tab\.js', 'installCiiWorkspaceTile', true\]/);
assert.match(tab, /data-ciiw-open-writer2/);
assert.match(tab, /CII Writer 2 — V11 \/ V14/);
assert.match(tab, /const openDefault = \(\) => open\(\);/);
assert.match(tab, /const openWriter2 = \(\) => open\('2'\);/);
assert.match(tab, /const writer2Tile = context\.writerVersion \? null : workspaceTile/);
assert.doesNotMatch(tab, /writerVersion:\s*'2'/);

// Explicit Writer2 inspection, preview and apply all cross the version bridge.
assert.match(shell, /inspectCiiWorkspaceModelsWithVersionBridge/);
assert.match(shell, /createCiiWorkspacePreviewWithVersionBridge/);
assert.match(shell, /applyCiiWorkspaceTargetWriter2WithVersionBridge/);
assert.match(shell, /writer2BridgeSelected\(options\).*options\?\.writerVersion === '2'/s);
assert.match(shell, /if \(version === '2'\) return applyCiiWorkspaceTargetWriter2WithVersionBridge;/);
assert.doesNotMatch(shell, /if \(version === '2'\) return applyCiiWorkspaceTargetWriter2;/);

// Writer2 export is independently fail-closed at the shell boundary: no text fallback.
assert.match(shell, /applied\?\.writer === 'WRITER_2'/);
assert.match(shell, /CII_WRITER_2_VERSION_BRIDGE_VALIDATION_REQUIRED/);
assert.match(shell, /applied\?\.versionBridgeValidation\?\.status !== 'PASS'/);
assert.match(shell, /CII_WRITER_2_BYTE_STRING_REQUIRED/);
assert.match(shell, /typeof applied\?\.byteString !== 'string'/);
assert.match(shell, /binaryBytes\(applied\.byteString\)/);
assert.match(shell, /applied\?\.writer === 'WRITER_1C'/);
assert.doesNotMatch(shell, /\['WRITER_1C', 'WRITER_2'\]\.includes\(applied\?\.writer\)/);

// The separate engineering evidence inspection must use raw bytes and the same bridge.
assert.match(engineeringUi, /inspectCiiWorkspaceModelsWithVersionBridge/);
assert.match(engineeringUi, /options\?\.writerVersion === '2' \? inspectCiiWorkspaceModelsWithVersionBridge : inspectCiiWorkspaceModels/);
assert.match(engineeringUi, /sourceBytes:\s*new Uint8Array\(await sourceFile\.arrayBuffer\(\)\)/);
assert.match(engineeringUi, /targetBytes:\s*new Uint8Array\(await targetFile\.arrayBuffer\(\)\)/);
assert.match(engineeringUi, /current\?\.writerVersion \|\| options\?\.writerVersion \|\| '1B'/);

// Bound APPLY/EXCLUDE scope must retain bridge evidence and cannot fall back to direct Writer2.
assert.match(scopedUi, /applyCiiWorkspaceTargetWriter2WithVersionBridge/);
assert.match(scopedUi, /function writer2BridgeReady\(preview\)/);
assert.match(scopedUi, /Boolean\(preview\?\.versionBridge\)/);
assert.match(scopedUi, /Writer 2 version-bridge evidence is missing/);
assert.match(scopedUi, /writer2BridgeReady\(scopedPreview\)/);
assert.match(scopedUi, /if \(version === '2'\) return applyCiiWorkspaceTargetWriter2WithVersionBridge;/);
assert.doesNotMatch(scopedUi, /if \(version === '2'\) return applyCiiWorkspaceTargetWriter2;/);

// Writer2 export is independently fail-closed at the scoped boundary too.
assert.match(scopedUi, /applied\?\.writer === 'WRITER_2'/);
assert.match(scopedUi, /CII_WRITER_2_VERSION_BRIDGE_VALIDATION_REQUIRED/);
assert.match(scopedUi, /applied\?\.versionBridgeValidation\?\.status !== 'PASS'/);
assert.match(scopedUi, /CII_WRITER_2_BYTE_STRING_REQUIRED/);
assert.match(scopedUi, /typeof applied\?\.byteString !== 'string'/);
assert.match(scopedUi, /binaryBytes\(applied\.byteString\)/);
assert.match(scopedUi, /applied\?\.writer === 'WRITER_1C'/);
assert.doesNotMatch(scopedUi, /\['WRITER_1C', 'WRITER_2'\]\.includes\(applied\?\.writer\)/);

// The bridge itself retains independent V11 and V14 paths and the projected V14 proof.
assert.match(bridge, /export async function inspectCiiWorkspaceModelsWithVersionBridge/);
assert.match(bridge, /export async function createCiiWorkspacePreviewWithVersionBridge/);
assert.match(bridge, /export async function applyCiiWorkspaceTargetWriter2WithVersionBridge/);
assert.match(bridge, /path:\s*'DIRECT_V11'/);
assert.match(bridge, /path:\s*'V14_CHANGE_ISOLATED_VIA_V11'/);
assert.match(bridge, /CII_VERSION_BRIDGE_PROJECTED_V14_NORMALIZED_POSTIMAGE_MISMATCH/);
assert.match(bridge, /ciiBytesEqual\(v11PostimageBytes, projectedProof\.outputBytes\)/);

console.log('Writer2 W2.34 live V11/V14 bridge routing and byte-export custody source qualification passed.');
