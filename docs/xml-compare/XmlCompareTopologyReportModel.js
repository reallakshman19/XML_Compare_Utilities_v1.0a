import { parse } from '../parser/caesar-parser.js';
import { buildXmlGraphData } from '../parser/xml-graph-builder.js';
import { buildXmlSupportComponents } from '../parser/xml-support-builder.js';

export const XML_COMPARE_SCHEMA = 'xml-compare/v1';
export const XML_COMPARE_BLOCK_CODES = Object.freeze({
  SUPPORT_ATTACHMENT_MISSING: 'SUPPORT-ATTACHMENT-MISSING',
  TEE_BRANCH_CONNECTIVITY_CHANGED: 'TEE-BRANCH-CONNECTIVITY-CHANGED',
  OLET_BRANCH_CONNECTIVITY_CHANGED: 'OLET-BRANCH-CONNECTIVITY-CHANGED',
  TOPOLOGY_COORDINATE_MISMATCH: 'TOPOLOGY-COORDINATE-MISMATCH',
  TOPOLOGY_TYPE_MISMATCH: 'TOPOLOGY-TYPE-MISMATCH',
  TOPOLOGY_MISSING_COMPONENT: 'TOPOLOGY-MISSING-COMPONENT',
});
export const DEFAULT_XML_COMPARE_FILTERS = Object.freeze({ severity: 'ALL', code: 'ALL', datasetId: 'ALL', search: '' });

const clean = (value) => String(value ?? '').trim();
const number = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

function point(value) {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 3) return { x: number(value[0]), y: number(value[1]), z: number(value[2]) };
  if (typeof value === 'string') return point(value.split(/[\s,]+/).map(Number).filter(Number.isFinite));
  if (typeof value !== 'object') return null;
  const x = value.x ?? value.X;
  const y = value.y ?? value.Y;
  const z = value.z ?? value.Z;
  return [x, y, z].every((item) => Number.isFinite(Number(item))) ? { x: number(x), y: number(y), z: number(z) } : null;
}

function pointDistance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = number(a.x) - number(b.x);
  const dy = number(a.y) - number(b.y);
  const dz = number(a.z) - number(b.z);
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function componentKey(component) {
  return clean(component?.id || component?.source?.id || component?.attributes?.['COMPONENT-ATTRIBUTE97'] || component?.attributes?.SKEY || component?.attributes?.['PIPELINE-REFERENCE'] || `${component?.type || 'COMPONENT'}:${component?.rowNo || ''}`);
}

function componentLabel(component) {
  return clean(component?.label || component?.name || component?.attributes?.SKEY || component?.id || component?.type || 'COMPONENT');
}

function normalizeComponent(component, datasetId, index) {
  const points = [component?.points?.[0], component?.points?.[1]].map(point).filter(Boolean);
  return { id: componentKey(component) || `${datasetId}-${index + 1}`, type: clean(component?.type || 'UNKNOWN').toUpperCase(), datasetId, pipelineRef: clean(component?.pipelineRef || component?.attributes?.['PIPELINE-REFERENCE'] || component?.source?.lineNo || ''), label: componentLabel(component), points, centrePoint: point(component?.centrePoint), branch1Point: point(component?.branch1Point), coOrds: point(component?.coOrds), supportKind: clean(component?.supportKind || component?.attributes?.SUPPORT_KIND || ''), supportDirection: clean(component?.supportDirection || component?.attributes?.SUPPORT_DIRECTION || ''), raw: component };
}

function issueComponent(component) {
  return { componentId: component.id, type: component.type, pipeline: component.pipelineRef, label: component.label };
}

function supportIssue(component, datasetId) {
  if (component.type !== 'SUPPORT' || component.coOrds || component.points.length) return null;
  return { code: XML_COMPARE_BLOCK_CODES.SUPPORT_ATTACHMENT_MISSING, severity: 'ERROR', datasetId, componentId: component.id, component: issueComponent(component), message: `Support component ${component.label} is missing attachment coordinates.` };
}

function branchIssue(component, datasetId) {
  if (component.type !== 'TEE' && component.type !== 'OLET') return null;
  if (component.branch1Point && component.centrePoint && pointDistance(component.branch1Point, component.centrePoint) > 0.5) return null;
  const code = component.type === 'TEE' ? XML_COMPARE_BLOCK_CODES.TEE_BRANCH_CONNECTIVITY_CHANGED : XML_COMPARE_BLOCK_CODES.OLET_BRANCH_CONNECTIVITY_CHANGED;
  return { code, severity: 'ERROR', datasetId, componentId: component.id, component: issueComponent(component), message: `${component.type} branch connectivity could not be confirmed for ${component.label}.` };
}

export function buildXmlDataset(fileName, text, datasetId) {
  const parsed = parse(text || '', fileName || `${datasetId}.xml`);
  const graph = buildXmlGraphData(parsed, fileName || `${datasetId}.xml`, { syntheticGapMm: 3000 });
  const supports = buildXmlSupportComponents(parsed, { nodePositions: graph.solvedNodePositions || {}, defaultBore: 100, verticalAxis: 'Y' });
  const base = graph.components || [];
  return { datasetId, fileName: fileName || '', parsed, graph, components: [...base.map((item, i) => normalizeComponent(item, datasetId, i)), ...supports.map((item, i) => normalizeComponent(item, datasetId, base.length + i))], diagnostics: [...(graph.diagnostics?.nodeConflicts || [])] };
}

function distanceIssue(source, target, toleranceMm) {
  if (source.points.length < 2 || target.points.length < 2) return null;
  const direct = pointDistance(source.points[0], target.points[0]) + pointDistance(source.points[1], target.points[1]);
  const reverse = pointDistance(source.points[0], target.points[1]) + pointDistance(source.points[1], target.points[0]);
  const distanceMm = Math.min(direct, reverse) / 2;
  return distanceMm <= toleranceMm ? null : { code: XML_COMPARE_BLOCK_CODES.TOPOLOGY_COORDINATE_MISMATCH, severity: 'WARNING', datasetId: source.datasetId, componentId: source.id, component: issueComponent(source), nearestComponent: issueComponent(target), distanceMm, toleranceMm, message: `Component ${source.label} moved by ${distanceMm.toFixed(1)} mm relative to ${target.label}.` };
}

function missingIssue(component, datasetId) {
  return { code: XML_COMPARE_BLOCK_CODES.TOPOLOGY_MISSING_COMPONENT, severity: 'WARNING', datasetId, componentId: component.id, component: issueComponent(component), message: `Component ${component.label} exists in ${datasetId} but not in the other dataset.` };
}

function addSourceIssues(issues, source, target, toleranceMm, datasetId) {
  if (!target) { issues.push(missingIssue(source, datasetId)); return; }
  if (source.type !== target.type) issues.push({ code: XML_COMPARE_BLOCK_CODES.TOPOLOGY_TYPE_MISMATCH, severity: 'ERROR', datasetId, componentId: source.id, component: issueComponent(source), nearestComponent: issueComponent(target), message: `Component ${source.label} changed type from ${source.type} to ${target.type}.` });
  for (const issue of [distanceIssue(source, target, toleranceMm), supportIssue(source, datasetId), branchIssue(source, datasetId)].filter(Boolean)) issues.push(issue);
}

function buildIssuesFromDatasets(sourceDataset, targetDataset, toleranceMm) {
  const issues = [];
  const targetById = new Map((targetDataset.components || []).map((item) => [item.id, item]));
  const sourceById = new Map((sourceDataset.components || []).map((item) => [item.id, item]));
  for (const source of sourceDataset.components || []) addSourceIssues(issues, source, targetById.get(source.id), toleranceMm, sourceDataset.datasetId);
  for (const target of targetDataset.components || []) if (!sourceById.has(target.id)) issues.push(missingIssue(target, targetDataset.datasetId));
  return issues;
}

export function topologyIssuePassesFilters(issue, filters = DEFAULT_XML_COMPARE_FILTERS) {
  if (!issue) return false;
  if (filters.severity !== 'ALL' && issue.severity !== filters.severity) return false;
  if (filters.code !== 'ALL' && issue.code !== filters.code) return false;
  if (filters.datasetId !== 'ALL' && issue.datasetId !== filters.datasetId) return false;
  const haystack = [issue.code, issue.severity, issue.datasetId, issue.componentId, issue.component?.type, issue.component?.pipeline, issue.component?.label, issue.message].map((value) => clean(value).toLowerCase()).join(' ');
  return !clean(filters.search) || haystack.includes(clean(filters.search).toLowerCase());
}

export function filterTopologyIssues(issues = [], filters = DEFAULT_XML_COMPARE_FILTERS) {
  return (Array.isArray(issues) ? issues : []).filter((issue) => topologyIssuePassesFilters(issue, filters));
}

export function topologyIssueComponentIds(issues = []) {
  return [...new Set((Array.isArray(issues) ? issues : []).map((issue) => issue?.componentId).filter(Boolean))];
}

export function buildTopologyIssuesCsv(issues = []) {
  const rows = [['Code', 'Severity', 'Dataset', 'Component Id', 'Type', 'Pipeline', 'Label', 'Nearest Component Id', 'Distance mm', 'Tolerance mm', 'Message']];
  for (const issue of issues || []) rows.push([issue.code || '', issue.severity || '', issue.datasetId || '', issue.componentId || '', issue.component?.type || '', issue.component?.pipeline || '', issue.component?.label || '', issue.nearestComponent?.componentId || '', issue.distanceMm != null ? number(issue.distanceMm).toFixed(1) : '', issue.toleranceMm != null ? number(issue.toleranceMm).toFixed(1) : '', issue.message || '']);
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

function csvCell(value) {
  const text = clean(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function datasetInfo(dataset, id) {
  return { datasetId: dataset?.datasetId || id, fileName: dataset?.fileName || '', componentCount: dataset?.components?.length || 0 };
}

export function compareXmlDatasets(datasetA, datasetB, options = {}) {
  const toleranceMm = number(options.toleranceMm, 6);
  const issues = buildIssuesFromDatasets(datasetA || { components: [], datasetId: 'A' }, datasetB || { components: [], datasetId: 'B' }, toleranceMm).filter(Boolean);
  const severityCounts = issues.reduce((acc, issue) => ({ ...acc, [issue.severity]: (acc[issue.severity] || 0) + 1 }), {});
  return { schema: XML_COMPARE_SCHEMA, ok: (severityCounts.ERROR || 0) === 0, toleranceMm, datasets: { A: datasetInfo(datasetA, 'A'), B: datasetInfo(datasetB, 'B') }, topologyIssues: { issues, summary: { issueCount: issues.length, fixableCount: issues.filter((issue) => issue.severity !== 'ERROR').length, fatalCount: issues.filter((issue) => issue.severity === 'ERROR').length, severityCounts, issueCodes: [...new Set(issues.map((issue) => issue.code))].sort() } } };
}

export function normalizeXmlCompareDatasetFromText(fileName, text, datasetId) {
  try { return { ok: true, ...buildXmlDataset(fileName, text, datasetId) }; }
  catch (error) { return { ok: false, datasetId, fileName: fileName || '', error: error?.message || String(error), parsed: null, graph: null, components: [], diagnostics: [] }; }
}

export function buildXmlCompareReport({ fileNameA = 'xml-a.xml', textA = '', fileNameB = 'xml-b.xml', textB = '', toleranceMm = 6 } = {}) {
  const datasetA = normalizeXmlCompareDatasetFromText(fileNameA, textA, 'A');
  const datasetB = normalizeXmlCompareDatasetFromText(fileNameB, textB, 'B');
  if (!datasetA.ok || !datasetB.ok) return { schema: XML_COMPARE_SCHEMA, ok: false, toleranceMm, datasets: { A: datasetA, B: datasetB }, topologyIssues: { issues: [], summary: { issueCount: 0, fixableCount: 0, fatalCount: 0, severityCounts: {}, issueCodes: [] } }, parseErrors: [datasetA.error, datasetB.error].filter(Boolean) };
  const report = compareXmlDatasets(datasetA, datasetB, { toleranceMm });
  return { ...report, datasets: { A: datasetA, B: datasetB }, parseErrors: [] };
}

export const _test = Object.freeze({ clean, number, point, pointDistance, componentKey, componentLabel, normalizeComponent, issueComponent });
