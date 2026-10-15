import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseSupportChangeXml,
  parseSupportMemberRelationshipXml,
} from '../tabs/ps-family-clash-audit/ps-family-psclash-xml-parser.js';
import {
  buildSupportPrimaryRelationshipBundle,
  SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA,
} from '../tabs/support-steel-relationship-builder/support-primary-relationship.js';
import {
  SUPPORT_REPORT_MULTI_LOCATION_REMARK,
  SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK,
} from '../tabs/support-steel-relationship-builder/support-report-location-grouping.js?issue=1222';

function clashXml({ name = 'Clash1', supportA, supportB, point = { x: 1, y: 2, z: 3 }, pipe = '' }) {
  const path = (member) => [
    '<node>File</node>',
    '<node>/ASIM-1835-CU-PI</node>',
    '<node>/ASIM-1835-CU-PI-P</node>',
    pipe ? `<node>/${pipe}/B1</node>` : '',
    `<node>/${member}</node>`,
  ].filter(Boolean).join('');
  return `<exchange><clashtests><clashtest><clashresults>
    <clashresult name="${name}" distance="0.001">
      <clashpoint><pos3f x="${point.x}" y="${point.y}" z="${point.z}"/></clashpoint>
      <clashobjects>
        <clashobject><pathlink>${path(supportA)}</pathlink></clashobject>
        <clashobject><pathlink>${path(supportB)}</pathlink></clashobject>
      </clashobjects>
    </clashresult>
  </clashresults></clashtest></clashtests></exchange>`;
}

function relationshipRow(supportA, supportB, overrides = {}) {
  return {
    edgeType: 'SupportChain',
    supportA,
    supportB,
    psRoot: String(supportA).replace(/^\//u, '').match(/^((?:PS|SL)-\d+[A-Z]?)/iu)?.[1] || '',
    supportRoots: [],
    sourceInput: 'Owner Support Relationship XML',
    clashName: `${supportA}-${supportB}`,
    relationshipBasis: ['EXPLICIT_SUPPORT_CLASH'],
    relationshipEvidenceId: `REL:${supportA}:${supportB}`,
    ...overrides,
  };
}

test('Support Report relationship parser retains member edge without pipe context while legacy parser stays pipe-gated', () => {
  const xml = clashXml({ supportA: 'PS-11167.2', supportB: 'PS-11167.11' });
  const legacy = parseSupportChangeXml(xml, { familyPrefixesText: 'PS, SL' }, 'Clash within Supports');
  const relationship = parseSupportMemberRelationshipXml(xml, { familyPrefixesText: 'PS, SL' });

  assert.equal(legacy.rows.length, 0);
  assert.equal(legacy.diagnostics[0].code, 'NO_SUPPORT_CHANGE_ROWS');
  assert.equal(relationship.rows.length, 1);
  assert.equal(relationship.rows[0].edgeType, 'SupportChain');
  assert.equal(relationship.rows[0].supportA, 'PS-11167.2');
  assert.equal(relationship.rows[0].supportB, 'PS-11167.11');
  assert.equal(relationship.rows[0].pipeContextStatus, 'UNAVAILABLE');
  assert.deepEqual(relationship.rows[0].relationshipBasis, ['EXPLICIT_SUPPORT_CLASH']);
  assert.ok(relationship.rows[0].objectA.path.includes('ASIM-1835-CU-PI-P'));
});

test('relationship parser preserves pipe context when it exists', () => {
  const pipe = 'ASIM-1835-2"-P8810320-31441C4-HT-01';
  const xml = clashXml({ supportA: 'PS-11167.2', supportB: 'PS-11167.11', pipe });
  const parsed = parseSupportMemberRelationshipXml(xml, { familyPrefixesText: 'PS, SL' });

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].pipeContextStatus, 'RESOLVED');
  assert.equal(parsed.rows[0].fullLineTag, pipe);
  assert.equal(parsed.rows[0].branchNode, `${pipe}/B1`);
});

test('explicit PS-11167 member edge builds one deterministic countable primary assembly', () => {
  const forward = buildSupportPrimaryRelationshipBundle({
    relationshipRows: [relationshipRow('/PS-11167.2', '/PS-11167.11')],
  });
  const reverse = buildSupportPrimaryRelationshipBundle({
    relationshipRows: [relationshipRow('/PS-11167.11', '/PS-11167.2')],
  });

  assert.equal(forward.schema, SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA);
  assert.equal(forward.summary.countableAssemblyCount, 1);
  assert.equal(forward.families[0].primarySupportAssemblyCount, 1);
  assert.equal(forward.assemblies[0].assemblyId, 'PSA::PS-11167::M-2+11');
  assert.deepEqual(forward.assemblies[0].concreteMemberIds, ['/PS-11167.2', '/PS-11167.11']);
  assert.equal(reverse.assemblies[0].assemblyId, forward.assemblies[0].assemblyId);
});

test('DATUM is retained as symbolic evidence without inflating concrete or primary-support count', () => {
  const bundle = buildSupportPrimaryRelationshipBundle({
    relationshipRows: [
      relationshipRow('/PS-11236.4', '/PS-11236.5'),
      relationshipRow('/PS-11236.5', '/PS-11236/DATUM'),
    ],
  });
  const assembly = bundle.assemblies[0];

  assert.equal(bundle.summary.countableAssemblyCount, 1);
  assert.equal(bundle.families[0].primarySupportAssemblyCount, 1);
  assert.equal(assembly.assemblyId, 'PSA::PS-11236::M-4+5');
  assert.equal(assembly.concreteMemberCount, 2);
  assert.deepEqual(assembly.concreteMemberIds, ['/PS-11236.4', '/PS-11236.5']);
  assert.deepEqual(assembly.symbolicMemberIds, ['/PS-11236/DATUM']);
});

test('coincident geometry does not merge distinct explicit primary-support components', () => {
  const point = { x: 100, y: 200, z: 300 };
  const bundle = buildSupportPrimaryRelationshipBundle({
    relationshipRows: [
      relationshipRow('/PS-12877.1', '/PS-12877.2', { point }),
      relationshipRow('/PS-12877.3', '/PS-12877.4', { point }),
    ],
  });

  assert.equal(bundle.summary.countableAssemblyCount, 2);
  assert.deepEqual(bundle.assemblies.map((item) => item.assemblyId), [
    'PSA::PS-12877::M-1+2',
    'PSA::PS-12877::M-3+4',
  ]);
});

test('cross-family relationship is fail-visible and excluded', () => {
  const bundle = buildSupportPrimaryRelationshipBundle({
    relationshipRows: [relationshipRow('/PS-11167.2', '/PS-11236.5', { supportRoots: ['PS-11167', 'PS-11236'] })],
  });

  assert.equal(bundle.summary.explicitEdgeCount, 0);
  assert.equal(bundle.summary.countableAssemblyCount, 0);
  assert.equal(bundle.diagnostics[0].code, 'SUPPORT_MEMBER_EDGE_FAMILY_CONFLICT');
});

test('user-facing multi-support remark is renamed while compatibility export remains stable', () => {
  assert.equal(SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK, 'Multiple primary support');
  assert.equal(SUPPORT_REPORT_MULTI_LOCATION_REMARK, SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK);
});
