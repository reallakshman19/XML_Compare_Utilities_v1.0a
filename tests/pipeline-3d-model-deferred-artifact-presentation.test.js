import assert from 'node:assert/strict';
import {
  buildPipelineArtifactPanelHtml,
  summarizePipelineArtifacts,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-artifact-panel-presentation.js';
import {
  createPipelineOnDemandTextArtifact,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-on-demand-artifact.js';

let builds = 0;
const deferred = createPipelineOnDemandTextArtifact({
  name: 'pipeline-evidence-bundle.json', role: 'ENGINEERING_EVIDENCE',
  sourceSchema: 'PipelineEvidenceBundle.v1',
}, () => { builds += 1; return 'large payload'; });
const artifacts = [
  { name: 'status.json', role: 'ENGINEERING_EVIDENCE',
    sourceSchema: 'Status.v1', text: '{}' },
  deferred,
];
const summary = summarizePipelineArtifacts(artifacts);
assert.equal(builds, 0, 'panel summary must not materialize deferred text');
assert.equal(summary.totalBytes, 2);
assert.equal(summary.deferredCount, 1);
assert.equal(summary.items[1].byteLength, null);
assert.equal(summary.items[1].sizeLabel, 'generated on download');
const html = buildPipelineArtifactPanelHtml(artifacts);
assert.equal(builds, 0, 'panel HTML must not materialize deferred text');
assert.match(html, /2 artifacts — 2 B loaded \+ 1 generated on download — 1 role/);
assert.match(html, /generated on download/);
assert.equal(deferred.text, 'large payload');
assert.equal(builds, 1);

console.log('pipeline-3d-model deferred artifact presentation: PASS');
