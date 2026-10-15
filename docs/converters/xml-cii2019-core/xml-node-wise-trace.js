import { buildJsonTraceTree } from './json-trace-tree.js';
import { branchContainsMatch } from './json-trace-scope.js';

export const XML_CII_XML_NODE_TRACE_SCHEMA = 'xml-cii-xml-node-wise-trace/v3-dual-dtxr';

const NONE = '(none)';
const TRACE_TYPES = new Set(['dtxr-pos', 'dtxr-ps', 'support-match', 'dtxr-pos-sif-zero', 'dtxr-resolution-ledger']);
const XML_NODE_TRACE_HEADERS = Object.freeze([
  ['xmlNode', 'XML Node'],
  ['xmlBranch', 'XML Branch'],
  ['componentType', 'Type'],
  ['jsonNodeNoDtxrPs', 'JsonNodeNo(DTXR_PS)'],
  ['jsonNodeNoDtxrPos', 'JsonNodeNo(DTXR_POS)'],
  ['matchType', 'Match Type'],
  ['posBasis', 'POS Basis'],
  ['dtxrPosValue', 'DTXR_POS Value'],
  ['dtxrPsName', 'DTXR_PS/NAME'],
  ['dtxrPsValue', 'DTXR_PS Value'],
  ['branchRelationship', 'Branch Relationship'],
  ['distanceMm', 'Distance mm'],
  ['toleranceMm', 'Tolerance mm'],
  ['status', 'Status'],
]);
const EVIDENCE_TREE_HEADERS = Object.freeze([
  ['branchName', 'Branch'],
  ['bore', 'Bore'],
  ['evidenceType', 'Evidence Type'],
  ['group', 'Evidence Group'],
  ['jsonNodeNo', 'JsonNodeNo'],
  ['objectType', 'Object Type'],
  ['nodeNumber', 'Staged Node'],
  ['position', 'Position'],
  ['field', 'Field'],
  ['value', 'Value'],
  ['dtxrValue', 'DTXR Value'],
  ['name', 'NAME / REF'],
  ['sourcePath', 'JSON Path'],
  ['matchType', 'Trace Match Type'],
  ['resolved', 'Resolved'],
]);

function text(value) { return String(value ?? '').trim(); }
function unique(values = []) { return [...new Set(values.map(text).filter(Boolean))]; }
function rowValue(row = {}) { return text(row.finalValue || row.sourceRawValue || row.value || row.sourceAttributeValue); }
function componentPath(value) {
  const raw = text(value);
  const index = raw.indexOf('.attributes');
  return index >= 0 ? raw.slice(0, index) : raw;
}
function jsonNodeNo(row = {}) { return text(row.jsonNodeNo || row._jsonNodeNo); }
function numericNodeNo(value) {
  const number = Number(text(value));
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
}
function naturalNodeSort(left, right) {
  return numericNodeNo(left) - numericNodeNo(right)
    || text(left).localeCompare(text(right), undefined, { numeric: true });
}
function nodeRange(values = []) {
  const nodes = unique(values).sort(naturalNodeSort);
  if (!nodes.length) return NONE;
  if (nodes.length === 1) return nodes[0];
  return `${nodes[0]} to ${nodes[nodes.length - 1]}`;
}
function stripIdentityPrefix(value) {
  return text(value).replace(/^\s*=\s*/, '').replace(/^\/+/, '');
}
function identityKey(value) {
  return stripIdentityPrefix(value).replace(/[\s\-_/=]+/g, '').toUpperCase();
}
function isSupportLike(componentType, nodeName) {
  return /^(ATTA|ANCI|REST|RESTRAINT|SUPPORT)$/i.test(text(componentType))
    || /^\/?PS-?\d/i.test(text(nodeName));
}
function isSideLoadType(value) { return /^sideload-restraint/.test(text(value)); }
function isPositionField(value) {
  const source = text(value);
  if (/DTXR[_\s-]*POS/i.test(source)) return false;
  return /(^|[^A-Z])(POS|APOS|LPOS|BPOS|HPOS|TPOS|SPOS|EPOS|POSITION)([^A-Z]|$)/i.test(source);
}
function isDescriptionField(row = {}) {
  const source = `${row.field || ''} ${row.sourceAttributeName || ''} ${row.sourcePath || ''}`;
  return /DTXR|DESC|DESCRIPTION/i.test(source) && !isPositionField(source);
}
function isIdentityField(row = {}) {
  const source = `${row.field || ''} ${row.sourceAttributeName || ''} ${row.sourcePath || ''}`;
  return /(^|[^A-Z])(NAME|REF|STEX|CMPSTRESSN|CMPSUPREFN|SUPPORT_TAG|COMPONENTREFNO)([^A-Z]|$)/i.test(source);
}
function branchMatches(xmlBranch, stagedBranch) {
  if (!text(xmlBranch)) return true;
  if (!text(stagedBranch)) return false;
  return Boolean(branchContainsMatch(xmlBranch, stagedBranch)
    || branchContainsMatch(stagedBranch, xmlBranch));
}
function tagContent(block, tag) {
  const match = String(block || '').match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return text(match?.[1])
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .trim();
}
function nodeBlocks(block) {
  return [...String(block || '').matchAll(/<Node\b[^>]*>[\s\S]*?<\/Node>/gi)]
    .map((match) => match[0]);
}

export function extractXmlNodeTraceSeeds(xmlText = '') {
  const rows = [];
  const source = String(xmlText || '');
  const branches = [...source.matchAll(/<Branch\b[^>]*>([\s\S]*?)<\/Branch>/gi)];
  const append = (branchBlock, branchName) => {
    for (const nodeBlock of nodeBlocks(branchBlock)) {
      rows.push(Object.freeze({
        xmlNode: tagContent(nodeBlock, 'NodeNumber'),
        xmlBranch: branchName,
        componentType: tagContent(nodeBlock, 'ComponentType'),
        nodeName: tagContent(nodeBlock, 'NodeName'),
        componentRefNo: tagContent(nodeBlock, 'ComponentRefNo'),
        position: tagContent(nodeBlock, 'Position'),
      }));
    }
  };
  if (branches.length) {
    for (const match of branches) append(match[1], tagContent(match[1], 'Branchname'));
  } else {
    append(source, tagContent(source, 'Branchname'));
  }
  return Object.freeze(rows);
}

function positionParts(value) {
  const source = text(value);
  if (!source) return null;
  const directional = {};
  source.replace(
    /\b(E|EAST|EASTING|N|NORTH|NORTHING|EL|ELEV|ELEVATION|U|Z)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/gi,
    (_, axis, raw) => {
      const key = axis.toUpperCase();
      if (key.startsWith('E') && !['EL', 'ELEV', 'ELEVATION'].includes(key)) directional.x = Number(raw);
      else if (key.startsWith('N')) directional.y = Number(raw);
      else directional.z = Number(raw);
      return '';
    },
  );
  if ([directional.x, directional.y, directional.z].every(Number.isFinite)) return directional;
  const values = source.match(/-?\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) || [];
  return values.length === 3 && values.every(Number.isFinite)
    ? { x: values[0], y: values[1], z: values[2] }
    : null;
}
function positionLabel(value) {
  const point = positionParts(value);
  if (!point) return text(value) || NONE;
  return `E=${point.x} N=${point.y} EL=${point.z}`;
}
function positionKey(value) {
  const point = positionParts(value);
  if (!point) return '';
  return [point.x, point.y, point.z]
    .map((number) => Math.round(number * 1000) / 1000)
    .join('|');
}
function distanceBetween(left, right) {
  const a = positionParts(left);
  const b = positionParts(right);
  if (!a || !b) return null;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}
function groupPositionKey(group = {}) { return positionKey(group.label); }
function leafDescription(leaf = {}) {
  if (isPositionField(`${leaf.field || ''} ${leaf.sourcePath || ''}`)) return '';
  return text(leaf.dtxrValue || leaf.value);
}
function leafRawDescription(leaf = {}) {
  if (isPositionField(`${leaf.field || ''} ${leaf.sourcePath || ''}`)) return '';
  return text(leaf.value);
}
function branchPositionGroups(traceRows, xmlBranch) {
  const scoped = (traceRows || []).filter((row) => branchMatches(
    xmlBranch,
    row.branchName || row.stagedBranchKey || row.xmlBranchKey,
  ));
  const tree = buildJsonTraceTree(scoped, {
    rowLimit: 9999,
    groupLimit: 9999,
    useDelimiter: true,
    delimiter: ' | ',
    joinMode: 'unique',
  });
  const groups = [];
  for (const branch of tree.branches.filter((item) => branchMatches(xmlBranch, item.branchName))) {
    for (const bore of branch.bores || []) {
      const bucket = (bore.buckets || []).find((item) => item.label === 'DTXR-POS');
      for (const group of bucket?.groups || []) {
        const rows = group.rows || [];
        const descriptions = unique(rows.map(leafDescription).filter(Boolean));
        const rawDescriptions = unique(rows.map(leafRawDescription).filter(Boolean));
        if (!descriptions.length) continue;
        groups.push({
          label: group.label,
          key: groupPositionKey(group),
          descriptions,
          rawDescriptions,
          value: descriptions.join(' | '),
          nodes: unique(rows.map((row) => row.jsonNodeNo)),
          paths: unique(rows.map((row) => componentPath(row.sourcePath))),
          rows,
          stagedBranch: branch.branchName,
        });
      }
    }
  }
  groups.sort((left, right) => naturalNodeSort(left.nodes[0], right.nodes[0]));
  return groups;
}
function exactPositionGroup(groups, xmlPosition, toleranceMm = 0.001) {
  const target = positionParts(xmlPosition);
  if (!target) return null;
  let best = null;
  for (const group of groups || []) {
    const distanceMm = distanceBetween(group.label, xmlPosition);
    if (!Number.isFinite(distanceMm) || distanceMm > toleranceMm) continue;
    if (!best || distanceMm < best.distanceMm) best = { group, distanceMm };
  }
  return best;
}
function identityKeys(seed = {}) {
  return unique([seed.nodeName, seed.componentRefNo, ...(seed.tags || []), ...(seed.matchedKeys || [])])
    .map(identityKey)
    .filter(Boolean);
}
function leafIdentityKeys(leaf = {}) {
  return unique([leaf.name, leaf.value, leaf.dtxrValue])
    .map(identityKey)
    .filter(Boolean);
}
function selectGroupMember(group, seed) {
  const keys = identityKeys(seed);
  let best = null;
  for (const leaf of group?.rows || []) {
    const rowKeys = leafIdentityKeys(leaf);
    const exact = keys.some((key) => rowKeys.includes(key));
    const contains = !exact && keys.some((key) => rowKeys.some((rowKey) => rowKey.includes(key) || key.includes(rowKey)));
    const score = exact ? 120 : contains ? 70 : 0;
    if (score > 0 && (!best || score > best.score)) best = { leaf, score };
  }
  return best?.leaf || null;
}
function candidateTraceRows(traceRows, seed) {
  const keys = identityKeys(seed);
  const rows = (traceRows || []).filter((row) => branchMatches(
    seed.xmlBranch,
    row.branchName || row.stagedBranchKey || row.xmlBranchKey,
  ));
  const scored = [];
  for (const row of rows) {
    const rowKeys = unique([rowValue(row), row.name, row.matchedToken, row.matchedText])
      .map(identityKey)
      .filter(Boolean);
    const exact = keys.some((key) => rowKeys.includes(key));
    const contains = !exact && keys.some((key) => rowKeys.some((rowKey) => rowKey.includes(key) || key.includes(rowKey)));
    const pathMatch = (seed.positionPaths || []).includes(componentPath(row.sourcePath || row.jsonPath));
    let score = exact ? 120 : contains ? 80 : 0;
    if (isIdentityField(row)) score += 30;
    if (/^DTXR_PS/.test(text(row.xmlTraceScope))) score += 20;
    if (pathMatch) score += 15;
    if (score > 0) scored.push({ row, score, path: componentPath(row.sourcePath || row.jsonPath) });
  }
  return scored.sort((left, right) => right.score - left.score
    || naturalNodeSort(jsonNodeNo(left.row), jsonNodeNo(right.row)));
}
function rowsAtPath(traceRows, path, predicate = () => true) {
  if (!path) return [];
  return (traceRows || []).filter((row) => (
    componentPath(row.sourcePath || row.jsonPath) === path && predicate(row)
  ));
}
function descriptionRowsAtPath(traceRows, path) {
  return rowsAtPath(traceRows, path, (row) => (
    isDescriptionField(row) || /^DTXR_POS/.test(text(row.xmlTraceScope))
  ));
}
function identityRowsAtPaths(traceRows, paths = []) {
  const allowed = new Set(paths.map(text).filter(Boolean));
  return (traceRows || []).filter((row) => (
    allowed.has(componentPath(row.sourcePath || row.jsonPath)) && isIdentityField(row)
  ));
}
function effectiveIdentityName(seed, identityRow, memberLeaf) {
  return stripIdentityPrefix(
    seed.nodeName
    || rowValue(identityRow)
    || memberLeaf?.name
    || seed.componentRefNo,
  ) || NONE;
}
function diagnosticGroups(diagnostics = []) {
  const map = new Map();
  for (const row of diagnostics || []) {
    const type = text(row.type);
    if (!TRACE_TYPES.has(type) && !isSideLoadType(type)) continue;
    const key = `${text(row.branchName)}\u0001${text(row.nodeNumber)}\u0001${text(row.componentType)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}
function seedKey(seed) {
  return `${text(seed.xmlBranch)}\u0001${text(seed.xmlNode)}\u0001${text(seed.componentType)}`;
}
function combineSeeds(xmlSeeds, diagnostics) {
  const groups = diagnosticGroups(diagnostics);
  const rows = [...xmlSeeds];
  const existing = new Set(rows.map(seedKey));
  for (const [key, items] of groups) {
    if (existing.has(key)) continue;
    const first = items[0] || {};
    rows.push({
      xmlNode: first.nodeNumber || '',
      xmlBranch: first.branchName || '',
      componentType: first.componentType || '',
      nodeName: first.nodeName || '',
      componentRefNo: first.componentRefNo || '',
      position: first.position || first.matchedKey || '',
    });
  }
  return { rows, groups };
}
function branchRelationship(xmlBranch, stagedBranch) {
  const match = branchContainsMatch(xmlBranch, stagedBranch)
    || branchContainsMatch(stagedBranch, xmlBranch);
  return match?.matchType || (branchMatches(xmlBranch, stagedBranch) ? 'COMPATIBLE' : 'NONE');
}
function meaningfulDiagnosticValue(value) {
  const output = text(value);
  return output && output !== NONE ? output : '';
}
function traceNodeNumbersForPaths(traceRows, paths = []) {
  const wanted = new Set((paths || []).map(componentPath).filter(Boolean));
  return unique((traceRows || [])
    .filter((row) => wanted.has(componentPath(row.sourcePath || row.jsonPath)))
    .map(jsonNodeNo));
}
function ledgerDecision(seed, ledgerRow, traceRows) {
  const positionPaths = Array.isArray(ledgerRow.positionPaths)
    ? ledgerRow.positionPaths
    : (Array.isArray(ledgerRow.dtxrPositionPaths) ? ledgerRow.dtxrPositionPaths : []);
  const posNodes = traceNodeNumbersForPaths(traceRows, positionPaths);
  const psPath = ledgerRow.sourcePath || ledgerRow.dtxrPsPath || '';
  const psNodes = traceNodeNumbersForPaths(traceRows, [psPath]);
  const posNodeText = nodeRange(posNodes);
  const psNodeText = nodeRange(psNodes.length ? psNodes : posNodes.slice(0, 1));
  const dtxrPosValue = text(ledgerRow.dtxrPosValue) || NONE;
  const dtxrPsValue = text(ledgerRow.dtxrPsValue) || NONE;
  const status = text(ledgerRow.status) || (dtxrPosValue !== NONE || dtxrPsValue !== NONE ? 'RESOLVED' : 'UNRESOLVED');
  const authority = text(ledgerRow.effectiveAuthority) || 'NONE';
  return Object.freeze({
    schema: XML_CII_XML_NODE_TRACE_SCHEMA,
    xmlNode: seed.xmlNode || text(ledgerRow.nodeNumber) || NONE,
    xmlBranch: seed.xmlBranch || text(ledgerRow.branchName) || NONE,
    componentType: seed.componentType || text(ledgerRow.componentType) || NONE,
    jsonNodeNoDtxrPs: psNodeText,
    jsonNodeNoDtxrPos: posNodeText,
    matchType: authority === 'DTXR_POS_PRIMARY' ? 'POS/PS' : (authority === 'DTXR_PS_FALLBACK' ? 'PS' : 'none'),
    posBasis: text(ledgerRow.position) || positionLabel(seed.position),
    dtxrPosValue,
    dtxrPsName: text(ledgerRow.dtxrPsName) || stripIdentityPrefix(seed.nodeName || seed.componentRefNo) || NONE,
    dtxrPsValue,
    branchRelationship: text(ledgerRow.branchRelationship) || 'NONE',
    distanceMm: ledgerRow.distanceMm ?? '',
    toleranceMm: ledgerRow.toleranceMm ?? '',
    status,
    evidenceAuthority: authority,
    restraintSifBasis: authority,
    matchedPositionJsonNodes: Object.freeze(posNodes),
    matchedPositionJsonPaths: Object.freeze(positionPaths),
    identityJsonPath: psPath,
    identityJsonNodeNo: psNodeText,
    candidateCount: 1,
    diagnosticTypes: Object.freeze(['dtxr-resolution-ledger']),
    jsonNodeNo: psNodeText !== NONE ? psNodeText : posNodeText,
    position: text(ledgerRow.position) || positionLabel(seed.position),
    basis: authority,
    field: 'xml-node-decision',
    finalValue: dtxrPsValue === NONE ? '' : dtxrPsValue,
    oldValue: '',
    detail: text(ledgerRow.message) || (authority === 'DTXR_POS_PRIMARY'
      ? 'Authoritative DTXR ledger: positional group drives restraint/SIF and XML annotation.'
      : authority === 'DTXR_PS_FALLBACK'
        ? 'Authoritative DTXR ledger: PS/NAME fallback used because no positional group resolved.'
        : 'Authoritative DTXR ledger retained unresolved provenance.'),
  });
}

function buildDecision(seed, diagnosticRows, traceRows, options = {}) {
  const ledgerRow = diagnosticRows.find((row) => text(row.type) === 'dtxr-resolution-ledger');
  if (ledgerRow) return ledgerDecision(seed, ledgerRow, traceRows);

  const toleranceMm = Number.isFinite(Number(options.coordinateToleranceMm))
    ? Math.max(0, Number(options.coordinateToleranceMm))
    : 0.001;
  const posDiagnostic = diagnosticRows.find((row) => text(row.type) === 'dtxr-pos') || null;
  const psDiagnostic = diagnosticRows.find((row) => text(row.type) === 'dtxr-ps') || null;
  const supportDiagnostic = diagnosticRows.find((row) => text(row.type) === 'support-match') || null;
  const xmlPosition = seed.position || posDiagnostic?.position || supportDiagnostic?.position || '';
  const groups = branchPositionGroups(traceRows, seed.xmlBranch);
  const exact = exactPositionGroup(groups, xmlPosition, toleranceMm);
  const exactGroup = exact?.group || null;
  const positionPaths = exactGroup?.paths || [];
  const tags = unique([
    ...text(psDiagnostic?.tags).split('|'),
    ...(Array.isArray(supportDiagnostic?.tags)
      ? supportDiagnostic.tags
      : text(supportDiagnostic?.tags).split('|')),
  ]);
  const matchedKeys = unique([
    psDiagnostic?.matchedKey,
    supportDiagnostic?.matchedKey,
    posDiagnostic?.matchedKey,
  ]);
  const identityCandidates = candidateTraceRows(traceRows, {
    ...seed,
    tags,
    matchedKeys,
    positionPaths,
  });
  const exactIdentity = identityCandidates[0] || null;
  const pathIdentity = identityRowsAtPaths(traceRows, positionPaths)
    .map((row) => ({ row, path: componentPath(row.sourcePath || row.jsonPath) }))
    .find(({ row }) => {
      const keys = identityKeys(seed);
      const rowKeys = unique([rowValue(row), row.name]).map(identityKey).filter(Boolean);
      return keys.some((key) => rowKeys.includes(key));
    }) || null;
  const identity = pathIdentity || exactIdentity;
  const identityPath = identity?.path || '';
  const memberLeaf = exactGroup ? selectGroupMember(exactGroup, seed) : null;
  const descriptionRows = descriptionRowsAtPath(traceRows, identityPath);
  const candidateDescriptionRow = descriptionRows[0] || null;
  const supportLike = isSupportLike(seed.componentType, seed.nodeName);
  const psName = effectiveIdentityName(seed, identity?.row, memberLeaf);
  const fallbackDescription = rowValue(candidateDescriptionRow)
    || meaningfulDiagnosticValue(psDiagnostic?.finalValue)
    || meaningfulDiagnosticValue(supportDiagnostic?.finalValue)
    || '';
  const groupMemberValue = text(memberLeaf?.value)
    || rowValue(candidateDescriptionRow)
    || exactGroup?.rawDescriptions?.[0]
    || '';
  const psFallbackAllowed = !exactGroup && supportLike && Boolean(psName !== NONE && fallbackDescription);
  const matchType = exactGroup
    ? (psName !== NONE ? 'POS/PS' : 'POS')
    : (psFallbackAllowed ? 'PS' : 'none');
  const status = matchType === 'none' ? 'UNRESOLVED' : 'RESOLVED';
  const authority = exactGroup
    ? 'DTXR_POS_PRIMARY'
    : (psFallbackAllowed ? 'DTXR_PS_FALLBACK' : 'NONE');
  const positionNodeEvidence = exactGroup
    ? nodeRange(exactGroup.nodes)
    : nodeRange(descriptionRows.map(jsonNodeNo));
  let psNodeEvidence = jsonNodeNo(identity?.row);
  if (!exactGroup && !supportLike && candidateDescriptionRow) psNodeEvidence = jsonNodeNo(candidateDescriptionRow);
  if (!psNodeEvidence && exactGroup) psNodeEvidence = jsonNodeNo(memberLeaf) || exactGroup.nodes?.[0];
  const dtxrPosValue = exactGroup ? exactGroup.value : NONE;
  const dtxrPsValue = exactGroup
    ? (groupMemberValue || NONE)
    : (psFallbackAllowed ? fallbackDescription : NONE);
  return Object.freeze({
    schema: XML_CII_XML_NODE_TRACE_SCHEMA,
    xmlNode: seed.xmlNode || NONE,
    xmlBranch: seed.xmlBranch || NONE,
    componentType: seed.componentType || NONE,
    jsonNodeNoDtxrPs: psNodeEvidence || NONE,
    jsonNodeNoDtxrPos: positionNodeEvidence || NONE,
    matchType,
    posBasis: positionLabel(xmlPosition),
    dtxrPosValue,
    dtxrPsName: psName,
    dtxrPsValue,
    branchRelationship: branchRelationship(seed.xmlBranch, exactGroup?.stagedBranch || identity?.row?.branchName),
    distanceMm: Number.isFinite(exact?.distanceMm) ? Number(exact.distanceMm.toFixed(6)) : '',
    toleranceMm,
    status,
    evidenceAuthority: authority,
    restraintSifBasis: authority,
    matchedPositionJsonNodes: exactGroup ? exactGroup.nodes : [],
    matchedPositionJsonPaths: exactGroup ? exactGroup.paths : [],
    identityJsonPath: identityPath,
    identityJsonNodeNo: psNodeEvidence || NONE,
    candidateCount: identityCandidates.length,
    diagnosticTypes: unique(diagnosticRows.map((row) => row.type)),
    jsonNodeNo: psNodeEvidence || positionNodeEvidence || NONE,
    position: positionLabel(xmlPosition),
    basis: authority,
    field: 'xml-node-decision',
    finalValue: dtxrPsValue === NONE ? '' : dtxrPsValue,
    oldValue: '',
    detail: authority === 'DTXR_POS_PRIMARY'
      ? 'Restraint/SIF evidence selected from the matched positional group; PS/NAME retained independently.'
      : authority === 'DTXR_PS_FALLBACK'
        ? 'No positional group resolved; support identity fallback used.'
        : 'Candidate provenance retained without applying a restraint/SIF fact.',
  });
}

export function buildXmlNodeWiseTraceRows({
  xmlText = '',
  diagnostics = [],
  traceRows = [],
  options = {},
} = {}) {
  const xmlSeeds = extractXmlNodeTraceSeeds(xmlText);
  const combined = combineSeeds(xmlSeeds, diagnostics);
  return Object.freeze(combined.rows.map((seed) => buildDecision(
    seed,
    combined.groups.get(seedKey(seed)) || [],
    traceRows,
    options,
  )));
}

function csvCell(value) {
  const output = Array.isArray(value)
    ? value.join('|')
    : (value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''));
  return /[",\n\r]/.test(output) ? `"${output.replace(/"/g, '""')}"` : output;
}
function delimitedRows(rows, headers, delimiter = ',') {
  return [
    headers.map(([, label]) => csvCell(label)).join(delimiter),
    ...(rows || []).map((row) => headers.map(([key]) => csvCell(row?.[key])).join(delimiter)),
  ].join('\n');
}

export function xmlNodeWiseTraceToCsv(rows = []) {
  return delimitedRows(rows, XML_NODE_TRACE_HEADERS);
}
export function matchedFactsToClipboardText(rows = []) {
  return delimitedRows(
    (rows || []).filter((row) => row.status === 'RESOLVED'),
    XML_NODE_TRACE_HEADERS,
    '\t',
  );
}
export function buildEvidenceTreeCsvRows(traceRows = [], options = {}) {
  const tree = buildJsonTraceTree(traceRows, {
    rowLimit: 99999,
    groupLimit: 99999,
    useDelimiter: options.useDelimiter === true,
    delimiter: options.delimiter || '|',
    joinMode: options.joinMode || 'unique',
  });
  const rows = [];
  for (const branch of tree.branches || []) {
    for (const bore of branch.bores || []) {
      for (const bucket of bore.buckets || []) {
        for (const group of bucket.groups || []) {
          for (const leaf of group.rows || []) {
            rows.push({
              branchName: branch.branchName,
              bore: bore.boreKey,
              evidenceType: bucket.label,
              group: group.label,
              jsonNodeNo: leaf.jsonNodeNo,
              objectType: leaf.objectType,
              nodeNumber: leaf.nodeNumber,
              position: leaf.positionLabel,
              field: leaf.field,
              value: leaf.value,
              dtxrValue: leaf.dtxrValue,
              name: leaf.name,
              sourcePath: leaf.sourcePath,
              matchType: leaf.matchType,
              resolved: group.resolved ? 'YES' : 'NO',
            });
          }
        }
      }
    }
  }
  return rows;
}
export function evidenceTreeToCsv(traceRows = [], options = {}) {
  return delimitedRows(buildEvidenceTreeCsvRows(traceRows, options), EVIDENCE_TREE_HEADERS);
}

export const _test = Object.freeze({
  positionKey,
  positionLabel,
  branchPositionGroups,
  candidateTraceRows,
  nodeRange,
});
