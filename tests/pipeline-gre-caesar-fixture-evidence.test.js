import assert from 'node:assert/strict';
import {
  createPipelineGreCaesarFixtureEvidence,
  createRepositoryGreInputXmlFixtureEvidence,
  buildPipelineGreCaesarFixtureInventoryJson,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-fixture-evidence.js';
import { qualifiedFixture } from './pipeline-gre-caesar-test-fixtures.js';

const fixture = qualifiedFixture();
assert.equal(fixture.ready, true);
assert.equal(Object.isFrozen(fixture), true);
assert.equal(Object.isFrozen(fixture.bendRecords), true);
assert.equal(fixture.fixtureCaseId, 'F1');
assert.equal(buildPipelineGreCaesarFixtureInventoryJson([fixture]),
  buildPipelineGreCaesarFixtureInventoryJson([structuredClone(fixture)]));

for (const [mutator, blocker] of [
  [(v) => { v.fixtureSha256 = ''; }, 'PIPELINE_GRE_CAESAR_FIXTURE_UNAUTHENTICATED'],
  [(v) => { v.caesarBuild = ''; }, 'PIPELINE_GRE_CAESAR_BUILD_UNRESOLVED'],
  [(v) => { v.unitFileSha256 = ''; }, 'PIPELINE_GRE_CAESAR_UNIT_FILE_UNRESOLVED'],
  [(v) => { v.nativeJobSha256 = ''; }, 'PIPELINE_GRE_CAESAR_NATIVE_JOB_UNAUTHENTICATED'],
  [(v) => { v.operatorLogSha256 = ''; }, 'PIPELINE_GRE_CAESAR_OPERATOR_LOG_UNAUTHENTICATED'],
  [(v) => { v.sourceCommitSha = ''; }, 'PIPELINE_GRE_CAESAR_SOURCE_COMMIT_UNRESOLVED'],
  [(v) => { v.importEvidence = { status: 'MISSING' }; }, 'PIPELINE_GRE_CAESAR_IMPORT_NOT_PROVEN'],
  [(v) => { v.roundTripEvidence.semanticEquivalent = false; }, 'PIPELINE_GRE_CAESAR_ROUND_TRIP_NOT_PROVEN'],
  [(v) => { v.roundTripEvidence.comparison.connectivityPreserved = false; },
    'PIPELINE_GRE_CAESAR_ROUND_TRIP_COMPARISON_INCOMPLETE'],
]) {
  const value = structuredClone(fixture); mutator(value);
  const blocked = createPipelineGreCaesarFixtureEvidence(value);
  assert.equal(blocked.ready, false);
  assert.ok(blocked.blockerCodes.includes(blocker));
}

const warned = structuredClone(fixture);
warned.importEvidence.warnings = ['DISMISSED_WARNING'];
warned.importEvidence.cleanImport = true;
const warnedResult = createPipelineGreCaesarFixtureEvidence(warned);
assert.equal(warnedResult.ready, false);
assert.ok(warnedResult.blockerCodes.includes('PIPELINE_GRE_CAESAR_IMPORT_WARNING_UNRESOLVED'));

const lexical = structuredClone(fixture);
lexical.bendRecords[0].typeLexicalValue = '03';
const lexicalResult = createPipelineGreCaesarFixtureEvidence(lexical);
assert.equal(lexicalResult.ready, true);
assert.equal(lexicalResult.bendRecords[0].typeLexicalValue, '03');

const rejectedF6 = qualifiedFixture({ caseId: 'F6', fixtureId: 'fixture:F6-rejected', importResult: 'REJECTED' });
assert.equal(rejectedF6.ready, true);
assert.equal(rejectedF6.importEvidence.result, 'REJECTED');
assert.equal(rejectedF6.roundTripEvidence.status, 'NOT_APPLICABLE');

const invalidRejected = qualifiedFixture({ caseId: 'F1', fixtureId: 'fixture:invalid-rejected',
  importResult: 'REJECTED' });
assert.equal(invalidRejected.ready, false);
assert.ok(invalidRejected.blockerCodes.includes('PIPELINE_GRE_CAESAR_IMPORT_NOT_PROVEN'));

const repository = createRepositoryGreInputXmlFixtureEvidence();
assert.equal(repository.ready, false);
assert.equal(repository.fixturePath, 'docs/GREInputxml.xml');
assert.ok(repository.blockerCodes.includes('PIPELINE_GRE_CAESAR_IMPORT_NOT_PROVEN'));
assert.ok(repository.blockerCodes.includes('PIPELINE_GRE_CAESAR_BUILD_UNRESOLVED'));
console.log('pipeline GRE CAESAR fixture evidence: PASS');
