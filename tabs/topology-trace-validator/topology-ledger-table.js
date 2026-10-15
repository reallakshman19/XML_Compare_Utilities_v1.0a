/**
 * Functionality: renders the bottom evidence tabs and right-side trace
 * inspector from TopologySvgViewModel.v1. Inputs are immutable view data,
 * an explicit tab ID, and an optional selection group. Outputs are HTML only.
 * Fallback: absent InputXML is rendered as NOT_EVALUATED.
 */

import { asArray, cleanText, escapeMarkup, objectRecord } from './topology-validator-values.js';

export const TOPOLOGY_BOTTOM_TABS = Object.freeze([
  ['summary', 'Summary'],
  ['disposition', 'Source Disposition'],
  ['connections', 'Connections'],
  ['junctions', 'Junctions'],
  ['boundaries', 'Boundaries'],
  ['projection', 'Projection'],
  ['issues', 'Findings'],
  ['ledger', 'Full Ledger'],
]);

/** @param {Record<string, unknown>} viewModel @param {string} activeTab @returns {string} */
export function buildTopologyBottomPanelMarkup(viewModel, activeTab) {
  const tabs = TOPOLOGY_BOTTOM_TABS.map(([id, label]) => `<button type="button" data-ttv-bottom-tab="${id}" class="${id === activeTab ? 'is-active' : ''}">${label}</button>`).join('');
  const collapse = '<button type="button" data-ttv-bottom-collapse title="Collapse panel" style="margin-left:auto; font-weight:bold; font-size:16px;">▾</button>';
  return `<div class="ttv-bottom-tabbar">${tabs}${collapse}</div><div class="ttv-bottom-content">${bottomContent(viewModel, activeTab)}</div>`;
}

/** @param {Element} host @param {Record<string, unknown>} viewModel @param {string} activeTab @returns {void} */
export function renderTopologyBottomPanel(host, viewModel, activeTab) {
  host.innerHTML = buildTopologyBottomPanelMarkup(viewModel, activeTab);
}

/** @param {Record<string, unknown>} viewModel @param {Record<string, unknown>|null} selection @returns {string} */
export function buildTopologyInspectorMarkup(viewModel, selection) {
  if (!selection) return '<div class="ttv-inspector-empty">Select a source or canonical object to trace its evidence.</div>';
  const keys = new Set(asArray(selection.keys).map(cleanText));
  const sources = asArray(viewModel.sourceEntities ?? viewModel.sourceComponents).map(objectRecord).filter((row) => keys.has(cleanText(row.objectKey)));
  const canonical = [...asArray(viewModel.canonicalNodes), ...asArray(viewModel.canonicalEdges), ...asArray(viewModel.pointFeatures), ...asArray(viewModel.junctions), ...asArray(viewModel.boundaries)].map(objectRecord).filter((row) => keys.has(cleanText(row.objectKey)));
  const projection = asArray(viewModel.inputXmlElements).map(objectRecord).filter((row) => keys.has(cleanText(row.objectKey)));
  const records = asArray(selection.records).map(objectRecord).length ? asArray(selection.records).map(objectRecord) : [objectRecord(selection.record)].filter((row) => Object.keys(row).length);
  const values = (field) => [...new Set(records.flatMap((record) => asArray(record[field]).length ? asArray(record[field]) : [record[field]]).map(cleanText).filter(Boolean))];
  const source = sources[0];
  return `${inspectorSection('SOURCE', source ? [
    ['sourceEntityId', sources.map((row) => row.sourceEntityId)], ['sourcePath', sources.map((row) => row.sourcePath)], ['source branch', sources.map((row) => row.branch)], ['source index', sources.map((row) => row.sourceIndex)],
    ['source type', sources.map((row) => row.type)], ['source REF', sources.map((row) => row.ref)], ['source NAME', sources.map((row) => row.name)],
    ['APOS', objectRecord(source.positions).APOS], ['LPOS', objectRecord(source.positions).LPOS], ['POS', objectRecord(source.positions).POS],
    ['CREF', sources.map((row) => objectRecord(row.references).CREF)], ['HREF', sources.map((row) => objectRecord(row.references).HREF)], ['TREF', sources.map((row) => objectRecord(row.references).TREF)],
  ] : [['status', 'No source object in selection']])}${inspectorSection('CANONICAL', [
    ['canonical node IDs', values('canonicalNodeIds')], ['canonical edge IDs', values('canonicalEdgeIds')],
    ['point feature IDs', values('pointFeatureIds')], ['junction IDs', values('junctionIds')], ['boundary IDs', values('boundaryIds')],
    ['connection authority', records.map((row) => objectRecord(row.evidence).connectionAuthority)], ['connection residual', records.map((row) => objectRecord(row.evidence).connectionResidual)],
    ['source ancestry', canonical.flatMap((row) => asArray(row.sourceEntityIds))],
  ])}${inspectorSection('PROJECTION', [
    ['projection operation', values('operation')], ['projection cardinality', values('projectionCardinality')], ['InputXML element ID', projection.map((row) => row.id)],
    ['InputXML FROM_NODE', projection.map((row) => row.fromNode)], ['InputXML TO_NODE', projection.map((row) => row.toNode)],
    ['child records', projection.flatMap((row) => asArray(row.children).map((child) => objectRecord(child).id || objectRecord(child).viewKey))],
    ['loss/deferred classification', values('classification')], ['warning/error status', values('status').length ? values('status') : viewModel.inputXmlStatus],
  ])}`;
}

/** @param {string} title @param {unknown[][]} rows @returns {string} */
function inspectorSection(title, rows) {
  return `<section class="ttv-inspector-section"><h3>${escapeMarkup(title)}</h3>${rows.map(([label, value]) => {
    const arr = Array.isArray(value) ? value.filter((v) => v !== null && v !== undefined && v !== '') : null;
    const isLarge = arr && arr.length > 2;
    const content = isLarge ? `<details><summary style="cursor:pointer;color:#22d3ee">${arr.length} items</summary><div style="margin-top:4px;opacity:0.8">${escapeMarkup(formatValue(arr))}</div></details>` : escapeMarkup(formatValue(value));
    return `<div><dt>${escapeMarkup(label)}</dt><dd>${content}</dd></div>`;
  }).join('')}</section>`;
}

/** @param {Record<string, unknown>} viewModel @param {string} activeTab @returns {string} */
function bottomContent(viewModel, activeTab) {
  if (activeTab === 'summary') return summaryMarkup(viewModel);
  if (activeTab === 'disposition') return componentDispositionTable(viewModel);
  if (activeTab === 'connections') return referenceTable(viewModel, 'branchReferences');
  if (activeTab === 'junctions') return objectTable(asArray(viewModel.junctions), ['id', 'nodeId', 'expectedDegree', 'sourceEntityIds']);
  if (activeTab === 'boundaries') return `${objectTable(asArray(viewModel.boundaries), ['id', 'relationship', 'sourceEntityIds'])}${referenceTable(viewModel, 'external')}`;
  if (activeTab === 'projection') return viewModel.inputXmlStatus === 'NOT_EVALUATED' ? '<p class="ttv-not-evaluated">NOT_EVALUATED — topology InputXML is not loaded.</p>' : projectionTable(viewModel);
  if (activeTab === 'issues') return issuesTable(viewModel);
  return recordTable(asArray(viewModel.fullTraceLinks ?? viewModel.traceLinks), ['recordId', 'sourceType', 'sourcePath', 'primaryDisposition', 'projectionCardinality', 'operation', 'status', 'classification'], 'recordId');
}

/** @param {Record<string, unknown>} viewModel @returns {string} */
function summaryMarkup(viewModel) {
  const metrics = objectRecord(viewModel.metrics);
  const metricRows = Object.entries(metrics).filter(([key]) => key !== 'componentCoverage').map(([key, value]) => `<div><dt>${escapeMarkup(key)}</dt><dd>${escapeMarkup(formatValue(value))}</dd></div>`).join('');
  const gateRows = Object.entries(objectRecord(viewModel.gates)).map(([key, value]) => `<div class="${gatePassed(key, value) ? 'is-pass' : 'is-fail'}"><dt>${escapeMarkup(key)}</dt><dd>${escapeMarkup(formatGate(value))}</dd></div>`).join('');
  return `${componentCoverageCards(metrics)}${completionScorecard(metrics, viewModel)}<div class="ttv-summary-grid"><section><h3>Quantitative invariants</h3><dl>${metricRows}</dl></section><section><h3>Quality gates</h3><dl>${gateRows}</dl></section></div>`;
}

/** @param {Record<string, unknown>} metrics @returns {string} */
function componentCoverageCards(metrics) {
  const cards = Object.entries(objectRecord(metrics.componentCoverage)).map(([category, raw]) => {
    const card = objectRecord(raw), breakdown = `Edge ${card.edge || 0} · Point ${card.point || 0} · Junction ${card.junction || 0} · Blocked ${card.blocked || 0} · Deferred ${card.deferred || 0}`;
    return `<article class="ttv-component-card" data-component-coverage="${escapeMarkup(category)}" data-result="${escapeMarkup(card.result)}"><h4>${escapeMarkup(category)} coverage</h4><strong>${escapeMarkup(card.accounted)} / ${escapeMarkup(card.total)}</strong><span>${escapeMarkup(breakdown)}</span><span>${Number(card.percentage || 0).toFixed(3)}%</span><b>${escapeMarkup(card.result)}</b></article>`;
  }).join('');
  return `<section><h3>Component accountability</h3><div class="ttv-component-cards">${cards}</div></section>`;
}

/** @param {Record<string, unknown>} metrics @param {Record<string, unknown>} viewModel @returns {string} */
function completionScorecard(metrics, viewModel) {
  const coverage = objectRecord(metrics.componentCoverage), rows = ['PIPE', 'GASK', 'FLANGE', 'ELBO/BEND', 'VALVE', 'TEE', 'INST', 'OLET', 'REDUCER'].map((category) => {
    const card = objectRecord(coverage[category]);
    return [`${category} accountability`, card.total ?? 0, card.accounted ?? 0, card.result ?? 'FAIL'];
  });
  const issues = asArray(viewModel.issues).map(objectRecord);
  const cardinalityIssues = issues.filter((row) => ['UNEXPLAINED_ONE_TO_MANY', 'UNEXPLAINED_MERGE', 'UNEXPLAINED_SPLIT'].includes(cleanText(row.code))).length;
  rows.push(['Invalid zero-length elements', 0, metrics.invalidZeroLengthInputXmlElementCount, metrics.invalidZeroLengthInputXmlElementCount === 0 ? 'PASS' : metrics.invalidZeroLengthInputXmlElementCount === 'NOT_EVALUATED' ? 'NOT_EVALUATED' : 'FAIL']);
  rows.push(['Silent component absorption', 0, metrics.silentlyAbsorbedComponentCount, metrics.silentlyAbsorbedComponentCount === 0 ? 'PASS' : 'FAIL']);
  rows.push(['Unexplained cardinality changes', 0, cardinalityIssues, cardinalityIssues === 0 ? 'PASS' : 'FAIL']);
  const body = rows.map(([area, required, actual, result]) => `<tr><td>${escapeMarkup(area)}</td><td>${escapeMarkup(required)}</td><td>${escapeMarkup(actual)}</td><td>${escapeMarkup(result)}</td></tr>`).join('');
  return `<section><h3>Completion scorecard</h3><div class="ttv-table-scroll"><table><thead><tr><th>Area</th><th>Required</th><th>Actual</th><th>Result</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
}

/** @param {Record<string, unknown>} viewModel @returns {string} */
function componentDispositionTable(viewModel) {
  const sources = asArray(viewModel.sourceEntities).map(objectRecord), links = asArray(viewModel.fullTraceLinks ?? viewModel.traceLinks).map(objectRecord);
  const headings = ['Source type', 'Source entity ID', 'Source path', 'POS', 'Finite/point classification', 'Primary disposition', 'Canonical nodes', 'Canonical edges', 'Point feature', 'Junction', 'Projection cardinality', 'InputXML elements', 'Deferred properties', 'Status', 'Focus in SVG'];
  const body = links.map((row) => {
    const source = sources.find((candidate) => cleanText(candidate.sourceEntityId) === cleanText(row.sourceEntityId) || cleanText(candidate.sourcePath) === cleanText(row.sourcePath));
    const edgeIds = [...new Set([...asArray(row.canonicalEdgeIds), ...asArray(row.affectedEdgeIds), ...asArray(row.branchEdgeIds)].map(cleanText).filter(Boolean))];
    const positions = objectRecord(objectRecord(source).positions);
    const pos = positions.POS || positions.APOS || positions.LPOS || null;
    const posString = pos ? `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}` : '';
    const values = [row.sourceType, row.sourceEntityId, row.sourcePath, posString, objectRecord(source).geometryClassification, row.primaryDisposition, row.canonicalNodeIds, edgeIds, row.pointFeatureIds, row.junctionIds, row.projectionCardinality, row.inputXmlElementIds, row.deferredProperties, row.status];
    return `<tr data-object-key="${escapeMarkup(row.objectKey)}" data-ledger-record-id="${escapeMarkup(row.recordId)}">${values.map((value) => `<td>${escapeMarkup(formatValue(value))}</td>`).join('')}<td><button type="button" class="ttv-focus-button">Focus in SVG</button></td></tr>`;
  }).join('');
  return `<div class="ttv-table-scroll"><table><thead><tr>${headings.map((heading) => `<th>${escapeMarkup(heading)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** @param {unknown[]} records @param {string[]} fields @param {string} labelField @returns {string} */
function recordTable(records, fields, labelField) {
  const header = fields.map((field) => `<th>${escapeMarkup(field)}</th>`).join('');
  const body = records.map((raw) => {
    const row = objectRecord(raw);
    return `<tr data-object-key="${escapeMarkup(row.objectKey)}" data-ledger-record-id="${escapeMarkup(row.recordId || row[labelField])}">${fields.map((field) => `<td>${escapeMarkup(formatValue(row[field]))}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="ttv-table-scroll"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** @param {Record<string, unknown>} viewModel @returns {string} */
function projectionTable(viewModel) {
  const body = asArray(viewModel.inputXmlElements).map((raw) => {
    const row = objectRecord(raw);
    return `<tr data-object-key="${escapeMarkup(row.objectKey)}" data-inputxml-element-id="${escapeMarkup(row.id)}"><td>${escapeMarkup(row.id)}</td><td>${escapeMarkup(row.fromNode)}</td><td>${escapeMarkup(row.toNode)}</td><td>${escapeMarkup(formatValue(row.delta))}</td><td>${asArray(row.children).length}</td></tr>`;
  }).join('');
  return `<div class="ttv-table-scroll"><table><thead><tr><th>ID</th><th>FROM_NODE</th><th>TO_NODE</th><th>Vector</th><th>Children</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

/** @param {Record<string, unknown>} viewModel @returns {string} */
function issuesTable(viewModel) {
  const body = asArray(viewModel.issues).map((raw) => {
    const row = objectRecord(raw);
    return `<tr data-issue-id="${escapeMarkup(row.id)}" data-object-key="issue:${escapeMarkup(row.id)}"><td>${escapeMarkup(row.severity)}</td><td>${escapeMarkup(row.code)}</td><td>${escapeMarkup(row.message)}</td><td>${escapeMarkup(row.sourcePath)}</td><td><button type="button" class="ttv-focus-button">Focus in SVG</button></td></tr>`;
  }).join('');
  return `<div class="ttv-table-scroll"><table><thead><tr><th>Severity</th><th>Code</th><th>Message</th><th>Source path</th><th>Focus in SVG</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

/** @param {Record<string, unknown>} viewModel @param {string} kind @returns {string} */
function referenceTable(viewModel, kind) {
  const refs = objectRecord(viewModel.branchReferences);
  const rows = kind === 'external'
    ? [...asArray(refs.branchReferences), ...asArray(refs.crefReferences)].map(objectRecord).filter((row) => row.resolved !== true)
    : asArray(refs[kind]).map(objectRecord);
  return objectTable(rows, ['kind', 'branchName', 'value', 'resolved', 'sourcePath']);
}

/** @param {unknown[]} rows @param {string[]} fields @returns {string} */
function objectTable(rows, fields) {
  const head = fields.map((field) => `<th>${escapeMarkup(field)}</th>`).join('');
  const body = rows.map((raw) => `<tr>${fields.map((field) => `<td>${escapeMarkup(formatValue(objectRecord(raw)[field]))}</td>`).join('')}</tr>`).join('');
  return `<div class="ttv-table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** @param {string} key @param {unknown} value @returns {boolean} */
function gatePassed(key, value) {
  if (value === 'NOT_EVALUATED') return false;
  if (key.includes('Coverage') || key.includes('Ancestry')) return Number(value) === 100;
  return Number(value) === 0;
}

/** @param {unknown} value @returns {string} */
function formatGate(value) {
  if (value === 'NOT_EVALUATED') return 'NOT_EVALUATED';
  return typeof value === 'number' && value > 0 && value <= 100 ? `${value.toFixed(2)}%` : formatValue(value);
}

/** @param {unknown} value @returns {string} */
function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export const _test = Object.freeze({ bottomContent, gatePassed, formatGate, formatValue });
