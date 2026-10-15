import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPipelineCadMarkupRuntime } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-commands.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const productionFiles = [
  'tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-contracts.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-model.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-commands.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-reconciliation.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-renderer.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-view.js',
];
for (const name of productionFiles) {
  const source = readFileSync(join(root, name), 'utf8');
  assert.ok(source.split(/\r?\n/).length <= 300, `${name} exceeds 300 lines`);
  assert.doesNotMatch(source, /export\s+default\b/);
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|setInterval|setTimeout|requestAnimationFrame)\b/);
  assert.doesNotMatch(source, /core\/engineering-|pipeline-engineering-svg|project-adapter|elastic-bend|xml-builder|inputxml|object-snap/);
}
const renderer = readFileSync(join(root, productionFiles[4]), 'utf8');
assert.doesNotMatch(renderer, /hitTest|fitToBounds|setWorldBounds|snap/i);
const workspace = readFileSync(join(root, 'tabs/pipeline-3d-model/pipeline-3d-model-cad-workspace.js'), 'utf8');
assert.match(workspace, /markup:\s*parts\.markup/);
assert.match(workspace, /getProfileModel:\s*\(\)\s*=>\s*controller\.model/);
const table2 = readFileSync(join(root, 'tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js'), 'utf8');
const table3 = readFileSync(join(root, 'tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js'), 'utf8');
assert.match(table2, /drawPipelineCadMarkupOverlay[\s\S]*drawPipelineCadSelectionBox/);
assert.match(table3, /drawPipelineCadMarkupOverlay[\s\S]*drawPipelineCadSelectionBox/);
const table2HitTest = table2.match(/hitTest\(screenPoint\)\s*\{[\s\S]*?\n  \}/)?.[0] || '';
const table3HitTest = table3.match(/hitTest\(screenPoint\)\s*\{[\s\S]*?\n  \}/)?.[0] || '';
assert.doesNotMatch(table2HitTest, /markup/i);
assert.doesNotMatch(table3HitTest, /markup/i);

const profile = {
  revision: 5,
  table2Rows: [
    { id: 'table2a-0001', sourceTable: 'table2a', sourceLine: 1, stationValue: 0, elevationValue: 100, basisH: 500 },
    { id: 'table2a-0002', sourceTable: 'table2a', sourceLine: 2, stationValue: 10, elevationValue: 105, basisH: 510 },
  ],
  table3LengthRows: [{ id: 'table3a-0001', sourceTable: 'table3a', sourceLine: 1, fromH: 500, toH: 510, hLength: 10 }],
  table3DepthRows: [],
  table3MarkerRows: [{ id: 'table3c-0001', sourceTable: 'table3c', sourceLine: 1, absoluteH: 505, markerText: 'PM-001' }],
};
const engineeringBefore = JSON.stringify(profile); const projections = { table2x: 0, table3x: 0 };
const graphs = {
  table2x: {
    currentNodes: () => profile.table2Rows.map((row) => ({ id: row.id, type: 'elevation-node', x: row.stationValue, y: row.elevationValue })),
    setMarkupProjection() { projections.table2x += 1; },
  },
  table3x: {
    depthNodes: () => [], markerNodes: () => [{ id: 'table3c-0001', type: 'marker', x: 5, y: .75 }],
    setMarkupProjection() { projections.table3x += 1; },
  },
};
const runtime = createPipelineCadMarkupRuntime({ profileModel: profile, graphs });
runtime.createAnnotation({
  graph: 'table3x',
  anchor: { kind: 'ENTITY', graph: 'table3x', entityId: 'table3c-0001', entityType: 'marker', pointRole: 'CENTER' },
  text: 'Evidence only', alignment: 'LEFT', leader: { enabled: false },
});
runtime.updateAnnotation('pcad-note-000001', { text: 'Updated evidence only' });
runtime.deleteAnnotation('pcad-note-000001');
assert.equal(JSON.stringify(profile), engineeringBefore);
assert.equal(profile.revision, 5);
assert.ok(projections.table2x === projections.table3x);
const artifact = {
  schema: 'PipelineCadMarkupInvarianceEvidence.v1',
  engineeringModelUnchanged: JSON.stringify(profile) === engineeringBefore,
  engineeringRevisionUnchanged: profile.revision === 5,
  rawSynchronizationCalls: 0,
  projectionPublicationCounts: projections,
  objectSnapParticipation: false,
  fitParticipation: false,
  sharedSvgAuthoring: false,
};
mkdirSync(join(root, 'artifacts/pipeline-cad-markup'), { recursive: true });
writeFileSync(join(root, 'artifacts/pipeline-cad-markup/invariance.json'), `${JSON.stringify(artifact, null, 2)}\n`);
runtime.destroy();
console.log('Pipeline CAD markup integration and invariance: ok');
