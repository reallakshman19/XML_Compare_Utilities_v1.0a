import assert from 'node:assert/strict';
import test from 'node:test';
import { createPsFamilyAuditFromTextInputs, createPsFamilyInputReadinessFromTextInputs } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-actions.js';
import { createPsFamilyAuditExports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-export.js';
import { PS_FAMILY_CLASH_AUDIT_CONFIG } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { renderPsFamilyReports, renderPsFamilySummary } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-view.js';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-relationship-engine.js';
import { SUPPORT_STEEL_SAMPLE_STEEL, SUPPORT_STEEL_SAMPLE_SUPPORT } from '../tabs/support-steel-relationship-builder/support-steel-relationship-samples.js';

function sourceBundle() {
  return buildSupportSteelRelationshipBundle({
    supportInput: SUPPORT_STEEL_SAMPLE_SUPPORT,
    steelInput: SUPPORT_STEEL_SAMPLE_STEEL,
  });
}

function graphInput(bundle = sourceBundle(), config = {}) {
  return {
    evidenceMode: 'RELATIONSHIP_BUNDLE',
    relationshipBundleText: JSON.stringify(bundle),
    structureXmlText: '',
    supportXmlText: '',
    config: { evidenceMode: 'RELATIONSHIP_BUNDLE', ...config },
  };
}

test('runs PS family audit directly from relationship bundle with no XML inputs', () => {
  const readiness = createPsFamilyInputReadinessFromTextInputs(graphInput());
  assert.equal(readiness.summary.evidenceMode, 'RELATIONSHIP_BUNDLE');
  assert.equal(readiness.summary.xmlClashCount, 0);
  assert.equal(readiness.blocking, false);

  const audit = createPsFamilyAuditFromTextInputs(graphInput());
  assert.equal(audit.schema, 'ps-family-evidence-audit/v1');
  assert.equal(audit.evidenceMode, 'RELATIONSHIP_BUNDLE');
  assert.equal(audit.sourceSchema, 'SupportSteelRelationshipBundle.v1');
  assert.equal(audit.clashRows.length, 0);
  assert.ok(audit.graphEvidenceRows.length > 0);
  assert.equal(audit.summary.clashCount, 0);
  assert.ok(audit.summary.graphEvidenceCount > 0);
  assert.ok(audit.supportSummaryRows.some((row) => row.psRoot === '/PS-14259'));
});

test('derives native support chain and analytical structural terminal rows', () => {
  const audit = createPsFamilyAuditFromTextInputs(graphInput());
  const chain = audit.supportChainRows.find((row) => row.supportA === '/PS-14259.1' || row.supportB === '/PS-14259.1');
  assert.ok(chain);
  assert.match(chain.chainEvidence, /^SSMC:/);
  assert.equal(chain.contactEvidenceStatus, 'ANALYTICAL_CONTACT_CANDIDATE');

  const terminal = audit.structureContactRows.find((row) => row.supportGroup.includes('PS-14259'));
  assert.ok(terminal);
  assert.equal(terminal.structuralGroup, '/SL-4201');
  assert.equal(terminal.structuralMember, '/SL-4201/BEAM-01');
  assert.match(terminal.contactEvidence, /^SSMC-STRUCT:/);
  assert.equal(terminal.contactEvidenceStatus, 'ANALYTICAL_CONTACT_CANDIDATE');
});

test('keeps evidence identifiers native in reports and exports', () => {
  const audit = createPsFamilyAuditFromTextInputs(graphInput());
  const summary = renderPsFamilySummary(audit);
  const evidenceReport = renderPsFamilyReports(audit, 'clashRows', PS_FAMILY_CLASH_AUDIT_CONFIG, '', 'evidenceSummary');
  const exports = createPsFamilyAuditExports(audit);
  assert.match(summary, /RELATIONSHIP_BUNDLE/);
  assert.match(evidenceReport, /Evidence ID/);
  assert.doesNotMatch(evidenceReport, /Against Member/);
  assert.match(exports.inputEvidenceCsv, /EvidenceId,EvidenceClass/);
  assert.match(exports.supportChainCsv, /ChainEvidence/);
  assert.match(exports.structureContactsCsv, /ContactEvidence/);
  assert.doesNotMatch(exports.inputEvidenceCsv, /ClashName/);
  assert.match(exports.auditJson, /ps-family-evidence-audit\/v1/);
});

test('exports support members with the XML CII JSON Trace table contract', () => {
  const audit = createPsFamilyAuditFromTextInputs(graphInput());
  const rows = audit.jsonTraceSupportMemberRows;
  const shoe = rows.find((row) => row['Name of the element'] === '/PS-14259.1');
  assert.ok(rows.length >= 4);
  assert.ok(shoe);
  assert.equal(shoe.PIPE, '/ASIM-1836-6"-P9001001/B1');
  assert.equal(shoe['Support Family'], 'PS-14259');
  assert.equal(shoe['RTEXT of detailing text'], 'PIPE SHOE SH-150');
  assert.equal(shoe.DTXR, 'PIPE SHOE SH-150');
  assert.equal(shoe.DTXR_SOURCE, 'DTXR_POS');
  assert.equal(shoe.Position, 'E=437500 N=-1159000 EL=2181');
  assert.match(shoe['JSON Path'], /^\$/);
  const first = createPsFamilyAuditExports(audit).jsonTraceSupportMembersCsv;
  const second = createPsFamilyAuditExports(audit).jsonTraceSupportMembersCsv;
  assert.match(first, /^Report Row,Support Family Key,Support Family,Name of the element,Reference of the element,TYPE,PIPE,/);
  assert.match(first, /RTEXT of detailing text/);
  assert.match(first, /ISOMETRIC NOTES/);
  assert.match(first, /PIPE SHOE SH-150/);
  assert.equal(first, second);
});

test('invalid or incomplete relationship bundle blocks readiness', () => {
  const invalid = createPsFamilyInputReadinessFromTextInputs({
    evidenceMode: 'RELATIONSHIP_BUNDLE',
    relationshipBundleText: JSON.stringify({ schema: 'WrongSchema', supportFamilies: [], relationships: [] }),
    config: { evidenceMode: 'RELATIONSHIP_BUNDLE' },
  });
  assert.equal(invalid.blocking, true);
  assert.ok(invalid.diagnostics.some((row) => row.code === 'INVALID_RELATIONSHIP_BUNDLE'));
});

test('reports unresolved family and missing structural terminal as graph exceptions', () => {
  const audit = createPsFamilyAuditFromTextInputs(graphInput());
  const unresolved = audit.supportExceptionRows.filter((row) => row.supportGroup.includes('PS-14260'));
  assert.ok(unresolved.some((row) => row.exceptionCode === 'FAMILY_WITHOUT_RESOLVED_STRUCTURE'));
  assert.ok(unresolved.some((row) => row.exceptionCode === 'NO_ANALYTICAL_STRUCTURAL_TERMINAL'));
  const summary = audit.supportSummaryRows.find((row) => row.psRoot === '/PS-14260');
  assert.equal(summary.status, 'ERROR');
});

test('source-family filter limits the graph-native audit without changing source bundle', () => {
  const audit = createPsFamilyAuditFromTextInputs(graphInput(sourceBundle(), { sourceFamily: '/PS-14259' }));
  assert.equal(audit.supportSummaryRows.length, 1);
  assert.equal(audit.supportSummaryRows[0].psRoot, '/PS-14259');
  assert.equal(audit.summary.sourceFamily, '/PS-14259');
  assert.ok(audit.jsonTraceSupportMemberRows.length > 0);
  assert.ok(audit.jsonTraceSupportMemberRows.every((row) => row['Support Family'] === 'PS-14259'));
});
