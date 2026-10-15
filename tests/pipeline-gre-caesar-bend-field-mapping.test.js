import assert from 'node:assert/strict';
import { createPipelineGreCaesarBendFieldMapping,
  buildPipelineGreCaesarBendFieldMatrixTsv } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-bend-field-mapping.js';
import { qualifiedFixture, qualifiedFieldMapping } from './pipeline-gre-caesar-test-fixtures.js';

const fixture = qualifiedFixture();
const mapping = qualifiedFieldMapping(fixture);
assert.equal(mapping.ready, true);
assert.equal(mapping.bendTypeDisposition, 'EMIT_NUMERIC');
assert.equal(mapping.bendTypeCode, 3);
assert.equal(mapping.bendTypeLexicalValue, '3');
assert.equal(mapping.numMiterDisposition, 'OMIT_ATTRIBUTE');
assert.equal(mapping.numMiterValue, null);
assert.equal(mapping.curvatureNodeDisposition, 'NO_CURVATURE_NODES_REQUIRED');
assert.deepEqual(mapping.curvatureNodeRoles, []);
assert.doesNotMatch(JSON.stringify(mapping), /turnAngleDeg|ANGLE1|NODE1|"node":/);
assert.equal(buildPipelineGreCaesarBendFieldMatrixTsv([mapping]),
  buildPipelineGreCaesarBendFieldMatrixTsv([structuredClone(mapping)]));

const typeConflict = qualifiedFieldMapping(qualifiedFixture({ typeValue: 1 }));
assert.equal(typeConflict.ready, false);
assert.ok(typeConflict.blockerCodes.includes('PIPELINE_GRE_CAESAR_BEND_TYPE_UNRESOLVED'));

const lexicalFixture = qualifiedFixture({ typeLexicalValue: '3.000000' });
const lexicalConflict = qualifiedFieldMapping(lexicalFixture);
assert.equal(lexicalConflict.ready, false);
assert.ok(lexicalConflict.blockerCodes.includes('PIPELINE_GRE_CAESAR_BEND_TYPE_UNRESOLVED'));
const lexicalQualified = qualifiedFieldMapping(lexicalFixture, { bendTypeLexicalValue: '3.000000' });
assert.equal(lexicalQualified.ready, true);

const sentinelFixture = qualifiedFixture({ numMiterAttributePresent: true, numMiterValue: -1.0101,
  numMiterLexicalValue: '-1.010100' });
const sentinel = qualifiedFieldMapping(sentinelFixture, { numMiterLexicalValue: '-1.010100' });
assert.equal(sentinel.ready, true);
const wrongSentinelLexical = qualifiedFieldMapping(sentinelFixture, { numMiterLexicalValue: '-1.0101' });
assert.equal(wrongSentinelLexical.ready, false);
assert.ok(wrongSentinelLexical.blockerCodes.includes('PIPELINE_GRE_CAESAR_NUM_MITER_UNRESOLVED'));

const curvatureFixture = qualifiedFixture({ caseId: 'F4', curvatureNodes: [
  { angle: 45, node: 109, role: 'USER_MIDPOINT' }] });
const curvature = qualifiedFieldMapping(curvatureFixture);
assert.equal(curvature.ready, true);
assert.deepEqual(curvature.curvatureNodeRoles, ['USER_MIDPOINT']);
assert.doesNotMatch(JSON.stringify(curvature), /109/);
const forged = createPipelineGreCaesarBendFieldMapping({ ...structuredClone(curvature),
  fixtureIds: [fixture.fixtureId], fixtures: [fixture], curvatureNodeRoles: ['USER_MIDPOINT'] });
assert.equal(forged.ready, false);
assert.ok(forged.blockerCodes.includes('PIPELINE_GRE_CAESAR_CURVATURE_NODE_POLICY_UNRESOLVED'));
console.log('pipeline GRE CAESAR bend field mapping: PASS');
