import {
  canonicalizeXmlCiiBranch,
  compareXmlCiiBranches,
} from './canonical-branch-identity.js';

export const XML_CII_DTXR_LEDGER_SCHEMA = 'xml-cii-dtxr-resolution-ledger/v1';

const NONE = '(none)';

function text(value) { return String(value ?? '').trim(); }
function unique(values = []) { return [...new Set(values.map(text).filter(Boolean))]; }
function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function xmlLocalName(node) {
  return text(node?.localName || node?.nodeName).replace(/^.*:/, '');
}
function xmlChildrenByName(parent, name) {
  return [...(parent?.childNodes || [])]
    .filter((child) => child.nodeType === 1 && xmlLocalName(child) === name);
}
function xmlFirstChild(parent, name) {
  return xmlChildrenByName(parent, name)[0] || null;
}
function xmlText(parent, name) {
  return text(xmlFirstChild(parent, name)?.textContent);
}
function xmlSetText(document, parent, name, value) {
  const output = text(value);
  if (!document || !parent || !output || output === NONE) return false;
  let element = xmlFirstChild(parent, name);
  if (!element) {
    element = parent.namespaceURI
      ? document.createElementNS(parent.namespaceURI, name)
      : document.createElement(name);
    parent.appendChild(element);
  }
  const changed = text(element.textContent) !== output;
  element.textContent = output;
  return changed;
}
function xmlBranchName(node) {
  let current = node?.parentNode || null;
  while (current) {
    if (current.nodeType === 1 && xmlLocalName(current) === 'Branch') {
      return xmlText(current, 'Branchname');
    }
    current = current.parentNode || null;
  }
  return '';
}
function normalizePoint(value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value) && value.length >= 3) {
    const point = { x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) };
    return [point.x, point.y, point.z].every(Number.isFinite) ? point : null;
  }
  if (typeof value === 'object') {
    const point = {
      x: Number(value.x ?? value.X ?? value.e ?? value.E),
      y: Number(value.y ?? value.Y ?? value.n ?? value.N),
      z: Number(value.z ?? value.Z ?? value.el ?? value.EL),
    };
    return [point.x, point.y, point.z].every(Number.isFinite) ? point : null;
  }
  const values = text(value).match(/-?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?/g)?.slice(0, 3).map(Number) || [];
  return values.length === 3 && values.every(Number.isFinite)
    ? { x: values[0], y: values[1], z: values[2] }
    : null;
}
function distanceMm(left, right) {
  if (!left || !right) return Infinity;
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}
function pointLabel(point) {
  return point ? `E=${point.x} N=${point.y} EL=${point.z}` : NONE;
}
function normalizeIdentity(value) {
  return text(value)
    .replace(/^\s*=\s*/, '')
    .replace(/^\/+/, '')
    .replace(/[\s\-_/=]+/g, '')
    .toUpperCase();
}
function supportTagsFromNode(node) {
  const values = [xmlText(node, 'NodeName'), xmlText(node, 'ComponentRefNo')];
  for (const child of xmlChildrenByName(node, 'SupportTag')) values.push(text(child.textContent));
  return unique(values.flatMap((value) => (
    [...text(value).matchAll(/\/?PS-?\d+(?:\.\d+)?/ig)].map((match) => match[0])
  )));
}
function supportLike(node) {
  const type = xmlText(node, 'ComponentType').toUpperCase();
  const name = xmlText(node, 'NodeName');
  return /^(ATTA|ANCI|REST|RESTRAINT|SUPPORT)$/.test(type)
    || /^\/?PS-?\d/i.test(name);
}
function entryBranch(entry = {}) {
  return text(entry.branchName || entry.owner || entry.attrs?.OWNER || entry.component?.OWNER);
}
function entryPath(entry = {}) {
  return text(entry._path || entry.sourcePath || entry.jsonPath);
}
function entryName(entry = {}) {
  const attrs = entry.attrs || {};
  return text(
    attrs.NAME
    || attrs.REF
    || attrs.ComponentRefNo
    || attrs.COMPONENTREFNO
    || entry.component?.name
    || entry.component?.refNo,
  );
}
function entryDescription(entry = {}) {
  return text(
    entry.dtxrPos
    || entry.dtxr
    || entry.dtxrPs
    || entry.attrs?.DTXR_POS
    || entry.attrs?.DTXR
    || entry.attrs?.DESC
    || entry.attrs?.DESCRIPTION,
  );
}
function annotatedDescription(entry = {}) {
  const description = entryDescription(entry);
  const name = entryName(entry);
  if (!description) return '';
  if (!name || /\(\s*NAME\s*=/i.test(description)) return description;
  return `${description}(NAME=${name})`;
}
function entryIdentityKeys(entry = {}) {
  const attrs = entry.attrs || {};
  return unique([
    entryName(entry),
    attrs.ComponentRefNo,
    attrs.COMPONENTREFNO,
    attrs.REF,
    attrs.CMPSUPREFN,
    ...(entry.supportTags || []),
  ]).map(normalizeIdentity).filter(Boolean);
}
function nodeIdentityKeys(node) {
  return unique([
    xmlText(node, 'NodeName'),
    xmlText(node, 'ComponentRefNo'),
    ...supportTagsFromNode(node),
  ]).map(normalizeIdentity).filter(Boolean);
}
function identityScore(entry, node) {
  const wanted = nodeIdentityKeys(node);
  const available = entryIdentityKeys(entry);
  if (!wanted.length || !available.length) return 0;
  if (wanted.some((key) => available.includes(key))) return 100;
  if (wanted.some((key) => available.some((candidate) => (
    candidate.includes(key) || key.includes(candidate)
  )))) return 60;
  return 0;
}
function branchCandidate(entry, xmlBranch) {
  const relationship = compareXmlCiiBranches(xmlBranch, entryBranch(entry));
  return relationship.autoApply ? relationship : null;
}
function sourceTolerance(config = {}) {
  const explicit = finite(config.dtxrCoordinateToleranceMm, null);
  const offsetTolerance = finite(config.dtxrPositionOffset?.tolerance, null);
  const general = finite(config.coordinateTolerance, 1);
  return Math.max(...[explicit, offsetTolerance, general].filter(Number.isFinite), 0);
}
function candidatePositionEntries(index, node, config) {
  const point = normalizePoint(xmlText(node, 'Position'));
  if (!point) return [];
  const tolerance = sourceTolerance(config);
  const candidates = [];
  for (const entry of index?.entries || []) {
    const branch = branchCandidate(entry, xmlBranchName(node));
    if (!branch || !entry.point) continue;
    const distance = distanceMm(point, entry.point);
    if (distance > tolerance) continue;
    candidates.push({ entry, branch, distance });
  }
  return candidates.sort((left, right) => (
    left.distance - right.distance
    || right.branch.rank - left.branch.rank
    || entryPath(left.entry).localeCompare(entryPath(right.entry))
  ));
}
function selectedPositionGroup(candidates, config) {
  if (!candidates.length) return null;
  const selected = candidates[0];
  const tolerance = sourceTolerance(config);
  const entries = candidates
    .filter((candidate) => (
      candidate.branch.autoApply
      && distanceMm(candidate.entry.point, selected.entry.point) <= tolerance
    ))
    .map((candidate) => candidate.entry);
  return {
    entries,
    point: selected.entry.point,
    distance: selected.distance,
    relationship: selected.branch,
  };
}
function bestMember(entries, node) {
  let best = null;
  for (const entry of entries || []) {
    const score = identityScore(entry, node);
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry || null;
}
function candidatesFromMap(map, key) {
  if (!map || !text(key)) return [];
  const normalized = text(key).trim().replace(/\s+/g, '').replace(/^=/, '').toUpperCase();
  const direct = map.get(normalized);
  return Array.isArray(direct) ? direct : (direct ? [direct] : []);
}
function uniqueObjects(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
function fallbackIdentityEntry(index, node) {
  const xmlBranch = xmlBranchName(node);
  const candidates = [];
  const ref = xmlText(node, 'ComponentRefNo');
  candidates.push(...candidatesFromMap(index?.byComponentRefNo, ref));
  for (const tag of supportTagsFromNode(node)) {
    candidates.push(...candidatesFromMap(index?.byPsTag, tag));
    const base = tag.replace(/\.\d+$/, '');
    candidates.push(...candidatesFromMap(index?.byPsBaseTag, base));
  }
  let best = null;
  for (const entry of uniqueObjects(candidates)) {
    const branch = branchCandidate(entry, xmlBranch);
    if (!branch) continue;
    const score = identityScore(entry, node) + branch.rank;
    if (!best || score > best.score) best = { entry, branch, score };
  }
  return best;
}
function supportMatchesForNode(index, node, selectedPoint, config) {
  const xmlPoint = normalizePoint(xmlText(node, 'Position'));
  const target = selectedPoint || xmlPoint;
  if (!target) return [];
  const tolerance = sourceTolerance(config);
  return Object.freeze((index?.items || []).filter((entry) => (
    entry.point
    && branchCandidate(entry, xmlBranchName(node))
    && distanceMm(entry.point, target) <= tolerance
  )));
}
function nodeKey(node) {
  return [
    xmlBranchName(node),
    xmlText(node, 'NodeNumber'),
    xmlText(node, 'ComponentType'),
    xmlText(node, 'Position'),
  ].join('\u0001');
}
function freezeEntry(entry) {
  return Object.freeze({
    ...entry,
    dtxrPositionPaths: Object.freeze(entry.dtxrPositionPaths || []),
    dtxrPositionNames: Object.freeze(entry.dtxrPositionNames || []),
    supportMatches: Object.freeze(entry.supportMatches || []),
  });
}
function resolveNode(node, indexes, config) {
  const xmlBranch = xmlBranchName(node);
  const xmlPoint = normalizePoint(xmlText(node, 'Position'));
  const positionCandidates = candidatePositionEntries(indexes.positionIndex, node, config);
  const group = selectedPositionGroup(positionCandidates, config);
  const member = group ? bestMember(group.entries, node) : null;
  const fallback = fallbackIdentityEntry(indexes.refIndex, node);
  const fallbackAllowed = !group && supportLike(node) && Boolean(fallback?.entry);
  const dtxrPosValue = group
    ? unique(group.entries.map(annotatedDescription).filter(Boolean)).join(' | ')
    : '';
  const dtxrPsEntry = member || fallback?.entry || null;
  const dtxrPsValue = dtxrPsEntry ? entryDescription(dtxrPsEntry) : '';
  const authority = group
    ? 'DTXR_POS_PRIMARY'
    : (fallbackAllowed ? 'DTXR_PS_FALLBACK' : 'NONE');
  const relationship = group?.relationship || fallback?.branch || compareXmlCiiBranches(xmlBranch, '');
  const status = group || fallbackAllowed ? 'RESOLVED' : 'UNRESOLVED';
  return freezeEntry({
    schema: XML_CII_DTXR_LEDGER_SCHEMA,
    key: nodeKey(node),
    nodeElement: node,
    xmlNode: xmlText(node, 'NodeNumber'),
    xmlNodeName: xmlText(node, 'NodeName'),
    componentType: xmlText(node, 'ComponentType'),
    componentRefNo: xmlText(node, 'ComponentRefNo'),
    xmlBranch,
    xmlBranchIdentity: canonicalizeXmlCiiBranch(xmlBranch),
    xmlPosition: pointLabel(xmlPoint),
    branchRelationship: relationship.relationship,
    branchRank: relationship.rank,
    stagedBranch: group ? entryBranch(group.entries[0]) : entryBranch(fallback?.entry),
    distanceMm: group ? Number(group.distance.toFixed(6)) : '',
    toleranceMm: sourceTolerance(config),
    dtxrPosValue,
    dtxrPsName: xmlText(node, 'NodeName') || text(entryName(dtxrPsEntry)).replace(/^[/=]+/, ''),
    dtxrPsValue,
    dtxrSource: group ? 'staged-position-group' : (fallbackAllowed ? 'staged-ps-fallback' : ''),
    effectiveAuthority: authority,
    status,
    dtxrPositionPaths: group ? unique(group.entries.map(entryPath)) : [],
    dtxrPositionNames: group ? unique(group.entries.map(entryName)) : [],
    dtxrPsPath: entryPath(dtxrPsEntry),
    supportMatches: supportMatchesForNode(indexes.supportIndex, node, group?.point, config),
  });
}

export function buildXmlCiiDtxrResolutionLedger({
  document,
  stagedDtxrPositionIndex,
  stagedDtxrRefIndex,
  stagedSupportIndex,
  config = {},
} = {}) {
  const entries = [];
  const byNodeKey = new Map();
  if (document?.getElementsByTagName) {
    for (const node of [...document.getElementsByTagName('Node')]) {
      const entry = resolveNode(node, {
        positionIndex: stagedDtxrPositionIndex,
        refIndex: stagedDtxrRefIndex,
        supportIndex: stagedSupportIndex,
      }, config);
      entries.push(entry);
      byNodeKey.set(entry.key, entry);
    }
  }
  const summary = Object.freeze({
    total: entries.length,
    resolved: entries.filter((entry) => entry.status === 'RESOLVED').length,
    positionPrimary: entries.filter((entry) => entry.effectiveAuthority === 'DTXR_POS_PRIMARY').length,
    psFallback: entries.filter((entry) => entry.effectiveAuthority === 'DTXR_PS_FALLBACK').length,
    unresolved: entries.filter((entry) => entry.status !== 'RESOLVED').length,
  });
  return Object.freeze({
    schema: XML_CII_DTXR_LEDGER_SCHEMA,
    entries: Object.freeze(entries),
    byNodeKey,
    summary,
    entryForNode(node) { return byNodeKey.get(nodeKey(node)) || null; },
  });
}
export function applyXmlCiiDtxrResolutionLedger(document, ledger) {
  const stats = { dtxrPosAnnotations: 0, dtxrPsAnnotations: 0, dtxrSourceAnnotations: 0 };
  for (const entry of ledger?.entries || []) {
    const node = entry.nodeElement;
    if (!node || entry.status !== 'RESOLVED') continue;
    if (entry.dtxrPosValue && xmlSetText(document, node, 'DTXR_POS', entry.dtxrPosValue)) {
      stats.dtxrPosAnnotations += 1;
    }
    if (entry.dtxrPsValue && xmlSetText(document, node, 'DTXR_PS', entry.dtxrPsValue)) {
      stats.dtxrPsAnnotations += 1;
    }
    if (entry.dtxrSource && xmlSetText(document, node, 'DTXR_SOURCE', entry.dtxrSource)) {
      stats.dtxrSourceAnnotations += 1;
    }
    xmlSetText(document, node, 'DTXR_BRANCH_RELATIONSHIP', entry.branchRelationship);
  }
  return Object.freeze(stats);
}
export function xmlCiiDtxrLedgerDiagnostics(ledger) {
  return (ledger?.entries || []).map((entry) => ({
    type: 'dtxr-resolution-ledger',
    nodeNumber: entry.xmlNode,
    nodeName: entry.xmlNodeName,
    componentType: entry.componentType,
    branchName: entry.xmlBranch,
    stagedBranch: entry.stagedBranch,
    branchRelationship: entry.branchRelationship,
    branchRank: entry.branchRank,
    position: entry.xmlPosition,
    distanceMm: entry.distanceMm,
    toleranceMm: entry.toleranceMm,
    dtxrPosValue: entry.dtxrPosValue,
    dtxrPsName: entry.dtxrPsName,
    dtxrPsValue: entry.dtxrPsValue,
    sourcePath: entry.dtxrPsPath,
    positionPaths: entry.dtxrPositionPaths,
    effectiveAuthority: entry.effectiveAuthority,
    status: entry.status,
    message: entry.status === 'RESOLVED'
      ? `${entry.effectiveAuthority}: ${entry.dtxrSource}`
      : 'No compatible DTXR position group or support identity fallback resolved.',
  }));
}
export function xmlCiiDtxrLedgerEntryForNode(ledger, node) {
  return ledger?.entryForNode?.(node) || null;
}

export const _test = Object.freeze({
  normalizePoint,
  distanceMm,
  normalizeIdentity,
  annotatedDescription,
  nodeKey,
  resolveNode,
});
