export function renderSupportSteelSummary(bundle) {
  const summary = bundle?.summary || {};
  return [
    summaryCard('Support families', summary.supportFamilyCount ?? 0),
    summaryCard('Carrier objects', summary.carrierObjectCount ?? 0),
    summaryCard('Carrier attachments', summary.carrierAttachmentCandidateCount ?? 0),
    summaryCard('Topology paths', summary.carrierTopologyPathCount ?? 0),
    summaryCard('Complete structure paths', summary.completeCarrierToStructurePathCount ?? 0),
    summaryCard('Complete families', summary.completeCarrierToStructureFamilyCount ?? 0),
    summaryCard('Incomplete families', summary.incompleteCarrierToStructureFamilyCount ?? 0),
    summaryCard('Path exceptions', summary.carrierToStructurePathExceptionCount ?? 0),
  ].join('');
}

export function renderSupportSteelRelationshipTable(bundle, query = '') {
  const needle = String(query || '').trim().toUpperCase();
  const rows = (bundle?.relationships || []).filter((row) => [
    row.supportFamilyId, row.steelGroupId, row.structuralMemberId,
    row.relationshipStatus, row.relationshipCardinality, row.evidenceClass,
    row.geometryMethod, row.geometryQuality, ...(row.relationshipBasis || []),
    ...(row.branchIds || []),
  ].join(' ').toUpperCase().includes(needle));
  if (!rows.length) return emptyState('No relationships match the current filter.');
  return `<div class="ssrb-table-wrap" role="region" tabindex="0" aria-label="Support and steel relationships"><table class="ssrb-table"><thead><tr><th>Support family</th><th>Steel group</th><th>Structural member</th><th>Status</th><th>Cardinality</th><th>Geometry method</th><th>Distance mm</th><th>Basis</th></tr></thead><tbody>${rows.map(relationshipRow).join('')}</tbody></table></div>`;
}

export function renderSupportSteelTree(bundle) {
  const families = bundle?.supportFamilies || [];
  if (!families.length) return emptyState('Build relationships to populate the support-centred hierarchy.');
  const pathRows = new Map((bundle?.supportCarrierToStructurePath?.familyResults || []).map((row) => [row.supportFamilyId, row]));
  return `<div class="ssrb-tree">${families.map((family) => familyTree(family, pathRows.get(family.familyId))).join('')}</div>`;
}

export function renderSupportSteelEvidence(bundle, relationshipId) {
  const relationship = (bundle?.relationships || []).find((row) => row.relationshipId === relationshipId)
    || bundle?.relationships?.[0];
  if (!relationship) return emptyState('Select a relationship after running the builder.');
  const family = bundle.supportFamilies.find((row) => row.familyId === relationship.supportFamilyId);
  const steel = bundle.steelGroups.find((row) => row.steelGroupId === relationship.steelGroupId);
  return `<div class="ssrb-evidence-grid">${evidenceCard('Inferred relationship', relationshipDetails(relationship))}${evidenceCard('Support family and carrier context', supportEvidence(family))}${evidenceCard('Complete carrier-to-structure path', structurePathEvidence(bundle, family))}${evidenceCard('Structural analytical evidence', steelEvidence(steel, relationship))}</div>`;
}

export function renderSupportSteelMemberChain(bundle) {
  const chain = bundle?.supportMemberChain || {};
  const topology = bundle?.supportCarrierTopology || {};
  const paths = bundle?.supportCarrierToStructurePath || {};
  return `<div class="ssrb-chain-grid">${chainSection('Complete carrier-to-structure paths', paths.completePaths || [], completePathTable)}${chainSection('Carrier-to-structure missing-link exceptions', paths.pathExceptions || [], pathExceptionTable)}${chainSection('Physical member contacts', chain.supportChainEdges || [], physicalEdgeTable)}${chainSection('Structural terminals', chain.structuralTerminalEdges || [], terminalEdgeTable)}${chainSection('Accepted carrier topology', topology.connectionEdges || [], topologyEdgeTable)}${chainSection('Carrier topology review exceptions', topology.topologyExceptions || [], topologyExceptionTable)}</div>${chainDiagnostics(chain)}`;
}

export const renderSupportMemberChain = renderSupportSteelMemberChain;

export function renderSupportSteelDiagnostics(bundle) {
  const rows = bundle?.diagnostics || [];
  if (!rows.length) return emptyState('No relationship diagnostics.');
  return `<div class="ssrb-diagnostics">${rows.map((row) => `<article class="ssrb-diagnostic ssrb-${h(row.severity || 'info').toLowerCase()}"><b>${h(row.code)}</b><span>${h(row.supportFamilyId || row.componentId || '')}</span><p>${h(row.message)}</p></article>`).join('')}</div>`;
}

function relationshipRow(row) {
  return `<tr data-ssrb-relationship-row="${h(row.relationshipId)}"><td><button type="button" class="ssrb-link" data-ssrb-select="${h(row.relationshipId)}">${h(row.supportFamilyId)}</button></td><td>${h(row.steelGroupId || row.nearestSteelGroupId || 'UNRESOLVED')}</td><td>${h(row.structuralMemberId || '—')}</td><td>${statusBadge(row.relationshipStatus)}</td><td>${h(row.relationshipCardinality || '—')}</td><td>${h(row.geometryMethod || 'UNAVAILABLE')}</td><td>${row.distanceMm ?? '—'}</td><td>${h((row.relationshipBasis || []).join(' + ') || '—')}</td></tr>`;
}

function familyTree(family, pathResult) {
  const members = (family.members || []).map((member) => {
    const carrier = member.carrierResolution || {};
    return `<li><span class="ssrb-role">${h(member.semanticRole || 'OTHER')}</span><code>${h(member.memberId || '(unresolved)')}</code><small>${h(carrier.resolutionStatus || 'NO_CARRIER_EVIDENCE')} → ${h(carrier.carrierObjectId || carrier.branchContextId || 'UNRESOLVED')}</small></li>`;
  }).join('');
  const relationships = (family.steelRelationships || []).map((row) => `<li><button type="button" data-ssrb-select="${h(row.relationshipId)}">${h(row.steelGroupId || 'UNRESOLVED')}</button>${statusBadge(row.relationshipStatus)}</li>`).join('');
  const pathStatus = pathResult?.pathStatus || 'INCOMPLETE';
  const pathDetails = pathResult?.completePathIds?.length
    ? pathResult.completePathIds.map((id) => `<li><code>${h(id)}</code></li>`).join('')
    : `<li>${h((pathResult?.exceptionCodes || ['NO_PATH_EVIDENCE']).join(', '))}</li>`;
  return `<details class="ssrb-tree-family" open><summary><b>${h(family.familyId)}</b><span>${family.members?.length || 0} members · ${statusBadge(pathStatus)}</span></summary><div class="ssrb-tree-columns"><section><h5>Family members and carrier context</h5><ul>${members || '<li>None</li>'}</ul><h5>Carrier-to-structure path</h5><ul>${pathDetails}</ul></section><section><h5>Inferred steel relationships</h5><ul>${relationships || '<li>None</li>'}</ul></section></div></details>`;
}

function relationshipDetails(row) {
  return `<dl><dt>Evidence ID</dt><dd>${h(row.evidenceId || '')}</dd><dt>Support family</dt><dd>${h(row.supportFamilyId)}</dd><dt>Steel group</dt><dd>${h(row.steelGroupId || row.nearestSteelGroupId || 'UNRESOLVED')}</dd><dt>Structural member</dt><dd>${h(row.structuralMemberId || 'None')}</dd><dt>Status</dt><dd>${statusBadge(row.relationshipStatus)}</dd><dt>Basis</dt><dd>${h((row.relationshipBasis || []).join(', ') || 'None')}</dd><dt>Geometry method</dt><dd>${h(row.geometryMethod || 'UNAVAILABLE')}</dd><dt>Distance</dt><dd>${row.distanceMm ?? '—'} mm</dd><dt>Confidence</dt><dd>${h(row.confidence)}</dd></dl>`;
}

function supportEvidence(family) {
  if (!family) return '<p>No support family evidence available.</p>';
  const context = family.lineContext || {};
  return `<dl><dt>Family</dt><dd>${h(family.familyId)}</dd><dt>Branches</dt><dd>${h((context.branchNodes || family.branchIds || []).join(', ') || 'None')}</dd><dt>Line tags</dt><dd>${h((context.fullLineTags || family.fullLineTags || []).join(', ') || 'None')}</dd><dt>Carrier object IDs</dt><dd>${h((family.carrierObjectIds || []).join(', ') || 'None')}</dd><dt>Resolved carrier members</dt><dd>${family.resolvedPhysicalCarrierCount || 0}</dd><dt>Members</dt><dd>${family.members?.length || 0}</dd></dl>`;
}

function structurePathEvidence(bundle, family) {
  const paths = bundle?.supportCarrierToStructurePath || {};
  const complete = (paths.completePaths || []).filter((row) => row.supportFamilyId === family?.familyId);
  const exceptions = (paths.pathExceptions || []).filter((row) => row.supportFamilyId === family?.familyId);
  return `<dl><dt>Path schema</dt><dd>${h(paths.schema || 'Unavailable')}</dd><dt>Complete paths</dt><dd>${complete.length}</dd><dt>Missing-link exceptions</dt><dd>${exceptions.length}</dd><dt>Evidence classification</dt><dd>ANALYTICAL_PATH_CANDIDATE</dd></dl>${complete.length ? `<ul class="ssrb-evidence-list">${complete.map((row) => `<li><code>${h(row.pathId)}</code><span>${h(row.carrierObjectId)} → ${h(row.structuralMemberId || row.steelGroupId)} · ${h(row.confidence)}</span></li>`).join('')}</ul>` : `<ul class="ssrb-evidence-list">${exceptions.map((row) => `<li><code>${h(row.exceptionCode)}</code><span>${h(row.message)}</span></li>`).join('')}</ul>`}`;
}

function steelEvidence(steel, relationship) {
  if (!steel) return `<p>No resolved steel group. Nearest geometry method: ${h(relationship?.geometryMethod || 'UNAVAILABLE')}.</p>`;
  return `<dl><dt>Steel group</dt><dd>${h(steel.steelGroupId)}</dd><dt>Source records</dt><dd>${steel.records?.length || 0}</dd><dt>Selected structural member</dt><dd>${h(relationship?.structuralMemberId || 'None')}</dd></dl>`;
}

function chainSection(title, rows, renderer) { return `<section class="ssrb-chain-section"><h4>${h(title)} <span>${rows.length}</span></h4>${rows.length ? renderer(rows) : emptyState(`No ${title.toLowerCase()}.`)}</section>`; }
function completePathTable(rows) { return table(['Family', 'Carrier', 'Attachment member', 'Structural terminal', 'Confidence'], rows, (row) => [row.supportFamilyId, row.carrierObjectId, row.attachmentSupportMemberId, row.structuralMemberId || row.steelGroupId, row.confidence]); }
function pathExceptionTable(rows) { return table(['Family', 'Missing link', 'Carrier', 'Message'], rows, (row) => [row.supportFamilyId, row.exceptionCode, row.carrierObjectId || '—', row.message]); }
function physicalEdgeTable(rows) { return table(['Family', 'Member A', 'Member B', 'Status'], rows, (row) => [row.supportFamilyId, row.supportA, row.supportB, row.relationshipStatus]); }
function terminalEdgeTable(rows) { return table(['Family', 'Support member', 'Steel group', 'Status'], rows, (row) => [row.supportFamilyId, row.supportMemberId, row.steelGroupId, row.contactEvidenceStatus || row.relationshipStatus]); }
function topologyEdgeTable(rows) { return table(['From component', 'To component', 'Status', 'Gap mm'], rows, (row) => [row.fromComponentId, row.toComponentId, row.relationshipStatus, row.gapMm ?? '—']); }
function topologyExceptionTable(rows) { return table(['Component', 'Exception', 'Message'], rows, (row) => [row.componentId, row.exceptionCode, row.message]); }
function table(headers, rows, projector) { return `<div class="ssrb-table-wrap"><table class="ssrb-table"><thead><tr>${headers.map((row) => `<th>${h(row)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${projector(row).map((value) => `<td>${h(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function chainDiagnostics(chain) {
  const rows = [...(chain.unresolvedPhysicalMembers || []), ...(chain.diagnostics || [])];
  return rows.length ? `<div class="ssrb-chain-diagnostics"><h4>Member-chain diagnostics</h4>${rows.map((row) => `<p><b>${h(row.code || row.supportFamilyId)}</b> ${h(row.message || row.memberId)}</p>`).join('')}</div>` : '';
}
function evidenceCard(title, body) { return `<section class="ssrb-evidence-card"><h4>${h(title)}</h4>${body}</section>`; }
function summaryCard(label, value) { return `<div class="ssrb-summary-card"><span>${h(label)}</span><strong>${h(value)}</strong></div>`; }
function statusBadge(status) { const key = String(status || 'UNRESOLVED').toLowerCase().replace(/_/g, '-'); return `<span class="ssrb-status ssrb-status-${h(key)}">${h(status || 'UNRESOLVED')}</span>`; }
function emptyState(message) { return `<div class="ssrb-empty">${h(message)}</div>`; }
function h(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
