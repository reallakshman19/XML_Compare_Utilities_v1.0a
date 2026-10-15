import assert from 'node:assert/strict';
import { createPipelineGreCaesarBendTopologyMapping,
  buildPipelineGreCaesarTopologyMatrixTsv } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-bend-topology-mapping.js';
import { qualifiedFixture, qualifiedTopologyMapping } from './pipeline-gre-caesar-test-fixtures.js';

const directFixture = qualifiedFixture({ caseId: 'F6', mode: 'TANGENCY_SEPARATED_BRIDGE' });
const direct = qualifiedTopologyMapping(directFixture);
assert.equal(direct.ready, true);
assert.equal(direct.currentP3dGre055Compatibility, 'DIRECTLY_WRITER_COMPATIBLE');
assert.equal(direct.currentP3dGre055Questions.distinctTangencyNodeNumbersAllowed, true);
assert.equal(direct.inactiveCornerDisposition, 'NOT_SERIALIZED');
assert.notEqual(direct.outgoingTangencyDisposition, 'CURVATURE_NODE');

const consistentFixture = structuredClone(directFixture);
consistentFixture.fixtureId = 'fixture:F6-consistent-session';
const consistentSession = createPipelineGreCaesarBendTopologyMapping({ ...structuredClone(direct),
  topologyMappingId: 'topology:consistent-session',
  fixtureIds: [directFixture.fixtureId, consistentFixture.fixtureId],
  fixtures: [directFixture, consistentFixture] });
assert.equal(consistentSession.ready, true);
assert.equal(consistentSession.caesarVersion, '14.00');
assert.equal(consistentSession.unitFileId, 'unit:metric');

const conflictingFixture = structuredClone(consistentFixture);
conflictingFixture.fixtureId = 'fixture:F6-conflicting-session';
conflictingFixture.unitFileId = 'unit:imperial';
const conflictingSession = createPipelineGreCaesarBendTopologyMapping({ ...structuredClone(direct),
  topologyMappingId: 'topology:conflicting-session',
  fixtureIds: [directFixture.fixtureId, conflictingFixture.fixtureId],
  fixtures: [directFixture, conflictingFixture] });
assert.equal(conflictingSession.ready, false);
assert.equal(conflictingSession.currentP3dGre055Compatibility, 'UNRESOLVED');
assert.ok(conflictingSession.blockerCodes.includes('PIPELINE_GRE_CAESAR_FIXTURE_UNAUTHENTICATED'));

const sharedFixture = qualifiedFixture({ caseId: 'F7', mode: 'CONSECUTIVE_SHARED_LOGICAL_NODE' });
const shared = qualifiedTopologyMapping(sharedFixture);
assert.equal(shared.ready, true);
assert.equal(shared.currentP3dGre055Compatibility, 'REQUIRES_CAESAR_TOPOLOGY_REPROJECTION');
assert.equal(shared.currentP3dGre055Questions.sharedLogicalNodeRequired, true);

const falseShared = structuredClone(sharedFixture);
falseShared.continuityRecords[0].leavingFromNode = 120;
const relationshipConflict = qualifiedTopologyMapping(falseShared);
assert.equal(relationshipConflict.ready, false);
assert.ok(relationshipConflict.blockerCodes.includes('PIPELINE_GRE_CAESAR_TOPOLOGY_UNRESOLVED'));

const badOwner = structuredClone(directFixture);
badOwner.continuityRecords[0].bendOwnerElementId = badOwner.continuityRecords[0].leavingElementId;
const ownerConflict = qualifiedTopologyMapping(badOwner);
assert.equal(ownerConflict.ready, false);
assert.ok(ownerConflict.blockerCodes.includes('PIPELINE_GRE_CAESAR_TOPOLOGY_UNRESOLVED'));

const arbitraryRole = qualifiedTopologyMapping(directFixture, {
  roles: { enteringElementToRole: 'ANY_NON_EMPTY_STRING' } });
assert.equal(arbitraryRole.ready, false);
assert.ok(arbitraryRole.blockerCodes.includes('PIPELINE_GRE_CAESAR_ROLE_SEMANTICS_UNRESOLVED'));

const reprojected = createPipelineGreCaesarBendTopologyMapping({ ...structuredClone(shared),
  topologyMappingId: 'topology:reprojected', caesarTopologyMode: 'CAESAR_SPECIFIC_REPROJECTED_TOPOLOGY',
  fixtureIds: [sharedFixture.fixtureId], fixtures: [sharedFixture] });
assert.equal(reprojected.ready, false);
assert.ok(reprojected.blockerCodes.includes('PIPELINE_GRE_CAESAR_SUCCESSOR_NOT_AUTHORIZED'));

const tsv = buildPipelineGreCaesarTopologyMatrixTsv([shared, direct]);
assert.equal(tsv, buildPipelineGreCaesarTopologyMatrixTsv([direct, shared]));
console.log('pipeline GRE CAESAR bend topology mapping: PASS');