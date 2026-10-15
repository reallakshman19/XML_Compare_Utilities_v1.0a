/** Phase 5 acceptance: declarative tools, inspector registry, and accessible shell. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EDIT_CAPABILITIES, EDIT_OPERATION_CAPABILITIES, EDIT_SHELL_CAPABILITIES, EDIT_TOOL_CAPABILITIES,
  evaluateTopologyEditCapabilities, topologyEditCapabilityButtonsMarkup,
} from '../tabs/topology-trace-validator/topology-edit-capability-registry.js';
import {
  TOPOLOGY_EDIT_INSPECTOR_SECTIONS, buildRegisteredTopologyEditInspectorMarkup,
} from '../tabs/topology-trace-validator/topology-edit-inspector-registry.js';
import { workspaceMarkup } from '../tabs/topology-trace-validator/topology-workspace-markup.js';

assert.equal(new Set(EDIT_CAPABILITIES.map((row) => row.id)).size, EDIT_CAPABILITIES.length);
assert.equal(EDIT_TOOL_CAPABILITIES.length, 6);
assert.equal(EDIT_OPERATION_CAPABILITIES.length, 3);
assert.equal(EDIT_SHELL_CAPABILITIES.length, 8);

const unavailable = evaluateTopologyEditCapabilities({ initialized: false, busy: false, selection: [], tool: 'SELECT', canUndo: false, canRedo: false });
assert.equal(unavailable['tool.select'].enabled, false);
assert.equal(unavailable['operation.merge'].reason, 'Select exactly two nodes.');
const nodesReady = evaluateTopologyEditCapabilities({ initialized: true, busy: false, selection: [{ kind: 'node', id: 'N1' }, { kind: 'node', id: 'N2' }], tool: 'MOVE', canUndo: true, canRedo: false });
assert.equal(nodesReady['operation.merge'].enabled, true);
assert.equal(nodesReady['operation.delete'].enabled, false);
assert.equal(nodesReady['tool.move'].active, true);
assert.equal(nodesReady['history.undo'].enabled, true);
const edgeReady = evaluateTopologyEditCapabilities({ initialized: true, busy: false, selection: [{ kind: 'edge', id: 'E1' }], tool: 'SELECT', canUndo: false, canRedo: true });
assert.equal(edgeReady['operation.delete'].enabled, true);
assert.equal(edgeReady['operation.disconnect'].enabled, true);
assert.equal(edgeReady['scene.focus'].enabled, true);

const buttonMarkup = topologyEditCapabilityButtonsMarkup(EDIT_TOOL_CAPABILITIES, 'tool.select');
assert.match(buttonMarkup, /data-ttv-edit-capability="tool\.measure"/);
assert.match(buttonMarkup, /aria-keyshortcuts="M"/);
assert.match(buttonMarkup, /aria-pressed|is-active/);
const shell = workspaceMarkup();
assert.equal((shell.match(/data-ttv-edit-capability=/g) ?? []).length, EDIT_CAPABILITIES.length);
assert.match(shell, /id="ttv-edit-keyboard-help"/);
assert.match(shell, /data-ttv-edit-undo/);

assert.equal(new Set(TOPOLOGY_EDIT_INSPECTOR_SECTIONS.map((row) => row.id)).size, TOPOLOGY_EDIT_INSPECTOR_SECTIONS.length);
const canonical = {
  nodes: [{ id: 'N1', position: { x: 1, y: 2, z: 3 } }, { id: 'N2', position: { x: 4, y: 5, z: 6 } }],
  edges: [{ id: 'E1', fromNodeId: 'N1', toNodeId: 'N2', segmentRole: 'PIPE' }], supports: [], rigids: [],
};
const nodeInspector = buildRegisteredTopologyEditInspectorMarkup({ canonical, validation: { findings: [] }, selection: [{ kind: 'node', id: 'N1' }], contextEdgeId: 'E1' });
assert.match(nodeInspector, /data-ttv-edit-coordinate="x"/);
assert.match(nodeInspector, /Lineage and record/);
assert.doesNotMatch(nodeInspector, /data-ttv-edit-split-fraction/);
const edgeInspector = buildRegisteredTopologyEditInspectorMarkup({ canonical, validation: { findings: [] }, selection: [{ kind: 'edge', id: 'E1' }], contextEdgeId: 'E1' });
assert.match(edgeInspector, /data-ttv-edit-split-fraction/);
assert.doesNotMatch(edgeInspector, /data-ttv-edit-coordinate="x"/);

const sources = [
  '../tabs/topology-trace-validator/topology-edit-capability-registry.js',
  '../tabs/topology-trace-validator/topology-edit-command-router.js',
  '../tabs/topology-trace-validator/topology-edit-inspector-registry.js',
];
for (const path of sources) {
  const source = readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  assert(source.split(/\r?\n/).length < 300, `${path} must remain below 300 lines`);
  assert(!/export\s+default\b/.test(source), `${path} must use named exports`);
}
const wiring = readFileSync(fileURLToPath(new URL('../tabs/topology-trace-validator/topology-workspace-wiring.js', import.meta.url)), 'utf8');
assert.doesNotMatch(wiring, /querySelectorAll\('\[data-ttv-edit-tool\]'/);
assert.match(wiring, /wireTopologyEditCommandRouter/);
const viewer = readFileSync(fileURLToPath(new URL('../workbench3d/viewer/workbench-viewer.js', import.meta.url)), 'utf8');
assert.match(viewer, /setAttribute\('role', 'application'\)/);
assert.match(viewer, /aria-keyshortcuts/);
console.log('Phase 5 capability shell acceptance passed.');
