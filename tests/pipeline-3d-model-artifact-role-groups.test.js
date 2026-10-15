import assert from 'node:assert/strict';
import {
  buildPipelineArtifactPanelHtml,
  groupPipelineArtifactsByRole,
  summarizePipelineArtifacts,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-artifact-panel-presentation.js';

const artifacts = [
  { name: 'status.json', role: 'ENGINEERING_EVIDENCE',
    sourceSchema: 'Status.v1', text: '{"ok":true}' },
  { name: 'table.tsv', role: 'SOURCE_TABLE',
    sourceSchema: 'Table.v1', text: 'μ' },
  { name: 'readiness.json', role: 'ENGINEERING_EVIDENCE',
    sourceSchema: 'Readiness.v1', text: '{}' },
];
const before = JSON.stringify(artifacts);
const summary = summarizePipelineArtifacts(artifacts);
assert.equal(summary.artifactCount, 3);
assert.equal(summary.totalBytes, 15);
assert.deepEqual(summary.items.map((item) => item.index), [0, 1, 2]);

const groups = groupPipelineArtifactsByRole(summary.items);
assert.deepEqual(groups.map((group) => group.role),
  ['ENGINEERING_EVIDENCE', 'SOURCE_TABLE']);
assert.deepEqual(groups[0].items.map((item) => item.index), [0, 2]);
assert.deepEqual(groups[1].items.map((item) => item.index), [1]);
assert.equal(Object.isFrozen(groups), true);
assert.equal(Object.isFrozen(groups[0]), true);
assert.equal(Object.isFrozen(groups[0].items), true);

const html = buildPipelineArtifactPanelHtml(artifacts);
assert.match(html, /3 artifacts — 15 B — 2 roles/);
assert.match(html, /data-p3d-artifact-role="ENGINEERING_EVIDENCE" open/);
assert.match(html, /ENGINEERING_EVIDENCE — 2 artifacts/);
assert.match(html, /SOURCE_TABLE — 1 artifact/);
assert.match(html, /data-p3d-artifact="0"/);
assert.match(html, /data-p3d-artifact="2"/);
assert.match(html, /data-p3d-artifact="1"/);
assert.ok(html.indexOf('data-p3d-artifact="0"') < html.indexOf('data-p3d-artifact="2"'));
assert.equal(JSON.stringify(artifacts), before, 'role grouping must not mutate artifacts');

const escaped = buildPipelineArtifactPanelHtml([
  { name: '<unsafe>.json', role: 'ROLE&ONE', sourceSchema: '"Schema"', text: '' },
]);
assert.match(escaped, /&lt;unsafe&gt;\.json/);
assert.match(escaped, /ROLE&amp;ONE/);
assert.doesNotMatch(escaped, /<unsafe>/);

console.log('pipeline-3d-model artifact role groups: PASS');
