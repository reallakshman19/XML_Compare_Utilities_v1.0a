import assert from 'node:assert/strict';
import { PS_FAMILY_EVIDENCE_AUDIT_SCHEMA } from '../tabs/ps-family-clash-audit/ps-family-evidence-graph-audit.js';
import { createPsFamilyAuditExports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-export.js';
import { createZipBlob } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-save.js';

const audit = {
  schema: PS_FAMILY_EVIDENCE_AUDIT_SCHEMA,
  evidenceMode: 'RELATIONSHIP_BUNDLE',
  sourceSchema: 'SupportSteelRelationshipBundle.v1',
  summary: { sourceFamily: '/PS-14396', supportGroupCount: 1 },
  supportSummaryRows: [{
    no: 1,
    line: 'LINE-1',
    branchNode: 'LINE-1/B1',
    lineFamily: 'S8810011',
    psRoot: '/PS-14396',
    supportGroup: 'S8810011_PS-14396',
    structuralGroupCount: 1,
    supportCount: 2,
    supportMembers: ['/PS-14396.1'],
    evidenceIds: ['SSMC:/PS-14396.1::/PS-14396.2'],
    status: 'OK',
    remarks: 'Valid',
  }],
  lineSupportTreeRows: [{
    supportGroup: 'S8810011_PS-14396',
    treeText: 'Line: LINE-1\n└─ SupportGroup: S8810011_PS-14396',
  }],
  supportExceptionRows: [],
  inputEvidenceRows: [{
    sourceInput: 'SupportSteelRelationshipBundle.v1',
    sourceSchema: 'SupportMemberChainBundle.v1',
    evidenceId: 'SSMC:/PS-14396.1::/PS-14396.2',
    evidenceClass: 'ANALYTICAL',
    fromType: 'SUPPORT_MEMBER',
    toType: 'SUPPORT_MEMBER',
    lineFamily: 'S8810011',
    branchNode: 'LINE-1/B1',
    supportGroup: 'S8810011_PS-14396',
    distance: 0,
    parsedEdge: 'SUPPORT_MEMBER_CONTACT',
    contactEvidenceStatus: 'ANALYTICAL_CONTACT_CANDIDATE',
  }],
  graphEvidenceRows: [],
  structureContactRows: [],
  supportChainRows: [],
  supportMemberRows: [],
  connectivityMatrixRows: [],
  coverageRows: [],
  clashRows: [],
  psClashReportRows: [],
  missingRows: [],
  outOfFamilyRows: [],
  duplicateRows: [],
  unexpectedInFamilyRows: [],
  lineFamilyRows: [],
  posFamilyRows: [],
  sourceVsPosFamilyRows: [],
  diagnostics: [],
};

const result = createPsFamilyAuditExports(audit);
assert.ok(result.supportSummaryCsv.startsWith('No,Line,BranchNode'));
assert.ok(result.supportSummaryCsv.includes('S8810011_PS-14396'));
assert.ok(result.supportSummaryCsv.includes('SSMC:/PS-14396.1::/PS-14396.2'));
assert.ok(result.lineSupportTreeText.includes('SupportGroup: S8810011_PS-14396'));
assert.ok(result.supportExceptionsCsv.startsWith('ExceptionCode,Severity,SupportGroup'));
assert.ok(result.inputEvidenceCsv.startsWith('SourceInput,SourceSchema,EvidenceId,EvidenceClass'));
assert.ok(result.clashRowsCsv.startsWith('SourceInput,SourceSchema,EvidenceId,EvidenceClass'));
assert.ok(!result.inputEvidenceCsv.includes('ClashName'));
assert.ok(result.auditJson.includes('ps-family-evidence-audit/v1'));
assert.ok(result.auditJson.includes('/PS-14396'));

const zip = createZipBlob([
  { name: 'support-summary.csv', text: result.supportSummaryCsv },
  { name: 'audit.json', text: result.auditJson },
]);
assert.equal(zip.type, 'application/zip');
const zipBytes = new Uint8Array(await zip.arrayBuffer());
assert.deepEqual(Array.from(zipBytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
const zipText = new TextDecoder().decode(zipBytes);
assert.ok(zipText.includes('support-summary.csv'));
assert.ok(zipText.includes('audit.json'));
assert.ok(zipText.includes('S8810011_PS-14396'));

console.log('ps-family-output-fixtures tests passed');
