import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupportCarrierResolutionBundle } from '../tabs/support-steel-relationship-builder/support-carrier-resolution.js';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-evidence-bundle.js';
import { collectSupportFamilies } from '../tabs/support-steel-relationship-builder/support-steel-source-reader.js';

function hierarchy(children) {
  return { objects: [{ type: 'BRANCH', attributes: { NAME: '/LINE-100/B1' }, children }] };
}

function pipe(id, children = []) {
  return {
    type: 'PIPE',
    attributes: { NAME: id, CARRIER_ID: id, POS: 'E 0 N 0 U 0' },
    children,
  };
}

function support(id, extra = {}) {
  return {
    type: 'ATTA',
    attributes: { NAME: id, POS: 'E 0 N 0 U 0', ...extra },
  };
}

function resolve(source) {
  const supportFamilies = collectSupportFamilies(source);
  return buildSupportCarrierResolutionBundle({ supportInput: source, supportFamilies });
}

test('resolves a support member to its typed physical pipe ancestor', () => {
  const source = hierarchy([pipe('/PIPE-100', [support('/PS-900.1')])]);
  const bundle = resolve(source);
  assert.equal(bundle.summary.carrierObjectCount, 1);
  assert.equal(bundle.summary.hierarchyCarrierResolutionCount, 1);
  const row = bundle.resolutions.find((item) => item.supportMemberId === '/PS-900.1');
  assert.equal(row.resolutionStatus, 'RESOLVED_HIERARCHY_CARRIER');
  assert.equal(row.carrierObjectId, '/PIPE-100');
  assert.equal(row.confidence, 'HIGH');
  assert.equal(row.contactEvidenceStatus, 'NOT_PROVEN');
  assert.ok(bundle.supportCarrierEdges.some((edge) => edge.edgeType === 'SUPPORT_MEMBER_TO_CARRIER'));
});

test('explicit carrier reference has precedence over branch inference', () => {
  const source = hierarchy([
    pipe('/PIPE-100'),
    pipe('/PIPE-200'),
    support('/PS-901.1', { CARRIER_REF: '/PIPE-200' }),
  ]);
  const bundle = resolve(source);
  const row = bundle.resolutions.find((item) => item.supportMemberId === '/PS-901.1');
  assert.equal(row.resolutionStatus, 'RESOLVED_EXPLICIT_CARRIER');
  assert.equal(row.carrierObjectId, '/PIPE-200');
  assert.deepEqual(row.relationshipBasis, ['EXPLICIT_CARRIER_REFERENCE']);
});

test('uses a unique physical carrier in the same branch as medium-confidence context', () => {
  const source = hierarchy([pipe('/PIPE-100'), support('/PS-902.1')]);
  const bundle = resolve(source);
  const row = bundle.resolutions.find((item) => item.supportMemberId === '/PS-902.1');
  assert.equal(row.resolutionStatus, 'RESOLVED_UNIQUE_BRANCH_CARRIER');
  assert.equal(row.carrierObjectId, '/PIPE-100');
  assert.equal(row.confidence, 'MEDIUM');
});

test('does not convert a branch context into a physical pipe object', () => {
  const source = hierarchy([support('/PS-903.1')]);
  const bundle = resolve(source);
  const row = bundle.resolutions.find((item) => item.supportMemberId === '/PS-903.1');
  assert.equal(row.resolutionStatus, 'BRANCH_CONTEXT_ONLY');
  assert.equal(row.physicalCarrierObjectAvailable, false);
  assert.equal(row.branchContextId, '/LINE-100/B1');
  assert.equal(bundle.supportCarrierEdges.length, 0);
  assert.equal(bundle.branchContextEdges.length, 1);
  assert.ok(bundle.diagnostics.some((item) => item.code === 'BRANCH_CONTEXT_WITHOUT_PHYSICAL_CARRIER'));
});

test('retains ambiguous carrier candidates when a branch has multiple pipes', () => {
  const source = hierarchy([
    pipe('/PIPE-100'),
    pipe('/PIPE-200'),
    support('/PS-904.1'),
  ]);
  const bundle = resolve(source);
  const row = bundle.resolutions.find((item) => item.supportMemberId === '/PS-904.1');
  assert.equal(row.resolutionStatus, 'AMBIGUOUS_CARRIER_OBJECT');
  assert.deepEqual(row.candidateCarrierObjectIds, ['/PIPE-100', '/PIPE-200']);
  assert.equal(row.relationshipCardinality, 'ONE_TO_MANY_AMBIGUOUS');
});

test('does not silently replace a missing explicit carrier reference', () => {
  const source = hierarchy([
    pipe('/PIPE-100'),
    support('/PS-905.1', { CARRIER_REF: '/PIPE-MISSING' }),
  ]);
  const bundle = resolve(source);
  const row = bundle.resolutions.find((item) => item.supportMemberId === '/PS-905.1');
  assert.equal(row.resolutionStatus, 'UNRESOLVED_CARRIER_REFERENCE');
  assert.equal(row.carrierObjectId, null);
  assert.ok(bundle.diagnostics.some((item) => item.code === 'CARRIER_REFERENCE_NOT_FOUND'));
});

test('resolves projection-bundle support members to declared carriers', () => {
  const source = {
    schema: 'PipeSupportProjectionBundle.v1',
    branchId: '/LINE-200/B2',
    fullLineTag: 'LINE-200',
    lineFamily: 'LINE-200',
    carriers: [{
      carrierId: '/PIPE-PROJECTION-1',
      supportFamilies: [{
        familyId: '/PS-906',
        members: [{ memberId: '/PS-906.1', semanticRole: 'PIPE_SHOE', attributes: {} }],
      }],
    }],
  };
  const bundle = resolve(source);
  const row = bundle.resolutions.find((item) => item.supportMemberId === '/PS-906.1');
  assert.equal(row.resolutionStatus, 'RESOLVED_HIERARCHY_CARRIER');
  assert.equal(row.carrierObjectId, '/PIPE-PROJECTION-1');
  assert.equal(bundle.carrierObjects[0].carrierObjectClass, 'PROJECTION_CARRIER');
});

test('carrier-enriched production bundle remains XML-free and inspectable', () => {
  const source = hierarchy([pipe('/PIPE-100', [support('/PS-907.1')])]);
  const bundle = buildSupportSteelRelationshipBundle({
    supportInput: source,
    steelInput: { objects: [] },
  });
  assert.equal(bundle.schema, 'SupportSteelRelationshipBundle.v1');
  assert.equal(bundle.carrierResolutionSchema, 'SupportCarrierResolution.v1');
  assert.equal(bundle.carrierCatalogSchema, 'SupportCarrierCatalog.v1');
  assert.equal(bundle.supportCarrierResolution.contactEvidenceAvailable, false);
  assert.equal(bundle.summary.carrierObjectCount, 1);
  assert.equal(bundle.summary.resolvedPhysicalCarrierCount, 1);
  assert.equal(bundle.supportFamilies[0].members[0].carrierResolution.carrierObjectId, '/PIPE-100');
  assert.equal(JSON.stringify(bundle).includes('clashXml'), false);
});
