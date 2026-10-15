import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPsFamilyNativeAuditPipeline } from '../tabs/ps-family-clash-audit/ps-family-native-audit-pipeline.js';
import { collectSupportFamilies } from '../tabs/support-steel-relationship-builder/support-steel-source-reader.js';
import { walkSupportSteelHierarchy } from '../tabs/support-steel-relationship-builder/support-steel-source-utils.js';
import {
  SUPPORT_STEEL_SAMPLE_STEEL,
  SUPPORT_STEEL_SAMPLE_SUPPORT,
} from '../tabs/support-steel-relationship-builder/support-steel-relationship-samples.js';

function supportRecord(name, extra = {}) {
  return {
    type: 'ATTA',
    attributes: {
      NAME: name,
      POS: { x: 0, y: 0, z: 0 },
      ...extra,
    },
  };
}

test('hierarchy walker preserves typed ancestor context', () => {
  const source = [{
    type: 'BRANCH',
    attributes: { NAME: '/LINE-A/B1', LINE_FAMILY: 'LINE-A-FAMILY' },
    children: [supportRecord('/PS-100/DATUM', { OWNER: '/WRONG/B9' })],
  }];
  const row = walkSupportSteelHierarchy(source).find((item) => item.identity === '/PS-100/DATUM');
  assert.ok(row);
  assert.equal(row.ancestors.length, 1);
  assert.equal(row.ancestors[0].type, 'BRANCH');
  assert.equal(row.ancestors[0].identity, '/LINE-A/B1');
  assert.equal(row.ancestors[0].lineFamily, 'LINE-A-FAMILY');
});

test('typed branch ancestor overrides conflicting OWNER text', () => {
  const source = [{
    type: 'BRANCH',
    attributes: { NAME: '/LINE-A/B1' },
    children: [supportRecord('/PS-100/DATUM', { OWNER: '/WRONG/B9' })],
  }];
  const family = collectSupportFamilies(source)[0];
  assert.equal(family.branchId, '/LINE-A/B1');
  assert.deepEqual(family.branchIds, ['/LINE-A/B1']);
  assert.equal(family.fullLineTag, 'LINE-A');
  assert.equal(family.lineFamily, 'LINE-A');
  assert.equal(family.pipeOwner, '/LINE-A/B1');
  assert.equal(family.lineContext.contextQuality, 'MEDIUM');
  assert.equal(family.lineContext.ownerFallbackUsed, false);
  assert.ok(family.lineContext.contextEvidence.includes('TYPED_BRANCH_ANCESTOR'));
  assert.ok(!family.lineContext.contextEvidence.includes('OWNER_FALLBACK'));
});

test('explicit branch and line attributes produce high-quality normalized context', () => {
  const family = collectSupportFamilies([
    supportRecord('/PS-101/DATUM', {
      BRANCH_NODE: '/PLANT/LINE-B/B12',
      FULL_LINE_TAG: '10-IN-LINE-B-001',
      LINE_FAMILY: 'LINE-B',
      PIPE_OWNER: '/PLANT/LINE-B',
      CARRIER_ID: '/PIPE-88',
      OWNER: '/UNRELATED',
    }),
  ])[0];
  assert.equal(family.branchId, '/PLANT/LINE-B/B12');
  assert.equal(family.fullLineTag, '10-IN-LINE-B-001');
  assert.equal(family.lineFamily, 'LINE-B');
  assert.equal(family.pipeOwner, '/PLANT/LINE-B');
  assert.deepEqual(family.carrierIds, ['/PIPE-88']);
  assert.equal(family.lineContext.contextQuality, 'HIGH');
  assert.equal(family.lineContext.ownerFallbackUsed, false);
  assert.ok(family.lineContext.contextEvidence.includes('EXPLICIT_BRANCH_ATTRIBUTE'));
  assert.ok(family.lineContext.contextEvidence.includes('EXPLICIT_FULL_LINE_TAG'));
  assert.ok(family.lineContext.contextEvidence.includes('EXPLICIT_LINE_FAMILY'));
});

test('OWNER remains an explicit low-quality fallback when hierarchy evidence is absent', () => {
  const family = collectSupportFamilies([
    supportRecord('/PS-102/DATUM', { OWNER: '/LINE-C/B3' }),
  ])[0];
  assert.equal(family.branchId, '/LINE-C/B3');
  assert.equal(family.fullLineTag, 'LINE-C');
  assert.equal(family.lineFamily, 'LINE-C');
  assert.equal(family.lineContext.contextQuality, 'LOW');
  assert.equal(family.lineContext.ownerFallbackUsed, true);
  assert.ok(family.lineContext.contextEvidence.includes('OWNER_FALLBACK'));
});

test('multi-line support families preserve all line and branch identities', () => {
  const family = collectSupportFamilies(SUPPORT_STEEL_SAMPLE_SUPPORT)
    .find((row) => row.familyId === '/PS-14259');
  assert.deepEqual(family.branchIds, [
    '/ASIM-1836-4"-P9001002/B3',
    '/ASIM-1836-6"-P9001001/B1',
  ]);
  assert.deepEqual(family.fullLineTags, [
    'ASIM-1836-4"-P9001002',
    'ASIM-1836-6"-P9001001',
  ]);
  assert.deepEqual(family.lineFamilies, family.fullLineTags);
  assert.ok(family.lineContext.contextConflicts.includes('MULTIPLE_FULL_LINE_TAGS'));
  assert.ok(family.lineContext.contextConflicts.includes('MULTIPLE_LINE_FAMILIES'));
  assert.ok(family.lineContext.contextConflicts.includes('MULTIPLE_BRANCH_NODES'));
});

test('graph audit reports owner fallback and multi-line context distinctly', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({
    supportInput: SUPPORT_STEEL_SAMPLE_SUPPORT,
    steelInput: SUPPORT_STEEL_SAMPLE_STEEL,
  });
  const multiLine = pipeline.audit.supportExceptionRows.find((row) => (
    row.supportGroup.includes('PS-14259')
    && row.exceptionCode === 'MULTI_LINE_SUPPORT_FAMILY'
  ));
  assert.ok(multiLine);
  assert.equal(multiLine.severity, 'WARN');
  assert.ok(!pipeline.audit.supportExceptionRows.some((row) => (
    row.supportGroup.includes('PS-14259')
    && row.exceptionCode === 'OWNER_FALLBACK_LINE_CONTEXT'
  )));

  const fallbackPipeline = buildPsFamilyNativeAuditPipeline({
    supportInput: [supportRecord('/PS-103/DATUM', {
      OWNER: '/LINE-D/B1',
      STRUCTURE_REF: '/SL-103',
    })],
    steelInput: [{
      type: 'SCTN',
      attributes: {
        NAME: '/SL-103/BEAM-1',
        DESCRIPTION: 'STRUCTURAL STEEL SECTION',
        BOUNDS: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } },
      },
    }],
  });
  assert.ok(fallbackPipeline.audit.supportExceptionRows.some((row) => (
    row.exceptionCode === 'OWNER_FALLBACK_LINE_CONTEXT'
  )));
});
