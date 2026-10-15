import assert from 'node:assert/strict';
import {
  buildPipelineGreCaesarBendQualificationPlan,
  buildPipelineGreCaesarFixtureInventoryJson,
  buildPipelineGreCaesarBendFieldMatrixTsv,
  buildPipelineGreCaesarTopologyMatrixTsv,
  buildPipelineGreCaesarFixtureRequestMarkdown,
  createRepositoryGreCaesarQualificationPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-bend-qualification.js';
import { buildPipelineGreCaesarQualificationPlanJson } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-qualification-contracts.js';
import { qualifiedFixture, qualifiedFieldMapping,
  qualifiedTopologyMapping } from './pipeline-gre-caesar-test-fixtures.js';

function profile(field, topology) {
  return { profileId: `profile:${field.mappingId}`, caesarVersion: field.caesarVersion,
    caesarBuild: field.caesarBuild, unitFileId: field.unitFileId, unitFileSha256: field.unitFileSha256,
    pipingCodeId: field.pipingCodeId, pipingCodeName: field.pipingCodeName,
    pipingCodeEdition: field.pipingCodeEdition, laminateClassification: field.laminateClassification,
    fieldMappingId: field.mappingId, topologyMappingId: topology.topologyMappingId,
    fixtureIds: [...field.fixtureIds, ...topology.fixtureIds], sourceAuthority: 'CAESAR_IMPORT_AND_ROUND_TRIP',
    sourceReferences: ['operator-log'] };
}

function fieldMatrix() {
  const fixtures = ['F1', 'F2', 'F3', 'F4', 'F5'].map((caseId) => qualifiedFixture({ caseId,
    curvatureNodes: caseId === 'F4' ? [{ angle: 45, node: 109, role: 'USER_MIDPOINT' }] : [] }));
  return { fixtures, fields: fixtures.map((fixture) => qualifiedFieldMapping(fixture)) };
}

const directMatrix = fieldMatrix();
const f6 = qualifiedFixture({ caseId: 'F6', mode: 'TANGENCY_SEPARATED_BRIDGE' });
const directTopology = qualifiedTopologyMapping(f6);
const qualified = buildPipelineGreCaesarBendQualificationPlan({ governingBaseline: 'BASE',
  fixtures: [...directMatrix.fixtures, f6], fieldMappings: directMatrix.fields,
  topologyMappings: [directTopology],
  qualificationProfiles: directMatrix.fields.map((field) => profile(field, directTopology)) });
assert.equal(qualified.ready, true);
assert.equal(qualified.qualificationOutcome, 'QUALIFIED');
assert.equal(qualified.topologyDecision, 'F6_ACCEPTED_DIRECT');
assert.equal(qualified.currentP3dGre055Compatibility, 'DIRECTLY_WRITER_COMPATIBLE');
assert.equal(qualified.writerAuthorized, false);
assert.equal(qualified.productXmlGenerated, false);
assert.equal(Object.isFrozen(qualified), true);
assert.equal(buildPipelineGreCaesarQualificationPlanJson(qualified),
  buildPipelineGreCaesarQualificationPlanJson(structuredClone(qualified)));

const reconciliationMatrix = fieldMatrix();
const rejectedF6 = qualifiedFixture({ caseId: 'F6', fixtureId: 'fixture:F6-rejected',
  importResult: 'REJECTED' });
const f7 = qualifiedFixture({ caseId: 'F7', mode: 'CONSECUTIVE_SHARED_LOGICAL_NODE' });
const sharedTopology = qualifiedTopologyMapping(f7);
const reconciliation = buildPipelineGreCaesarBendQualificationPlan({ governingBaseline: 'BASE',
  fixtures: [...reconciliationMatrix.fixtures, rejectedF6, f7], fieldMappings: reconciliationMatrix.fields,
  topologyMappings: [sharedTopology],
  qualificationProfiles: reconciliationMatrix.fields.map((field) => profile(field, sharedTopology)) });
assert.equal(reconciliation.ready, false);
assert.equal(reconciliation.qualificationOutcome, 'TOPOLOGY_RECONCILIATION_REQUIRED');
assert.equal(reconciliation.topologyDecision, 'F6_REJECTED_F7_ACCEPTED');
assert.equal(reconciliation.currentP3dGre055Compatibility, 'REQUIRES_CAESAR_TOPOLOGY_REPROJECTION');
assert.equal(reconciliation.writerAuthorized, false);

const loneF1 = directMatrix.fixtures[0], loneField = directMatrix.fields[0];
const incomplete = buildPipelineGreCaesarBendQualificationPlan({ governingBaseline: 'BASE',
  fixtures: [loneF1, f6], fieldMappings: [loneField], topologyMappings: [directTopology],
  qualificationProfiles: [profile(loneField, directTopology)] });
assert.equal(incomplete.ready, false);
assert.equal(incomplete.qualificationOutcome, 'STILL_BLOCKED');
assert.ok(incomplete.blockerCodes.includes('PIPELINE_GRE_CAESAR_FIXTURE_MATRIX_INCOMPLETE'));

const loneF7 = buildPipelineGreCaesarBendQualificationPlan({ governingBaseline: 'BASE',
  fixtures: [...reconciliationMatrix.fixtures, f7], fieldMappings: reconciliationMatrix.fields,
  topologyMappings: [sharedTopology],
  qualificationProfiles: reconciliationMatrix.fields.map((field) => profile(field, sharedTopology)) });
assert.equal(loneF7.qualificationOutcome, 'STILL_BLOCKED');
assert.ok(loneF7.blockerCodes.includes('PIPELINE_GRE_CAESAR_F6_F7_DECISION_UNRESOLVED'));

const duplicate = buildPipelineGreCaesarBendQualificationPlan({ governingBaseline: 'BASE',
  fixtures: [...directMatrix.fixtures, structuredClone(directMatrix.fixtures[0]), f6],
  fieldMappings: directMatrix.fields, topologyMappings: [directTopology],
  qualificationProfiles: directMatrix.fields.map((field) => profile(field, directTopology)) });
assert.equal(duplicate.ready, false);
assert.ok(duplicate.blockerCodes.includes('PIPELINE_GRE_CAESAR_FIXTURE_CONFLICT'));

const repository = createRepositoryGreCaesarQualificationPlan();
assert.equal(repository.ready, false);
assert.equal(repository.qualificationOutcome, 'STILL_BLOCKED');
assert.equal(repository.currentP3dGre055Compatibility, 'UNRESOLVED');
assert.match(repository.derivedTopologyAssessment, /^INFERENCE_ONLY:/);
assert.equal(buildPipelineGreCaesarFixtureInventoryJson(repository.fixtures),
  buildPipelineGreCaesarFixtureInventoryJson([...repository.fixtures].reverse()));
assert.equal(buildPipelineGreCaesarBendFieldMatrixTsv(repository.fieldMappings),
  buildPipelineGreCaesarBendFieldMatrixTsv([...repository.fieldMappings].reverse()));
assert.equal(buildPipelineGreCaesarTopologyMatrixTsv(repository.topologyMappings),
  buildPipelineGreCaesarTopologyMatrixTsv([...repository.topologyMappings].reverse()));
const request = buildPipelineGreCaesarFixtureRequestMarkdown();
for (const id of ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7']) assert.match(request, new RegExp(`\\| ${id} \\|`));
assert.match(request, /warning-free/);
assert.match(request, /native job/);
assert.match(request, /numeric and lexical values/);
console.log('pipeline GRE CAESAR bend qualification: PASS');
