import assert from 'node:assert/strict';
import {
  renderPipelineApprovedCatalogStatus,
  resolvePipelineApprovedCatalogStatus,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-status.js';

const inactive = resolvePipelineApprovedCatalogStatus();
assert.deepEqual(inactive, {
  state: 'INACTIVE',
  registryReference: null,
  bindingCount: 0,
  blockerCodes: [],
  label: 'Approved catalog: inactive',
});
assert.equal(Object.isFrozen(inactive), true);
assert.equal(Object.isFrozen(inactive.blockerCodes), true);

const ready = resolvePipelineApprovedCatalogStatus({
  diagnostics: {
    approvedCatalogAdoptionActive: true,
    approvedCatalogAdoptionReady: true,
    approvedCatalogRegistryReference: 'P3D-CATALOG@R1#sha256:abc',
    approvedCatalogBindingCount: 2,
  },
});
assert.equal(ready.state, 'READY');
assert.equal(ready.label,
  'Approved catalog: P3D-CATALOG@R1#sha256:abc — adopted — 2 bindings');

const blocked = resolvePipelineApprovedCatalogStatus({
  diagnostics: {
    approvedCatalogAdoptionActive: true,
    approvedCatalogAdoptionReady: false,
    approvedCatalogBindingCount: 1,
  },
  orchestration: {
    blockerCodes: ['PIPELINE_APPROVED_CATALOG_REGISTRY_REQUIRED'],
  },
  exportQualification: {
    blockerCodes: ['PIPELINE_APPROVED_CATALOG_REGISTRY_REQUIRED', 'OTHER_BLOCKER'],
  },
});
assert.equal(blocked.state, 'BLOCKED');
assert.equal(blocked.label, 'Approved catalog: approved registry — blocked — 1 binding');
assert.deepEqual(blocked.blockerCodes, ['PIPELINE_APPROVED_CATALOG_REGISTRY_REQUIRED']);

const noDom = renderPipelineApprovedCatalogStatus(null, {
  diagnostics: { approvedCatalogAdoptionActive: false },
});
assert.equal(noDom.state, 'INACTIVE');

console.log('pipeline-3d-model approved catalog status: PASS');
