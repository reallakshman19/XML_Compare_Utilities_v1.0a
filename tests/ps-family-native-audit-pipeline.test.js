import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PS_FAMILY_NATIVE_AUDIT_MODE,
  PS_FAMILY_NATIVE_AUDIT_PIPELINE_SCHEMA,
  buildPsFamilyNativeAuditPipeline,
  createPsFamilyNativePipelineReadiness,
} from '../tabs/ps-family-clash-audit/ps-family-native-audit-pipeline.js';
import {
  SUPPORT_STEEL_SAMPLE_STEEL,
  SUPPORT_STEEL_SAMPLE_SUPPORT,
} from '../tabs/support-steel-relationship-builder/support-steel-relationship-samples.js';

function pipeline(overrides = {}) {
  return buildPsFamilyNativeAuditPipeline({
    supportInput: SUPPORT_STEEL_SAMPLE_SUPPORT,
    steelInput: SUPPORT_STEEL_SAMPLE_STEEL,
    ...overrides,
  });
}

test('builds relationship bundle and graph audit directly from staged JSON', () => {
  const result = pipeline();
  assert.equal(result.schema, PS_FAMILY_NATIVE_AUDIT_PIPELINE_SCHEMA);
  assert.equal(result.productionMode, PS_FAMILY_NATIVE_AUDIT_MODE);
  assert.equal(result.xmlRequired, false);
  assert.equal(result.xmlConsumed, false);
  assert.equal(result.relationshipBundle.schema, 'SupportSteelRelationshipBundle.v1');
  assert.equal(result.relationshipBundle.memberChainEngineSchema, 'SupportMemberChainBundle.v1');
  assert.equal(result.audit.schema, 'ps-family-evidence-audit/v1');
  assert.equal(result.audit.evidenceMode, 'RELATIONSHIP_BUNDLE');
  assert.equal(result.audit.clashRows.length, 0);
  assert.equal(result.outputSchemas.audit, 'ps-family-evidence-audit/v1');
  assert.equal(result.summary.supportFamilyCount, 2);
  assert.equal(result.summary.steelGroupCount, 2);
  assert.equal(result.summary.resolvedFamilyCount, 1);
  assert.equal(result.summary.unresolvedFamilyCount, 1);
});

test('preserves resolved and unresolved family outcomes through the in-memory handoff', () => {
  const result = pipeline();
  const resolved = result.relationshipBundle.relationships.find((row) => row.supportFamilyId === '/PS-14259');
  const unresolved = result.relationshipBundle.relationships.find((row) => row.supportFamilyId === '/PS-14260');
  assert.equal(resolved.relationshipStatus, 'RESOLVED_EXPLICIT');
  assert.equal(resolved.steelGroupId, '/SL-4201');
  assert.equal(unresolved.relationshipStatus, 'UNRESOLVED');
  assert.ok(result.audit.supportSummaryRows.some((row) => row.psRoot === '/PS-14259'));
  assert.ok(result.audit.supportExceptionRows.some((row) => (
    row.supportGroup.includes('PS-14260')
    && row.exceptionCode === 'FAMILY_WITHOUT_RESOLVED_STRUCTURE'
  )));
  assert.equal(result.summary.status, 'READY_WITH_ENGINEERING_EXCEPTIONS');
});

test('propagates relationship and audit configuration independently', () => {
  const result = pipeline({
    relationshipConfig: {
      projectionToleranceMm: 12,
      memberContactToleranceMm: 1.5,
    },
    auditConfig: { sourceFamily: '/PS-14259' },
  });
  assert.equal(result.relationshipBundle.config.projectionToleranceMm, 12);
  assert.equal(result.relationshipBundle.config.memberContactToleranceMm, 1.5);
  assert.equal(result.audit.summary.sourceFamily, '/PS-14259');
  assert.equal(result.audit.supportSummaryRows.length, 1);
  assert.equal(result.audit.supportSummaryRows[0].psRoot, '/PS-14259');
});

test('accepts staged sources as JSON text without an intermediate file export', () => {
  const result = buildPsFamilyNativeAuditPipeline({
    supportInputText: JSON.stringify(SUPPORT_STEEL_SAMPLE_SUPPORT),
    steelInputText: JSON.stringify(SUPPORT_STEEL_SAMPLE_STEEL),
  });
  assert.equal(result.summary.supportFamilyCount, 2);
  assert.equal(result.relationshipBundle.schema, 'SupportSteelRelationshipBundle.v1');
  assert.equal(result.audit.sourceSchema, 'SupportSteelRelationshipBundle.v1');
});

test('readiness blocks invalid or empty staged sources before running the pipeline', () => {
  const invalid = createPsFamilyNativePipelineReadiness({
    supportInputText: '{invalid',
    steelInputText: '',
  });
  assert.equal(invalid.blocking, true);
  assert.equal(invalid.xmlRequired, false);
  assert.ok(invalid.diagnostics.some((row) => row.code === 'INVALID_STAGED_SUPPORT_SOURCE'));
  assert.ok(invalid.diagnostics.some((row) => row.code === 'INVALID_STAGED_STEEL_SOURCE'));

  assert.throws(() => buildPsFamilyNativeAuditPipeline({
    supportInputText: '{invalid',
    steelInputText: JSON.stringify(SUPPORT_STEEL_SAMPLE_STEEL),
  }), /not valid JSON/);
});

test('pipeline source has no dependency on clash XML parsers', async () => {
  const source = await import('node:fs').then(({ readFileSync }) => readFileSync(
    'tabs/ps-family-clash-audit/ps-family-native-audit-pipeline.js',
    'utf8',
  ));
  assert.doesNotMatch(source, /parseSupportChangeXml/);
  assert.doesNotMatch(source, /parsePsFamilyClashXml/);
  assert.doesNotMatch(source, /structureXmlText/);
  assert.doesNotMatch(source, /supportXmlText/);
  assert.match(source, /buildSupportSteelRelationshipBundle/);
  assert.match(source, /buildPsFamilyEvidenceAudit/);
});
