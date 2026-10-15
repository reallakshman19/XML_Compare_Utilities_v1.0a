import { PS_FAMILY_JSON_TRACE_HEADERS } from './ps-family-json-trace-export.js';

function csvEscape(value) {
  if (Array.isArray(value)) return csvEscape(value.join('; '));
  if (value && typeof value === 'object') return csvEscape(JSON.stringify(value));
  const text = value == null ? '' : String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(headers, rows) {
  const lines = [headers.join(',')];
  rows.forEach((row) => { lines.push(headers.map((header) => csvEscape(row[header])).join(',')); });
  return `${lines.join('\n')}\n`;
}

function evidenceList(row) { return row.evidenceIds || row.evidenceClashes || row.clashNames || []; }
function evidenceId(row) { return row.evidenceId || row.contactEvidence || row.chainEvidence || row.clashName || row.clash || ''; }

export function exportPsFamilyCoverageCsv(audit) {
  const headers = ['SourceFamily', 'ExpectedMember', 'Status', 'EvidenceCount', 'EvidenceIds', 'POSFamilyId', 'p1bore', 'Pipe', 'LineFamily', 'SupportText', 'SupportGap', 'Reference', 'PositionE', 'PositionS', 'PositionU', 'AgainstMembers', 'LineFamilies', 'FullLineTags', 'BranchNodes', 'SourceObjects', 'Remarks'];
  return rowsToCsv(headers, (audit.coverageRows || []).map((row) => ({ SourceFamily: row.sourceFamily, ExpectedMember: row.expectedMember, Status: row.status, EvidenceCount: row.evidenceCount ?? row.clashCount, EvidenceIds: evidenceList(row), POSFamilyId: row.posFamilyId, p1bore: row.p1bore, Pipe: row.pipe, LineFamily: row.lineFamily || row.lineFamilies, SupportText: row.supportText, SupportGap: row.supportGap, Reference: row.reference, PositionE: row.position?.e, PositionS: row.position?.s, PositionU: row.position?.u, AgainstMembers: row.againstMembers, LineFamilies: row.lineFamilies, FullLineTags: row.fullLineTags, BranchNodes: row.branchNodes, SourceObjects: row.sourceObjects, Remarks: row.remarks })));
}

export function exportPsFamilyClashRowsCsv(audit) {
  if (audit?.evidenceMode === 'RELATIONSHIP_BUNDLE') return exportInputEvidenceCsv(audit);
  const headers = ['ClashName', 'Source', 'SourceObject', 'AgainstMember', 'FamilyStatus', 'POSFamilyId', 'p1bore', 'Pipe', 'LineFamily', 'FullLineTag', 'BranchNode', 'SupportText', 'SupportGap', 'Reference', 'PositionE', 'PositionS', 'PositionU', 'Distance', 'PointX', 'PointY', 'PointZ', 'SourcePath', 'AgainstPath'];
  return rowsToCsv(headers, (audit.clashRows || []).map((row) => ({ ClashName: row.clashName, Source: row.source?.familyRoot, SourceObject: row.source?.objectName, AgainstMember: row.against?.memberName, FamilyStatus: row.familyStatus, POSFamilyId: row.elementDetail?.posFamilyId, p1bore: row.elementDetail?.p1bore, Pipe: row.elementDetail?.pipe || row.against?.pipe?.fullLineTag, LineFamily: row.elementDetail?.lineFamily || row.against?.pipe?.lineFamily, FullLineTag: row.against?.pipe?.fullLineTag, BranchNode: row.against?.pipe?.fullBranchNode, SupportText: row.elementDetail?.supportText, SupportGap: row.elementDetail?.supportGap, Reference: row.elementDetail?.reference, PositionE: row.elementDetail?.position?.e, PositionS: row.elementDetail?.position?.s, PositionU: row.elementDetail?.position?.u, Distance: row.distance, PointX: row.point?.x, PointY: row.point?.y, PointZ: row.point?.z, SourcePath: row.source?.path, AgainstPath: row.against?.path })));
}

export function exportSupportSummaryCsv(audit) {
  const headers = ['No', 'Line', 'BranchNode', 'LineFamily', 'PSRoot', 'SupportGroup', 'StructuralGroupCount', 'SupportCount', 'SupportMembers', 'EvidenceIds', 'Status', 'Remarks', 'FullLineTags', 'BranchNodes', 'LineFamilies', 'LineMembershipCount', 'LineMembershipIds'];
  return rowsToCsv(headers, (audit.supportSummaryRows || []).map((row) => ({ No: row.no, Line: row.line, BranchNode: row.branchNode, LineFamily: row.lineFamily, PSRoot: row.psRoot, SupportGroup: row.supportGroup, StructuralGroupCount: row.structuralGroupCount, SupportCount: row.supportCount, SupportMembers: row.supportMembers, EvidenceIds: evidenceList(row), Status: row.status, Remarks: row.remarks, FullLineTags: row.fullLineTags, BranchNodes: row.branchNodes, LineFamilies: row.lineFamilies, LineMembershipCount: row.lineMembershipCount, LineMembershipIds: row.lineMembershipIds })));
}

export function exportLineMembershipsCsv(audit) {
  const headers = ['MembershipId', 'SupportFamilyId', 'SupportGroup', 'LineFamily', 'FullLineTag', 'BranchNode', 'IsPrimary', 'MemberCount', 'MemberIds', 'CarrierCount', 'CarrierIds', 'ContextQuality', 'OwnerFallbackUsed', 'ContextEvidence'];
  return rowsToCsv(headers, (audit.lineMembershipRows || []).map((row) => ({ MembershipId: row.membershipId, SupportFamilyId: row.supportFamilyId, SupportGroup: row.supportGroup, LineFamily: row.lineFamily, FullLineTag: row.fullLineTag, BranchNode: row.branchNode, IsPrimary: row.isPrimary, MemberCount: row.memberCount, MemberIds: row.memberIds, CarrierCount: row.carrierCount, CarrierIds: row.carrierIds, ContextQuality: row.contextQuality, OwnerFallbackUsed: row.ownerFallbackUsed, ContextEvidence: row.contextEvidence })));
}

export function exportLineSupportTreeText(audit) { return `${(audit.lineSupportTreeRows || []).map((row) => row.treeText).join('\n\n')}\n`; }
export function exportLineSupportTreeCsv(audit) {
  const headers = ['SupportGroup', 'LineTree', 'LineMembershipId', 'LineFamily', 'FullLineTag', 'BranchNode'];
  return rowsToCsv(headers, (audit.lineSupportTreeRows || []).map((row) => ({ SupportGroup: row.supportGroup, LineTree: row.treeText, LineMembershipId: row.membershipId, LineFamily: row.lineFamily, FullLineTag: row.fullLineTag, BranchNode: row.branchNode })));
}

export function exportStructureTreeText(audit) {
  const rows = (audit.structureLineProximityRows || []).map((row) => [
    `StructureGroup: ${row.structuralGroupRoot || ''}`,
    `StructureNames: ${row.structuralGroupNames || ''}`,
    `Line: ${row.lineNo || row.lineFamily || ''}`,
    `BranchNode: ${row.branchNode || ''}`,
    `LineMembership: ${row.lineMembershipId || ''}`,
    `SupportGroup: ${row.supportGroup || ''}`,
    `RepresentativeSupport: ${row.representativeSupport || ''}`,
    `AnalyticalTerminalSupports: ${row.supportsWithin250mm || ''}`,
    `EvidenceIds: ${row.evidenceIds || row.evidenceClashes || ''}`,
  ].join('\n'));
  return `${rows.join('\n\n')}\n`;
}

export function exportStructureTreeCsv(audit) {
  const headers = ['StructureGroup', 'StructureMembers', 'Line', 'BranchNode', 'SupportGroup', 'LineMembershipId', 'RepresentativeSupport', 'AnalyticalTerminalSupports', 'EvidenceIds', 'StructurePath'];
  return rowsToCsv(headers, (audit.structureLineProximityRows || []).map((row) => {
    const line = row.lineNo || row.lineFamily || '';
    const path = [row.structuralGroupRoot, line, row.branchNode, row.lineMembershipId, row.supportGroup, row.representativeSupport].filter(Boolean).join(' → ');
    return { StructureGroup: row.structuralGroupRoot, StructureMembers: row.structuralGroupNames, Line: line, BranchNode: row.branchNode, SupportGroup: row.supportGroup, LineMembershipId: row.lineMembershipId, RepresentativeSupport: row.representativeSupport, AnalyticalTerminalSupports: row.supportsWithin250mm, EvidenceIds: row.evidenceIds || row.evidenceClashes, StructurePath: path };
  }));
}

export function exportStructureLineProximityCsv(audit) {
  const headers = ['StructuralGroupRoot', 'StructuralGroupNames', 'LineNo', 'LineFamily', 'BranchNode', 'LineMembershipId', 'SupportGroup', 'AnalyticalTerminalSupports', 'SupportCount', 'TotalSupportCount', 'RepresentativeSupport', 'RepresentativeCoordinate', 'EvidenceIds', 'Remarks'];
  return rowsToCsv(headers, (audit.structureLineProximityRows || []).map((row) => ({ StructuralGroupRoot: row.structuralGroupRoot, StructuralGroupNames: row.structuralGroupNames, LineNo: row.lineNo, LineFamily: row.lineFamily, BranchNode: row.branchNode, LineMembershipId: row.lineMembershipId, SupportGroup: row.supportGroup, AnalyticalTerminalSupports: row.supportsWithin250mm, SupportCount: row.supportCount, TotalSupportCount: row.totalSupportCount, RepresentativeSupport: row.representativeSupport, RepresentativeCoordinate: row.representativeCoordinate, EvidenceIds: row.evidenceIds || row.evidenceClashes, Remarks: row.remarks })));
}

export function exportStructureContactsCsv(audit) {
  const headers = ['SupportGroup', 'LineMembershipId', 'StructuralGroup', 'StructuralMember', 'Support', 'Line', 'LineFamily', 'BranchNode', 'CarrierIds', 'ContactEvidence', 'EvidenceClass', 'ContactEvidenceStatus', 'Distance', 'Point', 'Remarks'];
  return rowsToCsv(headers, (audit.structureContactRows || []).map((row) => ({ SupportGroup: row.supportGroup, LineMembershipId: row.lineMembershipId, StructuralGroup: row.structuralGroup, StructuralMember: row.structuralMember, Support: row.support, Line: row.line, LineFamily: row.lineFamily, BranchNode: row.branchNode, CarrierIds: row.carrierIds, ContactEvidence: row.contactEvidence || row.contactClash, EvidenceClass: row.evidenceClass, ContactEvidenceStatus: row.contactEvidenceStatus, Distance: row.distance, Point: row.point, Remarks: row.remarks })));
}

export function exportSupportChainCsv(audit) {
  const headers = ['SupportGroup', 'SupportA', 'SupportB', 'Line', 'LineFamily', 'BranchNode', 'LineMembershipId', 'LineMembershipIds', 'CrossLine', 'FromMembershipId', 'ToMembershipId', 'FromLineFamily', 'ToLineFamily', 'ChainEvidence', 'EvidenceClass', 'ContactEvidenceStatus', 'Distance', 'Point', 'Remarks'];
  return rowsToCsv(headers, (audit.supportChainRows || []).map((row) => ({ SupportGroup: row.supportGroup, SupportA: row.supportA, SupportB: row.supportB, Line: row.line, LineFamily: row.lineFamily, BranchNode: row.branchNode, LineMembershipId: row.lineMembershipId, LineMembershipIds: row.lineMembershipIds, CrossLine: row.crossLine, FromMembershipId: row.fromMembershipId, ToMembershipId: row.toMembershipId, FromLineFamily: row.fromLineFamily, ToLineFamily: row.toLineFamily, ChainEvidence: row.chainEvidence || row.supportClash, EvidenceClass: row.evidenceClass, ContactEvidenceStatus: row.contactEvidenceStatus, Distance: row.distance, Point: row.point, Remarks: row.remarks })));
}

export function exportSupportMembersCsv(audit) {
  const headers = ['SupportGroup', 'LineMembershipId', 'LineFamily', 'FullLineTag', 'BranchNode', 'CarrierIds', 'RepresentativeSupport', 'Support', 'MemberType', 'ConnectedTo', 'EvidenceIds', 'CoverageRole', 'Remarks'];
  return rowsToCsv(headers, (audit.supportMemberRows || []).map((row) => ({ SupportGroup: row.supportGroup, LineMembershipId: row.lineMembershipId, LineFamily: row.lineFamily, FullLineTag: row.fullLineTag, BranchNode: row.branchNode, CarrierIds: row.carrierIds, RepresentativeSupport: row.representativeSupport, Support: row.support, MemberType: row.memberType, ConnectedTo: row.connectedTo, EvidenceIds: evidenceList(row), CoverageRole: row.coverageRole, Remarks: row.remarks })));
}

export function exportPsFamilyJsonTraceCsv(audit) {
  return rowsToCsv(PS_FAMILY_JSON_TRACE_HEADERS, audit.jsonTraceSupportMemberRows || []);
}

export function exportSupportExceptionsCsv(audit) {
  const headers = ['ExceptionCode', 'Severity', 'SupportGroup', 'LineFamily', 'FullLineTag', 'BranchNode', 'StructuralGroup', 'Support', 'SupportA', 'SupportB', 'SourceInput', 'EvidenceId', 'Reason'];
  return rowsToCsv(headers, (audit.supportExceptionRows || []).map((row) => ({ ExceptionCode: row.exceptionCode, Severity: row.severity, SupportGroup: row.supportGroup, LineFamily: row.lineFamily, FullLineTag: row.fullLineTag, BranchNode: row.branchNode, StructuralGroup: row.structuralGroup, Support: row.support, SupportA: row.supportA, SupportB: row.supportB, SourceInput: row.sourceInput, EvidenceId: row.evidenceId || row.evidenceClash, Reason: row.reason })));
}

export function exportInputEvidenceCsv(audit) {
  const headers = ['SourceInput', 'SourceSchema', 'EvidenceId', 'EvidenceClass', 'FromType', 'ToType', 'LineFamily', 'FullLineTag', 'BranchNode', 'LineMembershipId', 'LineMembershipIds', 'CrossLine', 'FromLineFamily', 'ToLineFamily', 'SupportGroup', 'Distance', 'ParsedEdge', 'ContactEvidenceStatus'];
  return rowsToCsv(headers, (audit.inputEvidenceRows || audit.graphEvidenceRows || []).map((row) => ({ SourceInput: row.sourceInput, SourceSchema: row.sourceSchema, EvidenceId: evidenceId(row), EvidenceClass: row.evidenceClass, FromType: row.fromType || row.objectAType, ToType: row.toType || row.objectBType, LineFamily: row.lineFamily, FullLineTag: row.fullLineTag, BranchNode: row.branchNode, LineMembershipId: row.lineMembershipId, LineMembershipIds: row.lineMembershipIds, CrossLine: row.crossLine, FromLineFamily: row.fromLineFamily, ToLineFamily: row.toLineFamily, SupportGroup: row.supportGroup, Distance: row.distance, ParsedEdge: row.parsedEdge, ContactEvidenceStatus: row.contactEvidenceStatus })));
}

export function exportConnectivityMatrixCsv(audit) {
  const headers = ['SupportGroup', 'From', 'To', 'EdgeType', 'EvidenceId', 'SourceInput', 'Status'];
  return rowsToCsv(headers, (audit.connectivityMatrixRows || []).map((row) => ({ SupportGroup: row.supportGroup, From: row.from, To: row.to, EdgeType: row.edgeType, EvidenceId: evidenceId(row), SourceInput: row.sourceInput, Status: row.status })));
}

export function exportPsFamilyMissingCsv(audit) { return rowsToCsv(['SourceFamily', 'ExpectedMember', 'Remarks'], (audit.missingRows || []).map((row) => ({ SourceFamily: row.sourceFamily, ExpectedMember: row.expectedMember, Remarks: row.remarks }))); }
export function exportPsFamilyOutOfFamilyCsv(audit) { return rowsToCsv(['ClashName', 'Source', 'AgainstMember', 'AgainstRoot'], (audit.outOfFamilyRows || []).map((row) => ({ ClashName: row.clashName, Source: row.source?.familyRoot, AgainstMember: row.against?.memberName, AgainstRoot: row.against?.familyRoot }))); }
export function exportPsFamilyDuplicatesCsv(audit) { return rowsToCsv(['Member', 'ExactMemberKey', 'EvidenceCount'], (audit.duplicateRows || []).map((row) => ({ Member: row.member, ExactMemberKey: row.exactMemberKey, EvidenceCount: row.evidenceCount ?? row.clashCount }))); }

export function exportPsFamilyLineFamiliesCsv(audit) {
  const headers = ['LineFamily', 'FullLineTag', 'BranchNode', 'LineMembershipId', 'SupportFamilyId', 'EvidenceCount'];
  return rowsToCsv(headers, (audit.lineFamilyRows || []).map((row) => ({ LineFamily: row.lineFamily, FullLineTag: row.fullLineTag, BranchNode: row.branchNode, LineMembershipId: row.lineMembershipId, SupportFamilyId: row.supportFamilyId, EvidenceCount: row.evidenceCount ?? row.clashCount })));
}

export function exportPsFamilyPosFamiliesCsv(audit) { return rowsToCsv(['POSFamilyId', 'ElementCount'], (audit.posFamilyRows || []).map((row) => ({ POSFamilyId: row.posFamilyId, ElementCount: row.elementCount }))); }
export function exportPsFamilySourceVsPosFamilyCsv(audit) {
  const headers = ['Source', 'POSFamilyCount', 'ElementCount', 'FoundElementCount', 'MissingElementCount', 'EvidenceCount', 'OutOfFamilyCount', 'POSFamilyIds', 'LineFamilies', 'Remarks'];
  return rowsToCsv(headers, (audit.sourceVsPosFamilyRows || []).map((row) => ({ Source: row.source, POSFamilyCount: row.posFamilyCount, ElementCount: row.elementCount, FoundElementCount: row.foundElementCount, MissingElementCount: row.missingElementCount, EvidenceCount: row.evidenceCount ?? row.clashCount, OutOfFamilyCount: row.outOfFamilyCount, POSFamilyIds: row.posFamilyIds, LineFamilies: row.lineFamilies, Remarks: row.remarks })));
}
export function exportPsFamilyDiagnosticsCsv(audit) { return rowsToCsv(['Level', 'Code', 'Message'], (audit.diagnostics || []).map((row) => ({ Level: row.level, Code: row.code, Message: row.message }))); }
export function exportPsFamilyPsClashReportCsv(audit) { return exportSupportMembersCsv(audit); }
export function exportPsFamilyAuditJson(audit) { return `${JSON.stringify(audit, null, 2)}\n`; }

export const PS_FAMILY_ACTIVE_EXPORTS = Object.freeze({
  supportSummary: Object.freeze({ exportKey: 'supportSummaryCsv', suffix: 'supportgroup-summary' }),
  lineMemberships: Object.freeze({ exportKey: 'lineMembershipsCsv', suffix: 'line-memberships' }),
  supportChain: Object.freeze({ exportKey: 'supportChainCsv', suffix: 'support-chain' }),
  supportMembers: Object.freeze({ exportKey: 'supportMembersCsv', suffix: 'support-members' }),
  structureLineProximity: Object.freeze({ exportKey: 'structureLineProximityCsv', suffix: 'structure-line-proximity' }),
  structureContacts: Object.freeze({ exportKey: 'structureContactsCsv', suffix: 'structure-contacts' }),
  lineSupportTree: Object.freeze({ exportKey: 'lineSupportTreeCsv', suffix: 'line-tree' }),
  structureTree: Object.freeze({ exportKey: 'structureTreeCsv', suffix: 'structure-tree' }),
  inputEvidence: Object.freeze({ exportKey: 'inputEvidenceCsv', suffix: 'input-evidence' }),
  connectivityMatrix: Object.freeze({ exportKey: 'connectivityMatrixCsv', suffix: 'connectivity-matrix' }),
  clashRows: Object.freeze({ exportKey: 'clashRowsCsv', suffix: 'evidence-detail-rows' }),
  supportExceptions: Object.freeze({ exportKey: 'supportExceptionsCsv', suffix: 'audit-exceptions' }),
  diagnostics: Object.freeze({ exportKey: 'diagnosticsCsv', suffix: 'diagnostics' }),
});

export function createPsFamilyAuditExports(audit) {
  return {
    supportSummaryCsv: exportSupportSummaryCsv(audit),
    lineMembershipsCsv: exportLineMembershipsCsv(audit),
    supportChainCsv: exportSupportChainCsv(audit),
    supportMembersCsv: exportSupportMembersCsv(audit),
    jsonTraceSupportMembersCsv: exportPsFamilyJsonTraceCsv(audit),
    structureLineProximityCsv: exportStructureLineProximityCsv(audit),
    structureContactsCsv: exportStructureContactsCsv(audit),
    lineSupportTreeText: exportLineSupportTreeText(audit),
    lineSupportTreeCsv: exportLineSupportTreeCsv(audit),
    structureTreeText: exportStructureTreeText(audit),
    structureTreeCsv: exportStructureTreeCsv(audit),
    inputEvidenceCsv: exportInputEvidenceCsv(audit),
    connectivityMatrixCsv: exportConnectivityMatrixCsv(audit),
    coverageCsv: exportPsFamilyCoverageCsv(audit),
    clashRowsCsv: exportPsFamilyClashRowsCsv(audit),
    psClashReportCsv: exportPsFamilyPsClashReportCsv(audit),
    missingCsv: exportPsFamilyMissingCsv(audit),
    outOfFamilyCsv: exportPsFamilyOutOfFamilyCsv(audit),
    duplicatesCsv: exportPsFamilyDuplicatesCsv(audit),
    lineFamiliesCsv: exportPsFamilyLineFamiliesCsv(audit),
    posFamiliesCsv: exportPsFamilyPosFamiliesCsv(audit),
    sourceVsPosFamilyCsv: exportPsFamilySourceVsPosFamilyCsv(audit),
    diagnosticsCsv: exportPsFamilyDiagnosticsCsv(audit),
    supportExceptionsCsv: exportSupportExceptionsCsv(audit),
    auditJson: exportPsFamilyAuditJson(audit),
  };
}

export function createPsFamilyActiveReportExport(audit, activeTab = 'supportSummary') {
  const report = PS_FAMILY_ACTIVE_EXPORTS[activeTab];
  if (!report) return null;
  const exports = createPsFamilyAuditExports(audit);
  return Object.freeze({ activeTab, exportKey: report.exportKey, suffix: report.suffix, mime: 'text/csv', text: exports[report.exportKey] });
}
