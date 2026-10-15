import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PIPELINE_APPROVED_CATALOG_STATUS_ARTIFACT_NAME,
  pipelineApprovedCatalogVisibleArtifacts,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-status-artifact.js';

const artifacts = pipelineApprovedCatalogVisibleArtifacts({
  diagnostics: { approvedCatalogAdoptionActive: false },
  artifacts: [],
});
assert.ok(artifacts.some((item) =>
  item.name === PIPELINE_APPROVED_CATALOG_STATUS_ARTIFACT_NAME));

const adapterSource = readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js', import.meta.url), 'utf8');
assert.match(adapterSource,
  /import \{ pipelineApprovedCatalogVisibleArtifacts \} from '\.\/pipeline-3d-model-approved-catalog-status-artifact\.js';/);
assert.match(adapterSource,
  /for \(const item of pipelineApprovedCatalogVisibleArtifacts\(output\)\)/);

console.log('pipeline-3d-model approved catalog migration artifact: PASS');
