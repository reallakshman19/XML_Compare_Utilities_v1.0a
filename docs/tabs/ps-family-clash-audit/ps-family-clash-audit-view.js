function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function list(value) { return Array.isArray(value) ? value.join(', ') : (value ?? ''); }
function point(value) { return value ? `X ${value.x ?? ''} / Y ${value.y ?? ''} / Z ${value.z ?? ''}` : ''; }
function isGraphAudit(audit) { return audit?.evidenceMode === 'RELATIONSHIP_BUNDLE'; }
function evidenceList(row) { return row.evidenceIds || row.evidenceClashes || row.clashNames || []; }
function evidenceValue(row) { return row.evidenceId || row.contactEvidence || row.chainEvidence || row.clashName || row.clash || ''; }
function section(title, body, eyebrow = '') {
  const heading = eyebrow
    ? `<div class="psfa-report-card-title"><span>${h(eyebrow)}</span><b>${h(title)}</b></div>`
    : `<b>${h(title)}</b>`;
  return `<div class="psmap-card"><div class="psmap-card-head">${heading}</div><div class="psmap-card-body">${body}</div></div>`;
}
function readinessStatus(readiness) { if (!readiness) return 'Not checked'; return readiness.blocking ? 'Blocking issues found' : 'Ready with no blocking errors'; }
function visibleCellText(headers, row) { return headers.map((item) => String(item.value(row) ?? '')).join(' ').toLowerCase(); }

export function filterPsFamilyRows(headers, rows, searchText = '') {
  const term = String(searchText || '').trim().toLowerCase();
  if (!term) return rows || [];
  return (rows || []).filter((row) => visibleCellText(headers, row).includes(term));
}

function tableCountText(shownCount, matchedCount, totalCount, hasSearch, limit) {
  if (hasSearch) return `Showing ${shownCount} of ${matchedCount} matched rows from ${totalCount} total rows.`;
  if (totalCount > limit) return `Showing ${shownCount} of ${totalCount} rows.`;
  return `Showing ${shownCount} of ${totalCount} rows.`;
}

export function renderPsFamilyTable(headers, rows, limit = 80, searchText = '') {
  const totalRows = rows || [];
  const matched = filterPsFamilyRows(headers, totalRows, searchText);
  const shown = matched.slice(0, limit);
  const hasSearch = Boolean(String(searchText || '').trim());
  const count = tableCountText(shown.length, matched.length, totalRows.length, hasSearch, limit);
  const head = headers.map((item) => `<th>${h(item.label)}</th>`).join('');
  const body = shown.map((row) => `<tr>${headers.map((item) => `<td>${h(item.value(row))}</td>`).join('')}</tr>`).join('');
  return `<div class="psmap-help-text" data-psfa-filter-count="1">${h(count)}</div><div class="psmap-table-wrap" role="region" tabindex="0" aria-label="Scrollable report table"><table class="psmap-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function renderPsFamilyReadiness(readiness) {
  if (!readiness) return section('Input Readiness', '<div class="psmap-help-text">Click Check Readiness before running the audit.</div>');
  const s = readiness.summary;
  const diagnostics = (readiness.diagnostics || []).slice(0, 8);
  const counts = `<div class="psmap-grid-2"><div><b>Status</b><br>${h(readinessStatus(readiness))}</div><div><b>Evidence mode</b><br>${h(s.evidenceMode || 'XML')}</div><div><b>Detected family</b><br>${h(s.sourceFamily || 'Unknown')}</div><div><b>Structure terminals / Support chain</b><br>${s.structureContactCount || 0} / ${s.supportChainCount || 0}</div><div><b>Relationships / Expected / Detail</b><br>${s.relationshipCount || 0} / ${s.expectedCount || 0} / ${s.detailCount || 0}</div><div><b>Errors / Warnings / Info</b><br>${s.errorCount} / ${s.warnCount} / ${s.infoCount}</div></div>`;
  const diag = renderPsFamilyTable([{ label: 'Level', value: (row) => row.level }, { label: 'Code', value: (row) => row.code }, { label: 'Message', value: (row) => row.message }], diagnostics, 8);
  return section('Input Readiness', `${counts}${diagnostics.length ? diag : '<div class="psmap-help-text">No readiness diagnostics.</div>'}`);
}

export function renderPsFamilySummary(audit) {
  if (!audit) return '<div class="psmap-help-text">Load inputs and run audit.</div>';
  const s = audit.summary;
  return `<div class="psmap-grid-2 psfa-report-summary"><div><b>Evidence mode</b><br>${h(s.evidenceMode || 'XML')}</div><div><b>Source family</b><br>${h(s.sourceFamily || 'Support evidence')}</div><div><b>Support groups</b><br>${s.supportGroupCount || 0}</div><div><b>Structure basis rows</b><br>${s.structureLineProximityCount || 0}</div><div><b>Audit exceptions</b><br>${s.supportExceptionCount || 0}</div><div><b>Evidence rows</b><br>${s.graphEvidenceCount ?? s.clashCount ?? 0}</div></div>`;
}

function renderSupportSummary(audit, searchText) {
  return renderPsFamilyTable([
    { label: 'Line', value: (row) => row.line }, { label: 'Branch Node', value: (row) => row.branchNode },
    { label: 'Line Family', value: (row) => row.lineFamily }, { label: 'PS Root', value: (row) => row.psRoot },
    { label: 'Support Group', value: (row) => row.supportGroup }, { label: 'Support Members', value: (row) => list(row.supportMembers) },
    { label: 'Evidence IDs', value: (row) => list(evidenceList(row)) }, { label: 'Outcome', value: (row) => row.status },
  ], audit.supportSummaryRows || [], 80, searchText);
}

function renderLineSupportTree(audit, searchText) {
  const rows = (audit.lineSupportTreeRows || []).map((row) => ({ supportGroup: row.supportGroup, tree: row.treeText }));
  return renderPsFamilyTable([{ label: 'Support Group', value: (row) => row.supportGroup }, { label: 'Line Tree', value: (row) => row.tree }], rows, 80, searchText);
}

function structurePath(row) { return [row.structuralGroupRoot, row.lineNo || row.lineFamily, row.branchNode, row.supportGroup, row.representativeSupport].filter(Boolean).join(' → '); }
function renderStructureTree(audit, searchText) {
  const rows = (audit.structureLineProximityRows || []).map((row) => ({
    structureGroup: row.structuralGroupRoot, structureNames: row.structuralGroupNames,
    line: row.lineNo || row.lineFamily, branchNode: row.branchNode, supportGroup: row.supportGroup,
    representativeSupport: row.representativeSupport, nearbySupports: row.supportsWithin250mm, path: structurePath(row),
  }));
  return renderPsFamilyTable([
    { label: 'Structure Group', value: (row) => row.structureGroup }, { label: 'Structure Members', value: (row) => row.structureNames },
    { label: 'Line', value: (row) => row.line }, { label: 'Branch Node', value: (row) => row.branchNode },
    { label: 'Support Group', value: (row) => row.supportGroup }, { label: 'Representative Support', value: (row) => row.representativeSupport },
    { label: 'Nearby Supports', value: (row) => row.nearbySupports }, { label: 'Structure Path', value: (row) => row.path },
  ], rows, 80, searchText);
}

function renderStructureLineProximity(audit, searchText) {
  return renderPsFamilyTable([
    { label: 'Structure Group Root', value: (row) => row.structuralGroupRoot }, { label: 'Structure Group Names', value: (row) => row.structuralGroupNames },
    { label: 'Line Number', value: (row) => row.lineNo }, { label: 'Line Family', value: (row) => row.lineFamily },
    { label: 'Branch Node', value: (row) => row.branchNode }, { label: 'Analytical terminal supports', value: (row) => row.supportsWithin250mm },
    { label: 'Support Count', value: (row) => row.supportCount }, { label: 'Total Support Count', value: (row) => row.totalSupportCount },
    { label: 'Representative Support', value: (row) => row.representativeSupport }, { label: 'Representative Coordinate', value: (row) => row.representativeCoordinate },
    { label: 'Evidence IDs', value: (row) => row.evidenceIds || row.evidenceClashes }, { label: 'Basis / Remarks', value: (row) => row.remarks },
  ], audit.structureLineProximityRows || [], 80, searchText);
}

function renderStructureContacts(audit, searchText) {
  return renderPsFamilyTable([
    { label: 'Support Group', value: (row) => row.supportGroup }, { label: 'Structure Group', value: (row) => row.structuralGroup },
    { label: 'Structural Member', value: (row) => row.structuralMember }, { label: 'Support', value: (row) => row.support },
    { label: 'Line Family', value: (row) => row.lineFamily }, { label: 'Branch Node', value: (row) => row.branchNode },
    { label: 'Contact Evidence', value: (row) => row.contactEvidence || row.contactClash }, { label: 'Evidence Status', value: (row) => row.contactEvidenceStatus },
    { label: 'Distance', value: (row) => row.distance }, { label: 'Contact Point', value: (row) => point(row.point) },
  ], audit.structureContactRows || [], 80, searchText);
}

function renderSupportChain(audit, searchText) {
  return renderPsFamilyTable([
    { label: 'Support Group', value: (row) => row.supportGroup }, { label: 'Support A', value: (row) => row.supportA },
    { label: 'Support B', value: (row) => row.supportB }, { label: 'Line Family', value: (row) => row.lineFamily },
    { label: 'Branch Node', value: (row) => row.branchNode }, { label: 'Chain Evidence', value: (row) => row.chainEvidence || row.supportClash },
    { label: 'Evidence Status', value: (row) => row.contactEvidenceStatus }, { label: 'Distance', value: (row) => row.distance },
  ], audit.supportChainRows || [], 80, searchText);
}

function renderSupportMembers(audit, searchText) {
  return renderPsFamilyTable([
    { label: 'Support Group', value: (row) => row.supportGroup }, { label: 'Representative Support', value: (row) => row.representativeSupport },
    { label: 'Member Type', value: (row) => row.memberType }, { label: 'Support', value: (row) => row.support },
    { label: 'Connected To', value: (row) => list(row.connectedTo) }, { label: 'Evidence IDs', value: (row) => list(evidenceList(row)) },
    { label: 'Coverage Role', value: (row) => row.coverageRole }, { label: 'Remarks', value: (row) => row.remarks },
  ], audit.supportMemberRows || [], 80, searchText);
}

function renderExceptions(audit, searchText) {
  return renderPsFamilyTable([
    { label: 'Exception Code', value: (row) => row.exceptionCode }, { label: 'Severity', value: (row) => row.severity },
    { label: 'Support Group', value: (row) => row.supportGroup }, { label: 'Structure Group', value: (row) => row.structuralGroup },
    { label: 'Support', value: (row) => row.support }, { label: 'Support A', value: (row) => row.supportA },
    { label: 'Support B', value: (row) => row.supportB }, { label: 'Evidence ID', value: (row) => row.evidenceId || row.evidenceClash },
    { label: 'Outcome / Reason', value: (row) => row.reason },
  ], audit.supportExceptionRows || [], 80, searchText);
}

function renderEvidence(audit, searchText) {
  return renderPsFamilyTable([
    { label: 'Source Input', value: (row) => row.sourceInput }, { label: 'Source Schema', value: (row) => row.sourceSchema },
    { label: 'Evidence ID', value: evidenceValue }, { label: 'Evidence Class', value: (row) => row.evidenceClass },
    { label: 'From Type', value: (row) => row.fromType || row.objectAType }, { label: 'To Type', value: (row) => row.toType || row.objectBType },
    { label: 'Support Group', value: (row) => row.supportGroup }, { label: 'Parsed Edge', value: (row) => row.parsedEdge },
    { label: 'Evidence Status', value: (row) => row.contactEvidenceStatus },
  ], audit.inputEvidenceRows || audit.graphEvidenceRows || [], 80, searchText);
}

function renderMatrix(audit, searchText) {
  return renderPsFamilyTable([
    { label: 'Support Group', value: (row) => row.supportGroup }, { label: 'From', value: (row) => row.from },
    { label: 'To', value: (row) => row.to }, { label: 'Edge Type', value: (row) => row.edgeType },
    { label: 'Evidence ID', value: evidenceValue }, { label: 'Outcome', value: (row) => row.status },
  ], audit.connectivityMatrixRows || [], 80, searchText);
}

function renderLegacyClashRows(audit, searchText) {
  return renderPsFamilyTable([
    { label: 'Clash', value: (row) => row.clashName }, { label: 'Source Family', value: (row) => row.source?.familyRoot },
    { label: 'Source Object', value: (row) => row.source?.objectName }, { label: 'Against Member', value: (row) => row.against?.memberName },
    { label: 'Family Outcome', value: (row) => row.familyStatus }, { label: 'Line Family', value: (row) => row.against?.pipe?.lineFamily },
    { label: 'Branch Node', value: (row) => row.against?.pipe?.fullBranchNode },
  ], audit.clashRows || [], 80, searchText);
}
function renderEvidenceDetailRows(audit, searchText) { return isGraphAudit(audit) ? renderEvidence(audit, searchText) : renderLegacyClashRows(audit, searchText); }
function renderCoverage(audit, searchText) { return renderPsFamilyTable([{ label: 'Expected Member', value: (row) => row.expectedMember }, { label: 'Outcome', value: (row) => row.status }, { label: 'Evidence IDs', value: (row) => list(evidenceList(row)) }], audit.coverageRows || [], 80, searchText); }
function renderDiagnostics(audit, searchText) { return renderPsFamilyTable([{ label: 'Level', value: (row) => row.level }, { label: 'Code', value: (row) => row.code }, { label: 'Message', value: (row) => row.message }], audit.diagnostics || [], 80, searchText); }

export const PS_FAMILY_REPORT_RENDERERS = Object.freeze({
  supportSummary: renderSupportSummary,
  supportChain: renderSupportChain,
  supportMembers: renderSupportMembers,
  structureLineProximity: renderStructureLineProximity,
  structureContacts: renderStructureContacts,
  lineSupportTree: renderLineSupportTree,
  structureTree: renderStructureTree,
  inputEvidence: renderEvidence,
  connectivityMatrix: renderMatrix,
  clashRows: renderEvidenceDetailRows,
  supportExceptions: renderExceptions,
  diagnostics: renderDiagnostics,
  coverage: renderCoverage,
  psClashReport: renderSupportMembers,
  hierarchy: renderEvidence,
  missing: renderCoverage,
  outOfFamily: renderLegacyClashRows,
  duplicates: renderCoverage,
  lineFamilies: renderCoverage,
  posFamilies: renderCoverage,
  sourceVsPosFamily: renderCoverage,
});

function renderSimpleReport(audit, key, searchText) { return PS_FAMILY_REPORT_RENDERERS[key] ? PS_FAMILY_REPORT_RENDERERS[key](audit, searchText) : renderSupportSummary(audit, searchText); }
function activeReportGroup(config, activeGroupKey, activeTab) { const groups = config.reportGroups || []; return groups.find((item) => item.key === activeGroupKey) || groups.find((item) => item.reportKeys?.includes(activeTab)) || groups[0] || null; }
export function renderPsFamilyReports(audit, activeTab, config, searchText = '', activeGroupKey = '') {
  if (!audit) return '';
  const tab = config.reportTabs.find((item) => item.key === activeTab) || config.reportTabs[0];
  const group = activeReportGroup(config, activeGroupKey, tab.key);
  const context = group ? `<div class="psfa-report-context"><b>${h(group.label)}</b><span>${h(group.description)}</span></div>` : '';
  return section(tab.label, `${context}${renderSimpleReport(audit, tab.key, searchText)}`, group?.label || 'Report');
}
