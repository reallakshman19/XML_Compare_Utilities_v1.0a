import assert from 'node:assert/strict';
import {
  buildPipelineArtifactPanelHtml,
  summarizePipelineArtifacts,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-artifact-panel-presentation.js';

const artifacts = [
  {
    name: 'readiness.json',
    role: 'ENGINEERING_EVIDENCE',
    sourceSchema: 'PipelineInputXmlReadinessEvidence.v1',
    text: '{"ready":true}',
  },
  {
    name: 'source<1>.tsv',
    role: 'SOURCE_TABLE',
    sourceSchema: 'PipelineTable1.v1',
    text: 'μ',
  },
];

const summary = summarizePipelineArtifacts(artifacts);
assert.equal(summary.artifactCount, 2);
assert.equal(summary.totalBytes, 16);
assert.equal(summary.totalSizeLabel, '16 B');
assert.equal(summary.items[1].byteLength, 2);
assert.equal(Object.isFrozen(summary), true);
assert.equal(Object.isFrozen(summary.items), true);
assert.equal(Object.isFrozen(summary.items[0]), true);

const html = buildPipelineArtifactPanelHtml(artifacts);
assert.match(html, /2 artifacts — 16 B/);
assert.match(html, /ENGINEERING_EVIDENCE \| PipelineInputXmlReadinessEvidence\.v1 \| 14 B/);
assert.match(html, /data-p3d-artifact="1"/);
assert.match(html, /source&lt;1&gt;\.tsv/);
assert.doesNotMatch(html, /source<1>\.tsv/);
assert.match(html, /aria-label="Download readiness\.json:/);

const empty = buildPipelineArtifactPanelHtml([]);
assert.match(empty, /No artifacts available/);
assert.doesNotMatch(empty, /data-p3d-artifact-summary/);

console.log('pipeline-3d-model artifact panel presentation: PASS');
