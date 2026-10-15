import { parseAppliesToDirective } from './navis-tag-applies-to.js';
import {
  candidateFinalBasis,
  nearestRejectedFinalBasis,
  resolvedFinalBasis,
  unmatchedFinalBasis,
} from './navis-tag-audit-remarks.js';
import { parseNavisTagXml } from './navis-tag-xml-parser.js';

export const UNMATCHED_NAVIS_TAG_LOCATION_MESSAGE = 'Refer Navis file to locate Tag';
export const ALTERNATE_MATCH_COLUMN = 'Ambiguous / Alternate Match';

export const DEFAULT_ISONOTE_KEYWORD_MAPPINGS = Object.freeze([
  Object.freeze({ key: 'R', value: 'REST' }),
  Object.freeze({ key: 'G', value: 'GUIDE' }),
  Object.freeze({ key: 'LS', value: 'LINE STOP' }),
]);

function text(value) { return String(value ?? '').trim(); }
function compact(value, digits = 3) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Number(number.toFixed(digits))) : '';
}
function finite(value, fallback = Number.POSITIVE_INFINITY) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function unique(values) {
  const seen = new Set();
  const output = [];
  for (const value of values || []) {
    const normalized = text(value);
    const key = normalized.toUpperCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}
function hasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }
function normalizedComment(value) { return baseTagText(value).toUpperCase().replace(/\s+/g, ' '); }
function appendSummary(current, addition) { return unique([current, addition]).join(' | '); }

export function keywordMappingRows(config = {}) {
  const source = hasOwn(config, 'isonoteKeywordMappings')
    ? config.isonoteKeywordMappings
    : DEFAULT_ISONOTE_KEYWORD_MAPPINGS;
  if (Array.isArray(source)) return source.map((item) => ({ key: text(item?.key), value: text(item?.value) }));
  if (source && typeof source === 'object') {
    return Object.entries(source).map(([key, value]) => ({ key: text(key), value: text(value) }));
  }
  return DEFAULT_ISONOTE_KEYWORD_MAPPINGS.map((item) => ({ ...item }));
}

export function keywordMap(config = {}) {
  const map = new Map();
  for (const row of keywordMappingRows(config)) {
    const key = text(row.key).toUpperCase();
    if (key) map.set(key, text(row.value) || key);
  }
  return map;
}

function baseTagText(value, config = {}) {
  const source = text(value);
  if (!source) return '';
  const directive = parseAppliesToDirective(source, config);
  const withoutDirective = directive.matched ? directive.note : source;
  return text(withoutDirective.replace(/\s*\(\s*Based\s+on\s+Tag\s+[^)]+\)\s*$/i, ''));
}

export function expandTagKeywords(value, config = {}) {
  const note = baseTagText(value, config);
  if (!note) return [];
  const mappings = keywordMap(config);
  const tokens = note.includes('+') ? note.split(/\s*\+\s*/) : note.split(/\s*,\s*/);
  return unique(tokens.map((token) => {
    const normalized = text(token);
    return mappings.get(normalized.toUpperCase()) || normalized;
  }));
}

function identityCandidates(decision = {}) {
  const raw = [
    ...(decision.groupedIdentities || []),
    ...(decision.tableIdentityRaw ? String(decision.tableIdentityRaw).split('|') : []),
    decision.canonicalIdentity,
  ];
  return unique(raw.map((value) => {
    const normalized = text(value).replace(/\s+/g, '');
    return normalized ? `/${normalized.replace(/^\/+/, '')}` : '';
  }));
}

export function selectOutputSupportIdentity(decision = {}) {
  const candidates = identityCandidates(decision);
  if (!candidates.length) return '';
  const datum = candidates.filter((value) => /\/DATUM$/i.test(value)).sort((a, b) => a.localeCompare(b))[0];
  if (datum) return datum;
  const numbered = candidates
    .map((value) => ({ value, suffix: Number(value.match(/\.(\d+)$/)?.[1]) }))
    .filter((item) => Number.isFinite(item.suffix))
    .sort((a, b) => a.suffix - b.suffix || a.value.localeCompare(b.value));
  return numbered[0]?.value || candidates[0];
}

function exactCandidateIdentity(candidate = {}) {
  const identity = text(candidate.canonicalIdentity).replace(/\s+/g, '');
  return identity ? `/${identity.replace(/^\/+/, '')}` : selectOutputSupportIdentity(candidate);
}

export function pointLabel(point) {
  if (![point?.x, point?.y, point?.z].every((value) => Number.isFinite(Number(value)))) return '';
  return `E=${compact(point.x)};N=${compact(point.y)};EL=${compact(point.z)}`;
}

function finalIsonote(identity, tags, config, confidence = '') {
  const expanded = unique(tags.flatMap((tag) => expandTagKeywords(tag, config)));
  if (!identity || !expanded.length) return '';
  const prefix = text(config?.isonoteOutputPrefix) || ':/';
  let isonote = `${prefix}${identity.replace(/^\/+/, '')} ${expanded.join(', ')}`;
  const confStr = text(confidence);
  if (confStr && !/\(C=[^)]+\)$/.test(isonote)) {
    const upper = confStr.toUpperCase();
    const code = upper.includes('HIGH') || upper.startsWith('H') ? 'H'
      : upper.includes('MEDIUM') || upper.startsWith('M') ? 'M'
        : upper.includes('LOW') || upper.startsWith('L') ? 'L' : confStr.charAt(0).toUpperCase();
    if (code) isonote += ` (C=${code})`;
  }
  return isonote;
}

function evidenceKey(record = {}) {
  const explicit = text(record.evidenceId || record.selectedEvidenceId || record.selectedCandidate?.evidenceId);
  if (explicit) return `EVIDENCE:${explicit}`;
  const tagId = text(record.tagId || record.selectedTagId);
  const viewGuid = text(record.viewGuid || record.selectedViewGuid || record.selectedCandidate?.viewGuid);
  const commentId = text(record.commentId || record.selectedCommentId || record.selectedCandidate?.commentId);
  return tagId || viewGuid || commentId ? `TAG:${viewGuid}|${tagId}|${commentId}` : '';
}

function addEvidence(record, keys, tagIds) {
  const key = evidenceKey(record);
  if (key) keys.add(key);
  const tagId = text(record.tagId || record.selectedTagId || record.selectedCandidate?.tagId);
  if (tagId) tagIds.add(tagId);
}

function directlyMatchedNavisEvidence(audit) {
  const keys = new Set();
  const tagIds = new Set();
  for (const decision of audit?.decisions || []) addEvidence(decision, keys, tagIds);
  for (const row of audit?.candidateLedger || []) {
    if (row.ledgerKind === 'ACCEPTED_CANDIDATE' && row.withinTolerance) addEvidence(row, keys, tagIds);
  }
  return { keys, tagIds };
}

function accountedNavisEvidence(audit) {
  const accounted = directlyMatchedNavisEvidence(audit);
  for (const row of audit?.candidateLedger || []) {
    if (row.ledgerKind === 'NEAREST_REJECTED') addEvidence(row, accounted.keys, accounted.tagIds);
  }
  for (const row of audit?.anchorLoopLedger || []) addEvidence(row, accounted.keys, accounted.tagIds);
  return accounted;
}

function candidateLedgerNavisParse(audit) {
  const tags = [];
  const seen = new Set();
  for (const row of [...(audit?.candidateLedger || []), ...(audit?.anchorLoopLedger || [])]) {
    const key = evidenceKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    tags.push({
      evidenceId: row.evidenceId, viewName: row.viewName, viewGuid: row.viewGuid,
      tagId: row.tagId, commentId: row.commentId, commentBody: row.commentBody,
      position: row.tagPosition, positionSource: row.positionSource,
    });
  }
  return { tags };
}

function browserNavisParse(config) {
  let navisText = '';
  try { navisText = String(globalThis.document?.querySelector?.('[data-nti-field="navisText"]')?.value || ''); } catch {}
  if (!navisText) {
    try { navisText = String(JSON.parse(globalThis.localStorage?.getItem?.('navisTagIsonote.session.v1') || '{}')?.navisText || ''); } catch {}
  }
  if (!navisText) return null;
  try { return parseNavisTagXml(navisText, config); } catch { return null; }
}

function navisParseForOutput(audit, config, explicitNavisParse) {
  if (Array.isArray(explicitNavisParse?.tags)) return explicitNavisParse;
  if (Array.isArray(audit?.navisTags)) return { tags: audit.navisTags };
  const browser = browserNavisParse(config);
  return Array.isArray(browser?.tags) ? browser : candidateLedgerNavisParse(audit);
}

function unmatchedNavisRows(audit, navisParse, config) {
  const accounted = accountedNavisEvidence(audit);
  const rows = [];
  for (const tag of navisParse?.tags || []) {
    const key = evidenceKey(tag);
    const tagId = text(tag.tagId);
    const isAccounted = Boolean((key && accounted.keys.has(key)) || (tagId && accounted.tagIds.has(tagId)));
    if (isAccounted) continue;
    rows.push({
      'Name of the element': UNMATCHED_NAVIS_TAG_LOCATION_MESSAGE,
      PIPE: '', POS: '', 'Navis Tag ID': tagId, 'Navis Tag POS': pointLabel(tag.position),
      Tag: baseTagText(tag.commentBody, config), 'Support ISONOTE': '', confidence: 'UNRESOLVED',
      'Anchor pair basis': '', [ALTERNATE_MATCH_COLUMN]: '', Basis: unmatchedFinalBasis(),
    });
  }
  return rows;
}

function propagationByTarget(audit) {
  const byTarget = new Map();
  for (const row of audit?.propagationLedger || []) {
    if (!row?.applied || !row.targetTableRowId) continue;
    if (!byTarget.has(row.targetTableRowId)) byTarget.set(row.targetTableRowId, []);
    byTarget.get(row.targetTableRowId).push(row);
  }
  return byTarget;
}

function sourceDecisionMaps(audit) {
  const byRow = new Map();
  const byTag = new Map();
  for (const decision of audit?.decisions || []) {
    byRow.set(decision.tableRowId, decision);
    if (decision.selectedTagId) byTag.set(String(decision.selectedTagId), decision);
  }
  return { byRow, byTag };
}

function directTag(decision, config) {
  return baseTagText(decision?.appliesToDirective?.note
    || decision?.directSupportIsonote
    || decision?.selectedCandidate?.commentBody
    || '', config);
}
function propagatedBaseTags(decision) {
  return unique((decision?.propagatedIsonotes || []).map((item) => item.baseIsonote || item.note));
}

function candidateRowsByTable(audit) {
  const byTable = new Map();
  for (const candidate of audit?.candidateLedger || []) {
    if (candidate.ledgerKind !== 'ACCEPTED_CANDIDATE' || !candidate.withinTolerance) continue;
    if (!byTable.has(candidate.tableRowId)) byTable.set(candidate.tableRowId, []);
    byTable.get(candidate.tableRowId).push(candidate);
  }
  for (const rows of byTable.values()) {
    rows.sort((left, right) => (Number(left.candidateRank) || Number.MAX_SAFE_INTEGER) - (Number(right.candidateRank) || Number.MAX_SAFE_INTEGER)
      || finite(right.score, Number.NEGATIVE_INFINITY) - finite(left.score, Number.NEGATIVE_INFINITY)
      || finite(left.normalizedGeometryRms) - finite(right.normalizedGeometryRms)
      || finite(left.spatialDistanceMm) - finite(right.spatialDistanceMm)
      || evidenceKey(left).localeCompare(evidenceKey(right)));
  }
  return byTable;
}

function nearestRejectedByTable(audit) {
  const byTable = new Map();
  for (const candidate of audit?.candidateLedger || []) {
    if (candidate.ledgerKind !== 'NEAREST_REJECTED') continue;
    const current = byTable.get(candidate.tableRowId);
    if (!current || finite(candidate.normalizedToleranceDistance) < finite(current.normalizedToleranceDistance)
      || (finite(candidate.normalizedToleranceDistance) === finite(current.normalizedToleranceDistance)
        && finite(candidate.spatialDistanceMm) < finite(current.spatialDistanceMm))) byTable.set(candidate.tableRowId, candidate);
  }
  return byTable;
}

function decisionCandidateFallback(decision = {}) {
  if (!decision.selectedTagId && !decision.selectedEvidenceId) return null;
  return {
    evidenceId: decision.selectedEvidenceId || '',
    viewGuid: decision.selectedViewGuid || '',
    viewName: decision.selectedViewName || '',
    tagId: decision.selectedTagId || '',
    commentId: decision.selectedCommentId || '',
    commentBody: decision.directSupportIsonote || decision.supportIsonote || decision.selectedCandidate?.commentBody || '',
    tagPosition: decision.selectedNavisPosition || null,
    anchorBasisLabel: decision.selectedAnchorBasis || '',
    anchorBasisId: decision.selectedAnchorBasisId || '',
    score: decision.confidenceScore,
    normalizedGeometryRms: decision.selectedCandidate?.normalizedGeometryRms,
    spatialDistanceMm: decision.selectedCandidate?.spatialDistanceMm,
    accepted: true,
    withinTolerance: true,
  };
}

function candidateAlternates(candidates, primary, config, decisionStatus) {
  if (!primary) return '';
  const primaryKey = evidenceKey(primary);
  const primaryComment = normalizedComment(primary.commentBody);
  const seen = new Set([primaryKey]);
  const summaries = [];
  for (const candidate of candidates || []) {
    const key = evidenceKey(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const candidateComment = normalizedComment(candidate.commentBody);
    const sameComment = Boolean(primaryComment && candidateComment && primaryComment === candidateComment);
    const score = compact(candidate.score, 6);
    const tagLabel = `Tag ${text(candidate.tagId) || 'unknown'}`;
    if (sameComment) summaries.push(`Alternate ${tagLabel} — same comment${score ? `; score ${score}` : ''}`);
    else summaries.push(`${decisionStatus === 'AMBIGUOUS' ? 'AMBIGUOUS' : 'AMBIGUOUS ALTERNATE'} — ${tagLabel}: ${baseTagText(candidate.commentBody, config) || '(blank comment)'}${score ? `; score ${score}` : ''}`);
  }
  return summaries.join(' | ');
}

function sourceAnchorBases(propagationRows, sources) {
  return unique((propagationRows || []).map((row) => {
    const source = sources.byRow.get(row.sourceTableRowId) || sources.byTag.get(String(row.sourceTagId));
    return source?.selectedAnchorBasis || source?.selectedCandidate?.anchorBasisLabel || '';
  }));
}

function projectionBasis(decision, candidate, nearest, propagationRows, config) {
  if (decision.status === 'AMBIGUOUS' && candidate) return candidateFinalBasis({
    ...candidate,
    decisionStatus: 'AMBIGUOUS',
    decisionReason: decision.decisionReason,
    topCandidateTagId: decision.topCandidateTagId || candidate.tagId,
    topCandidateScore: decision.topCandidateScore ?? candidate.score,
    runnerUpTagId: decision.runnerUpTagId,
    runnerUpScore: decision.runnerUpScore,
    scoreGap: decision.scoreGap,
    requiredScoreGap: decision.requiredScoreGap,
    candidateRank: candidate.candidateRank || 1,
  }, config);
  if (nearest && !candidate && !propagationRows.length) return nearestRejectedFinalBasis(nearest, config);
  return resolvedFinalBasis({ direct: Boolean(candidate && decision.status === 'RESOLVED'), decision, propagationRows });
}

function decisionProjections(audit, config) {
  const propagated = propagationByTarget(audit);
  const sources = sourceDecisionMaps(audit);
  const candidatesByTable = candidateRowsByTable(audit);
  const rejectedByTable = nearestRejectedByTable(audit);
  const projections = [];
  for (const decision of audit?.decisions || []) {
    const candidates = candidatesByTable.get(decision.tableRowId) || [];
    const selected = decision.selectedCandidate || candidates.find((candidate) => candidate.accepted) || decisionCandidateFallback(decision);
    const primary = selected || (decision.status === 'AMBIGUOUS' ? candidates[0] || null : null);
    const nearest = decision.nearestRejectedCandidate || rejectedByTable.get(decision.tableRowId) || null;
    const propagationRows = propagated.get(decision.tableRowId) || [];
    if (!primary && !nearest && !propagationRows.length) continue;

    const directText = primary ? baseTagText(primary.commentBody || directTag(decision, config), config) : '';
    const propagationTags = propagatedBaseTags(decision);
    const tags = unique([directText, ...propagationTags]);
    const tagIds = unique([primary?.tagId || '', ...propagationRows.map((row) => row.sourceTagId), ...(decision.propagatedFromTagIds || [])]);
    const navisPositions = [];
    if (primary?.tagPosition) navisPositions.push(pointLabel(primary.tagPosition));
    for (const row of propagationRows) navisPositions.push(pointLabel(row.sourcePosition));
    const confidence = [];
    if (decision.status === 'AMBIGUOUS') confidence.push('AMBIGUOUS');
    else if (primary && decision.confidence) confidence.push(decision.confidence);
    for (const row of propagationRows) {
      const source = sources.byRow.get(row.sourceTableRowId) || sources.byTag.get(String(row.sourceTagId));
      if (source?.confidence) confidence.push(source.confidence);
    }
    if (!primary && nearest && !propagationRows.length) confidence.push('OUTSIDE_TOLERANCE');

    const identity = selectOutputSupportIdentity(decision) || exactCandidateIdentity(nearest || primary || decision);
    const confidenceValue = unique(confidence).join('|') || (propagationRows.length ? 'PROPAGATED' : decision.confidence || 'UNRESOLVED');
    const anchorBases = unique([primary?.anchorBasisLabel || decision.selectedAnchorBasis || nearest?.anchorBasisLabel || '', ...sourceAnchorBases(propagationRows, sources)]);
    const isAmbiguous = decision.status === 'AMBIGUOUS';
    const rejectedOnly = Boolean(nearest && !primary && !propagationRows.length);
    const alternateSummary = candidateAlternates(candidates, primary, config, decision.status);
    const row = {
      'Name of the element': identity,
      PIPE: decision.resolvedPipe || decision.inputPipe || nearest?.resolvedPipe || nearest?.inputPipe || '',
      POS: pointLabel(decision.supportPosition || nearest?.supportPosition),
      'Navis Tag ID': tagIds.join('|') || text(nearest?.tagId),
      'Navis Tag POS': unique(navisPositions).join(' | ') || pointLabel(nearest?.tagPosition),
      Tag: tags.join(' | ') || baseTagText(nearest?.commentBody, config),
      'Support ISONOTE': isAmbiguous || rejectedOnly ? '' : finalIsonote(identity, tags, config, confidenceValue),
      confidence: confidenceValue,
      'Anchor pair basis': anchorBases.join(' | '),
      [ALTERNATE_MATCH_COLUMN]: alternateSummary,
      Basis: projectionBasis(decision, primary, nearest, propagationRows, config),
    };
    projections.push({
      row,
      order: projections.length,
      decision,
      primary,
      nearest,
      directKey: primary ? evidenceKey(primary) : '',
      score: finite(primary?.score ?? decision.confidenceScore, Number.NEGATIVE_INFINITY),
      normalizedGeometryRms: finite(primary?.normalizedGeometryRms),
      spatialDistanceMm: finite(primary?.spatialDistanceMm),
      hasPropagation: propagationRows.length > 0,
    });
  }
  return projections;
}

function ownerComparator(left, right) {
  return right.score - left.score
    || left.normalizedGeometryRms - right.normalizedGeometryRms
    || left.spatialDistanceMm - right.spatialDistanceMm
    || (right.decision.status === 'RESOLVED' ? 1 : 0) - (left.decision.status === 'RESOLVED' ? 1 : 0)
    || left.order - right.order;
}

function crossSupportSummary(retained, suppressed) {
  const tagId = text(retained.primary?.tagId || suppressed.primary?.tagId) || 'unknown';
  const retainedScore = Number.isFinite(retained.score) ? compact(retained.score, 6) : '';
  const suppressedScore = Number.isFinite(suppressed.score) ? compact(suppressed.score, 6) : '';
  return `AMBIGUOUS SUPPORT — Tag ${tagId} also matched ${suppressed.row['Name of the element']}${suppressedScore ? `; score ${suppressedScore}` : ''}. Retained ${retained.row['Name of the element']}${retainedScore ? `; score ${retainedScore}` : ''}`;
}

function consolidateDirectTagOwners(projections) {
  const groups = new Map();
  for (const projection of projections) {
    if (!projection.directKey || projection.hasPropagation) continue;
    if (!groups.has(projection.directKey)) groups.set(projection.directKey, []);
    groups.get(projection.directKey).push(projection);
  }
  const suppressed = new Set();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort(ownerComparator);
    const retained = group[0];
    for (const alternate of group.slice(1)) {
      suppressed.add(alternate);
      retained.row[ALTERNATE_MATCH_COLUMN] = appendSummary(retained.row[ALTERNATE_MATCH_COLUMN], crossSupportSummary(retained, alternate));
      if (alternate.row[ALTERNATE_MATCH_COLUMN]) {
        retained.row[ALTERNATE_MATCH_COLUMN] = appendSummary(retained.row[ALTERNATE_MATCH_COLUMN], `${alternate.row['Name of the element']}: ${alternate.row[ALTERNATE_MATCH_COLUMN]}`);
      }
    }
  }
  return projections.filter((projection) => !suppressed.has(projection)).sort((left, right) => left.order - right.order);
}

function candidateReviewRows(audit, config) {
  const rows = [];
  for (const candidate of audit?.candidateLedger || []) {
    if (candidate.ledgerKind !== 'ACCEPTED_CANDIDATE' || !candidate.withinTolerance || candidate.accepted) continue;
    rows.push({
      'Name of the element': exactCandidateIdentity(candidate),
      PIPE: candidate.resolvedPipe || candidate.inputPipe || '',
      POS: pointLabel(candidate.supportPosition),
      'Navis Tag ID': text(candidate.tagId),
      'Navis Tag POS': pointLabel(candidate.tagPosition),
      Tag: baseTagText(candidate.commentBody, config),
      'Support ISONOTE': '',
      confidence: candidate.decisionStatus === 'AMBIGUOUS' ? 'AMBIGUOUS' : 'NOT_SELECTED',
      'Anchor pair basis': candidate.anchorBasisLabel || '',
      [ALTERNATE_MATCH_COLUMN]: '',
      Basis: candidateFinalBasis(candidate, config),
    });
  }
  return rows;
}

function nearestRejectedRow(candidate, config) {
  return {
    'Name of the element': exactCandidateIdentity(candidate),
    PIPE: candidate.resolvedPipe || candidate.inputPipe || '',
    POS: pointLabel(candidate.supportPosition),
    'Navis Tag ID': text(candidate.tagId),
    'Navis Tag POS': pointLabel(candidate.tagPosition),
    Tag: baseTagText(candidate.commentBody, config),
    'Support ISONOTE': '',
    confidence: 'OUTSIDE_TOLERANCE',
    'Anchor pair basis': candidate.anchorBasisLabel || '',
    [ALTERNATE_MATCH_COLUMN]: '',
    Basis: nearestRejectedFinalBasis(candidate, config),
  };
}

function nearestRejectedRows(audit, config) {
  return [...nearestRejectedByTable(audit).values()].map((candidate) => nearestRejectedRow(candidate, config));
}

function representedProjectionEvidence(projections) {
  const keys = new Set();
  const tagIds = new Set();
  for (const projection of projections || []) {
    if (projection.primary) addEvidence(projection.primary, keys, tagIds);
    if (projection.nearest) addEvidence(projection.nearest, keys, tagIds);
    for (const tagId of String(projection.row?.['Navis Tag ID'] || '').split('|')) {
      const normalized = text(tagId);
      if (normalized) tagIds.add(normalized);
    }
  }
  return { keys, tagIds };
}

function nearestRejectedTagComparator(left, right) {
  return finite(left.normalizedToleranceDistance) - finite(right.normalizedToleranceDistance)
    || finite(left.spatialDistanceMm) - finite(right.spatialDistanceMm)
    || finite(right.score, Number.NEGATIVE_INFINITY) - finite(left.score, Number.NEGATIVE_INFINITY)
    || finite(left.tableRowIndex) - finite(right.tableRowIndex)
    || exactCandidateIdentity(left).localeCompare(exactCandidateIdentity(right));
}

function unrepresentedNearestRejectedRows(audit, config, represented = { keys: new Set(), tagIds: new Set() }) {
  const directlyMatched = directlyMatchedNavisEvidence(audit);
  const bestByTag = new Map();
  for (const candidate of audit?.candidateLedger || []) {
    if (candidate.ledgerKind !== 'NEAREST_REJECTED') continue;
    const key = evidenceKey(candidate);
    const tagId = text(candidate.tagId);
    if ((key && (represented.keys.has(key) || directlyMatched.keys.has(key)))
      || (tagId && (represented.tagIds.has(tagId) || directlyMatched.tagIds.has(tagId)))) continue;
    const groupKey = tagId ? `TAG_ID:${tagId}` : key;
    if (!groupKey) continue;
    const current = bestByTag.get(groupKey);
    if (!current || nearestRejectedTagComparator(candidate, current) < 0) bestByTag.set(groupKey, candidate);
  }
  return [...bestByTag.values()]
    .sort((left, right) => finite(left.tableRowIndex) - finite(right.tableRowIndex)
      || text(left.tagId).localeCompare(text(right.tagId)))
    .map((candidate) => nearestRejectedRow(candidate, config));
}

export function buildFinalOutputRows(audit, inputConfig = {}, navisParse = null) {
  const config = { ...inputConfig, ...(audit?.config || {}) };
  const parsed = navisParseForOutput(audit, config, navisParse);
  const retainedProjections = consolidateDirectTagOwners(decisionProjections(audit, config));
  const represented = representedProjectionEvidence(retainedProjections);
  const rejected = unrepresentedNearestRejectedRows(audit, config, represented);
  return [
    ...retainedProjections.map((projection) => projection.row),
    ...rejected,
    ...unmatchedNavisRows(audit, parsed, config),
  ];
}

export const _test = Object.freeze({
  baseTagText, finalIsonote, identityCandidates, evidenceKey,
  directlyMatchedNavisEvidence, accountedNavisEvidence, unmatchedNavisRows,
  candidateLedgerNavisParse, navisParseForOutput, candidateReviewRows,
  nearestRejectedRows, exactCandidateIdentity, sourceAnchorBases,
  candidateRowsByTable, candidateAlternates, decisionProjections,
  ownerComparator, consolidateDirectTagOwners, crossSupportSummary,
  representedProjectionEvidence, nearestRejectedTagComparator,
  unrepresentedNearestRejectedRows,
});
