/** Pure markup for Topology Parity summary, mismatch list, and evidence. */
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function valueText(value) { if (value === null || value === undefined || value === '') return '—'; return typeof value === 'string' ? value : JSON.stringify(value); }

export function topologyParitySummaryMarkup(state, report, ciiParity = null) {
  const summary = objectRecord(report?.summary), cii = objectRecord(ciiParity), ciiSummary = objectRecord(cii.summary);
  const cards = [
    ['Canonical Nodes', summary.canonicalNodes], ['Canonical Edges', summary.canonicalEdges], ['InputXML Elements', summary.inputXmlElements],
    ['SVG Edges', summary.svgEdges], ['Supports', summary.supports], ['Rigids', summary.rigids], ['Junctions', summary.junctions],
    ['Deferred Records', summary.deferredRecords], ['Mismatch Count', summary.topologyMismatchCount], ['Parity Status', state.status],
    ['CII Elements', ciiSummary.ciiElementCount], ['CII Projection Records', ciiSummary.projectionRecordCount],
    ['CII Identity Mismatches', ciiSummary.ciiIdentityMismatchCount], ['CII Identity Status', cii.status || 'NOT_RUN'],
  ];
  const reasons = asArray(state.reasons).map((row) => `<li>${escapeHtml(row.label)}: expected <code>${escapeHtml(row.expected || '(missing)')}</code>, actual <code>${escapeHtml(row.actual || '(missing)')}</code></li>`).join('');
  return `<div class="ttv-parity-cards">${cards.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? '—')}</strong></article>`).join('')}</div>${reasons ? `<details class="ttv-parity-stale"><summary>Stale evidence</summary><ul>${reasons}</ul></details>` : ''}`;
}

export function topologyParityMismatchTableMarkup(report, selectedId = '') {
  const rows = asArray(report?.mismatches).map(objectRecord);
  if (!rows.length) return '<div class="ttv-parity-pass">No topology mismatches or CII identity mismatches.</div>';
  return `<div class="ttv-parity-table-wrap"><table class="ttv-parity-table"><thead><tr><th>Severity</th><th>Category</th><th>Canonical ID</th><th>InputXML ID</th><th>SVG ID</th><th>CII ID</th><th>Branch</th><th>Source Ref</th><th>Expected</th><th>Actual</th><th>Source Path</th><th>Status</th></tr></thead><tbody>${rows.map((row) => `<tr data-parity-mismatch-id="${escapeHtml(row.id)}" class="${cleanText(row.id) === cleanText(selectedId) ? 'is-selected' : ''}"><td>${escapeHtml(row.severity)}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(valueText(row.canonicalIdentity))}</td><td>${escapeHtml(valueText(row.inputXmlIdentity))}</td><td>${escapeHtml(valueText(row.svgIdentity))}</td><td>${escapeHtml(valueText(row.ciiIdentity))}</td><td>${escapeHtml(asArray(row.branchIds).join(', '))}</td><td>${escapeHtml(row.sourceRef || '—')}</td><td><code>${escapeHtml(valueText(row.expected))}</code></td><td><code>${escapeHtml(valueText(row.actual))}</code></td><td>${escapeHtml(asArray(row.sourcePaths).join(', '))}</td><td>${escapeHtml(row.status || 'OPEN')}</td></tr>`).join('')}</tbody></table></div>`;
}

function linkedRows(selection, artifacts) {
  if (!selection) return [];
  const object = objectRecord(selection.object);
  const scene = objectRecord(artifacts.scene), parsed = objectRecord(artifacts.parsed), ledger = objectRecord(artifacts.ledger), cii = objectRecord(artifacts.ciiProjection);
  const sourceIds = new Set(asArray(object.sourceEntities ?? object.sourceEntityIds).map(cleanText));
  const canonicalIds = new Set([cleanText(object.canonicalIdentity), cleanText(object.canonicalEdgeId), cleanText(object.canonicalNodeId)].filter(Boolean));
  const inputIds = new Set([cleanText(object.inputXmlIdentity), cleanText(object.inputXmlElementId), ...asArray(object.inputXmlElementIds).map(cleanText)].filter(Boolean));
  if (cleanText(object.id) && selection.kind === 'inputxml-edge') inputIds.add(cleanText(object.id));
  return [
    ...asArray(scene.edges).filter((row) => canonicalIds.has(cleanText(objectRecord(row).canonicalEdgeId)) || inputIds.has(cleanText(objectRecord(row).inputXmlElementId))).map((row) => ({ kind: 'SVG scene edge', value: row })),
    ...asArray(scene.nodes).filter((row) => canonicalIds.has(cleanText(objectRecord(row).canonicalNodeId))).map((row) => ({ kind: 'SVG scene node', value: row })),
    ...asArray(parsed.elements).filter((row) => inputIds.has(cleanText(objectRecord(row).id)) || canonicalIds.has(cleanText(objectRecord(row).canonicalEdgeId))).map((row) => ({ kind: 'InputXML element', value: row })),
    ...asArray(parsed.restraints).filter((row) => sourceIds.size && asArray(objectRecord(row).sourceEntityIds).some((id) => sourceIds.has(cleanText(id)))).map((row) => ({ kind: 'InputXML restraint', value: row })),
    ...asArray(ledger.records).filter((row) => sourceIds.has(cleanText(objectRecord(row).sourceEntityId)) || asArray(objectRecord(row).canonicalEdgeIds).some((id) => canonicalIds.has(cleanText(id)))).map((row) => ({ kind: 'Ledger record', value: row })),
    ...asArray(cii.elements).filter((row) => inputIds.has(cleanText(objectRecord(row).inputXmlElementId)) || Number(objectRecord(row).elementIndex) === Number(object.ciiIndex)).map((row) => ({ kind: 'CII ELEMENTS projection', value: row })),
    ...asArray(cii.records).filter((row) => asArray(objectRecord(row).inputXmlElementIds).some((id) => inputIds.has(cleanText(id))) || cleanText(objectRecord(row).projectionRecordId) === cleanText(object.projectionRecordId)).map((row) => ({ kind: 'CII projection record', value: row })),
  ];
}

export function topologyParityInspectorMarkup(selection, artifacts) {
  if (!selection) return '<div class="ttv-inspector-empty">Select a parity mismatch, SVG entity, InputXML element, or CII record.</div>';
  const object = objectRecord(selection.object), evidence = linkedRows(selection, artifacts);
  return `<div class="ttv-parity-inspector-header" onclick="this.parentElement.classList.toggle('is-collapsed')"><h3>${escapeHtml(selection.kind)}</h3><button type="button" title="Toggle Panel">▾</button></div><section class="ttv-parity-inspector"><dl><dt>Object key</dt><dd><code class="ttv-insp-code">${escapeHtml(selection.objectKey)}</code></dd><dt>Identity</dt><dd><code class="ttv-insp-code">${escapeHtml(valueText(object.id || object.ciiIdentity || object.canonicalIdentity || object.canonicalEdgeId || object.canonicalNodeId))}</code></dd><dt>Expected</dt><dd><pre>${escapeHtml(valueText(object.expected))}</pre></dd><dt>Actual</dt><dd><pre>${escapeHtml(valueText(object.actual))}</pre></dd><dt>Recommended owner</dt><dd>${escapeHtml(object.recommendedOwnerModule || '—')}</dd></dl><h4>Linked evidence</h4>${evidence.length ? evidence.map((row) => `<details><summary>${escapeHtml(row.kind)}</summary><pre>${escapeHtml(JSON.stringify(row.value, null, 2))}</pre></details>`).join('') : '<p>No linked evidence.</p>'}</section>`;
}

export const _test = Object.freeze({ escapeHtml, valueText, linkedRows });
