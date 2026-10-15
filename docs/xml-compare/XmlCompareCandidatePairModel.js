// Manual-anchor candidate pairs (2.2/2.3): given a user-selected base anchor pair, for EACH source node
// find the nearest target node under the anchor translation transform, score text similarity, and flag
// validity (valid | review | conflict). No automatic anchor search — the anchor is user-chosen.
import { alignedFieldValue, anchorPoint, applyAnchorOffset, coordinateAxisForField, createAnchorOffset } from './XmlCompareAnchorTransform.js';
import { extractNumeric, extractToken, readFieldValue, textMatchPercent } from './XmlCompareFieldExtractor.js';

export const XML_COMPARE_CANDIDATE_PAIR_MODEL_SCHEMA = 'xml-compare-candidate-pair-model/v1';

const clean = (value) => String(value ?? '').trim();
const NUMERIC_FIELD_SAMPLE_LIMIT = 80;
function label(record = {}) {
  return clean(readFieldValue(record, 'displayName') || record.nodeName || record.nodeNumber || record.elementKey || record.uid);
}
function finiteNumber(value) { const text = clean(value); if (!text) return null; const n = Number(text); return Number.isFinite(n) ? n : null; }
function distance(a = null, b = null) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}
function byUid(records = []) {
  const map = new Map();
  for (const record of records || []) { const uid = clean(record.uid); if (uid && !map.has(uid)) map.set(uid, record); }
  return map;
}
// A physical node may appear as several role-split records (FROM of one element, TO of the next). Collapse
// them to one record per node so candidate pairing is per-node (and doesn't invent duplicate-target conflicts).
function physicalKey(record = {}) {
  return clean(record.stableKey) || (clean(record.nodeNumber) ? `${clean(record.lineNo || record.branchName)}::${clean(record.nodeNumber)}` : clean(record.uid));
}
function dedupeByNode(records = [], preferUids = new Set()) {
  const byKey = new Map();
  for (const record of records || []) {
    const key = physicalKey(record);
    if (!key) continue;
    if (!byKey.has(key) || preferUids.has(clean(record.uid))) byKey.set(key, record);
  }
  return [...byKey.values()];
}
function alignedTargets(targetRecords = [], offset = null) {
  return (targetRecords || []).map((record) => ({ record, point: applyAnchorOffset(anchorPoint(record), offset) })).filter((item) => item.point);
}
// Pipe size parsed from a line id like ".../FL-8&quot;-CS-..." -> "8".
function pipeSizeOf(record = {}) {
  const src = clean(readFieldValue(record, 'lineNo') || readFieldValue(record, 'branchName'));
  const m = src.match(/(\d+(?:\.\d+)?)\s*(?:&quot;|["”]|inch|in\b)/i);
  return m ? m[1] : '';
}
const CONNECTOR_DERIVERS = Object.freeze({ pipeSize: pipeSizeOf });
function connectorValue(record = {}, connector = {}) {
  const deriver = connector.derived && CONNECTOR_DERIVERS[connector.derived];
  return deriver ? deriver(record) : readFieldValue(record, connector.field);
}
// Hierarchical connector: an accepted parent correspondence {field, sourceValue, targetValue}. A node pair
// qualifies only when its source parent value == sourceValue AND its target parent value == targetValue.
// (The identifiers need NOT be equal to each other — the connector defines the acceptable mapping.)
function passesConnectors(record = {}, connectors = [], side = 'source') {
  return connectors.every((c) => clean(connectorValue(record, c)) === clean(side === 'source' ? c.sourceValue : c.targetValue));
}
// Detect the parent-level connectors available from an anchor pair (dynamic — only fields present on both).
const CONNECTOR_DEFS = Object.freeze([
  { field: 'lineNo', label: 'Line', reads: ['lineNo', 'branchName'] },
  { field: 'pipeSize', label: 'Pipe size', derived: 'pipeSize' },
  { field: 'pipingClass', label: 'Piping class', reads: ['pipingClass', 'PipingClass', 'PIPING_CLASS'] },
  { field: 'rating', label: 'Rating', reads: ['rating', 'Rating', 'RATING'] },
  // Same-level identity: not a scoping filter — enabling it switches matching to name basis (matches by name).
  { field: 'nodeName', label: 'Node name', reads: ['FROM_NAME', 'TO_NAME', 'nodeName', 'displayName', 'name'], sameLevel: true },
]);
const CONNECTOR_FIELD_SAMPLE_LIMIT = 200;
const CONNECTOR_BAG_KEYS = Object.freeze(['attributes', 'fields', 'compactFields', 'sourceAttributes', 'transferFields', 'rawSummary']);
const CONNECTOR_EXCLUDED_FIELDS = Object.freeze(new Set([
  'uid', 'id', 'key', 'stablekey', 'elementkey', 'recordkey', 'sourceuid', 'targetuid',
  'position', 'points', 'centrepoint', 'coords', 'coordinates', 'raw', 'diagnostics',
  'attributes', 'fields', 'compactfields', 'sourceattributes', 'transferfields', 'rawsummary',
  'displayname', 'name', 'nodename', 'nodenumber', 'fromnode', 'tonode',
  'globalx', 'globaly', 'globalz', 'x', 'y', 'z',
  'lineno', 'branchname', 'pipesize', 'pipingclass', 'rating',
]));
const normField = (field = '') => clean(field).replace(/[^a-z0-9]/gi, '').toLowerCase();
function titleLabel(field = '') {
  const text = clean(field).replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : clean(field);
}
function firstFieldValue(record, reads = []) { for (const f of reads) { const v = readFieldValue(record, f); if (clean(v)) return clean(v); } return ''; }
function connectorBags(record = {}) {
  return [record, ...CONNECTOR_BAG_KEYS.map((key) => record?.[key]), record?.raw, record?.raw?.attributes].filter((bag) => bag && typeof bag === 'object' && !Array.isArray(bag));
}
function connectorFieldNames(records = []) {
  const names = new Map();
  for (const record of (records || []).slice(0, CONNECTOR_FIELD_SAMPLE_LIMIT)) {
    for (const bag of connectorBags(record)) {
      for (const [field, value] of Object.entries(bag)) {
        const key = normField(field);
        if (!key || CONNECTOR_EXCLUDED_FIELDS.has(key) || value == null || typeof value === 'object') continue;
        if (!names.has(key)) names.set(key, clean(field));
      }
    }
  }
  return names;
}
function addConnector(out, seen, connector) {
  const key = normField(connector.field);
  if (!key || seen.has(key)) return;
  seen.add(key);
  out.push(Object.freeze(connector));
}
export function detectAnchorConnectors(sourceRecord = null, targetRecord = null, { sourceRecords = [], targetRecords = [] } = {}) {
  if (!sourceRecord || !targetRecord) return [];
  const out = [];
  const seen = new Set();
  for (const def of CONNECTOR_DEFS) {
    const sv = def.derived ? CONNECTOR_DERIVERS[def.derived](sourceRecord) : firstFieldValue(sourceRecord, def.reads);
    const tv = def.derived ? CONNECTOR_DERIVERS[def.derived](targetRecord) : firstFieldValue(targetRecord, def.reads);
    if (clean(sv) && clean(tv)) addConnector(out, seen, { field: def.field, label: def.label, derived: def.derived || null, sameLevel: Boolean(def.sameLevel), sourceValue: clean(sv), targetValue: clean(tv) });
  }
  const sourceFields = connectorFieldNames(sourceRecords.length ? sourceRecords : [sourceRecord]);
  const targetFields = connectorFieldNames(targetRecords.length ? targetRecords : [targetRecord]);
  for (const [key, field] of sourceFields) {
    if (!targetFields.has(key) || seen.has(key)) continue;
    const targetField = targetFields.get(key);
    const sv = readFieldValue(sourceRecord, field);
    const tv = readFieldValue(targetRecord, targetField);
    if (clean(sv) && clean(tv)) addConnector(out, seen, { field, label: titleLabel(field), derived: null, sameLevel: false, sourceValue: clean(sv), targetValue: clean(tv) });
  }
  return Object.freeze(out);
}
function nearest(sourcePoint, targets) {
  let best = null;
  for (const item of targets) {
    const deltaMm = distance(sourcePoint, item.point);
    if (!best || deltaMm < best.deltaMm) best = { record: item.record, deltaMm, point: item.point };
  }
  return best;
}
function axisDeltas(a = null, b = null) { return a && b ? { dx: b.x - a.x, dy: b.y - a.y, dz: b.z - a.z } : null; }
function perAxisTolerance(tolerance) {
  if (!tolerance) return null;
  const x = Number(tolerance.x), y = Number(tolerance.y), z = Number(tolerance.z);
  return [x, y, z].every((v) => Number.isFinite(v)) ? { x, y, z } : null;
}
function withinPerAxis(delta = null, tol = null) {
  return Boolean(delta && tol && Math.abs(delta.dx) <= tol.x && Math.abs(delta.dy) <= tol.y && Math.abs(delta.dz) <= tol.z);
}
function fieldHasNumber(records = [], field = '') {
  for (const record of (records || []).slice(0, NUMERIC_FIELD_SAMPLE_LIMIT)) if (finiteNumber(readFieldValue(record, field)) != null) return true;
  return false;
}
function numericCompareFields(sourceRecords = [], targetRecords = [], compareFields = []) {
  const out = [];
  for (const field of compareFields || []) {
    const key = clean(field);
    if (!key || out.includes(key)) continue;
    if (fieldHasNumber(sourceRecords, key) && fieldHasNumber(targetRecords, key)) out.push(key);
  }
  return Object.freeze(out);
}
function stringCompareFields(compareFields = [], numericFields = []) {
  const numeric = new Set((numericFields || []).map(clean));
  const out = [];
  for (const field of compareFields || []) {
    const key = clean(field);
    if (!key || numeric.has(key) || out.includes(key)) continue;
    out.push(key);
  }
  return Object.freeze(out);
}
function textMatchFor(source = {}, target = {}, field = 'displayName', textOptions = {}) {
  const sourceValue = readFieldValue(source, field);
  const targetValue = readFieldValue(target, field);
  return Object.freeze({ field, sourceValue: clean(sourceValue), targetValue: clean(targetValue), matchPct: textMatchPercent(sourceValue, targetValue, textOptions) });
}
function toleranceForNumericField(field = '', axisTol = null, toleranceMm = 6) {
  const axis = coordinateAxisForField(field);
  const value = axis && axisTol ? Number(axisTol[axis]) : Number(toleranceMm);
  return Number.isFinite(value) ? value : 0;
}
function numericFieldValue(record = {}, field = '', offset = null, side = 'source') {
  const raw = readFieldValue(record, field);
  const aligned = side === 'target' ? alignedFieldValue(field, raw, offset) : raw;
  return finiteNumber(aligned);
}
function fieldDeltasFor(source = {}, target = {}, fields = [], offset = null, axisTol = null, toleranceMm = 6) {
  return Object.freeze((fields || []).map((field) => {
    const sourceValue = numericFieldValue(source, field, null, 'source');
    const targetValue = numericFieldValue(target, field, offset, 'target');
    const tolerance = toleranceForNumericField(field, axisTol, toleranceMm);
    const missing = sourceValue == null || targetValue == null;
    const delta = missing ? null : targetValue - sourceValue;
    const absDelta = delta == null ? null : Math.abs(delta);
    return Object.freeze({ field, sourceValue, targetValue, delta, absDelta, tolerance, valid: absDelta != null && absDelta <= tolerance });
  }));
}
function fieldsWithinTolerance(fieldDeltas = [], fields = []) {
  return fields.length > 0 && fieldDeltas.length === fields.length && fieldDeltas.every((row) => row.valid);
}
function fieldToleranceSummary(fields = [], axisTol = null, toleranceMm = 6) {
  return Object.freeze((fields || []).map((field) => Object.freeze({ field, axis: coordinateAxisForField(field), tolerance: toleranceForNumericField(field, axisTol, toleranceMm) })));
}
function statusFor({ isAnchor, numericValid, matchPct, textMatchThreshold, hasTarget, mode }) {
  if (isAnchor) return 'valid';
  if (!hasTarget) return 'no-target';
  const textValid = matchPct >= textMatchThreshold;
  if (mode === 'numeric') return numericValid ? 'valid' : 'review';
  if (mode === 'text') return textValid ? 'valid' : 'review';
  return numericValid || textValid ? 'valid' : 'review';
}
function methodFor({ mode, numericField, numericFields = [], numericValid, matchPct, textMatchThreshold }) {
  if (mode === 'text') return 'text';
  if (mode === 'numeric') return numericField ? 'numeric-regex' : (numericFields.length ? 'numeric-fields' : 'coordinate');
  if (numericValid) return numericField ? 'numeric-regex' : (numericFields.length ? 'numeric-fields' : 'coordinate');
  if (matchPct >= textMatchThreshold) return 'text';
  return numericField ? 'numeric-regex' : (numericFields.length ? 'numeric-fields' : 'coordinate');
}
function sourcePointFor(record, numericField, numericOptions) {
  if (!numericField) return anchorPoint(record);
  const value = extractNumeric(record, numericField, numericOptions);
  return value == null ? null : Object.freeze({ x: value, y: 0, z: 0 });
}
// PS basis (AIM 2): the comparable node-name key, optionally the delimiter token at a 1-based position.
function nameKeyOf(record = {}, nameField = 'nodeName', nameDelimiter = '', namePosition = 0) {
  const raw = clean(readFieldValue(record, nameField) ?? record.nodeName ?? record.nodeNumber);
  if (!raw) return '';
  // Synthesized hierarchy labels ("Node 20") carry the node NUMBER, which is
  // not identity-stable across renumbered revisions — never match on them.
  if (nameField === 'nodeName' && /^Node\s/i.test(raw)) return '';
  const key = nameDelimiter && namePosition ? extractToken(raw, { delimiter: nameDelimiter, position: namePosition, stripLeadingSlash: false, stripTrailingBranch: false }) : raw;
  return clean(key).toUpperCase();
}
function pairRow(source, target, { deltaMm, delta = null, fieldDeltas = [], textComparison = null, matchPct, status, isAnchor, method, matchTextField = 'displayName' }) {
  const srcVal = clean(textComparison?.sourceValue) || clean(readFieldValue(source, matchTextField));
  const tgtVal = textComparison ? clean(textComparison.targetValue) : (target ? clean(readFieldValue(target, matchTextField)) : '');
  return {
    id: `candidate:${clean(source.uid)}=>${clean(target?.uid)}`,
    sourceUid: clean(source.uid), targetUid: clean(target?.uid),
    sourceStableKey: clean(source.stableKey || source.uid), targetStableKey: clean(target?.stableKey || target?.uid),
    sourceLabel: label(source), targetLabel: target ? label(target) : '',
    method, deltaMm: Number.isFinite(deltaMm) ? deltaMm : null,
    deltaX: delta ? delta.dx : null, deltaY: delta ? delta.dy : null, deltaZ: delta ? delta.dz : null,
    textField: clean(textComparison?.field) || matchTextField, textSourceValue: srcVal, textTargetValue: tgtVal,
    fieldDeltas: Object.freeze(fieldDeltas), matchPct, status, isAnchor,
  };
}

export function createXmlCompareCandidatePairs({
  sourceRecords = [], targetRecords = [], anchor = null, toleranceMm = 6, tolerance = null,
  textField = 'displayName', textMatchThreshold = 0.6, textOptions = {}, compareFields = [],
  numericField = null, numericOptions = {}, mode = 'both',
  basis = 'coordinate', nameField = 'nodeName', nameDelimiter = '', namePosition = 0,
  scopeToAnchorLine = true, matchDirection = 'source', parentConnectors = null,
  textOverrides = {}
} = {}) {
  const axisTol = perAxisTolerance(tolerance);
  const numericFields = numericCompareFields(sourceRecords, targetRecords, compareFields);
  const stringFields = stringCompareFields(compareFields, numericFields);
  const matchTextField = stringFields[0] || textField;
  const effectiveMode = mode === 'text' ? 'text' : (numericFields.length && basis !== 'name' ? 'numeric' : (mode === 'numeric' ? 'numeric' : 'both'));
  const anchorSource = anchor ? byUid(sourceRecords).get(clean(anchor.sourceUid)) : null;
  const anchorTarget = anchor ? byUid(targetRecords).get(clean(anchor.targetUid)) : null;
  const offset = createAnchorOffset({ sourceAnchor: anchorSource, targetAnchor: anchorTarget });
  // Hierarchical connectors scope the node match to accepted parent correspondences. When none are supplied
  // and scopeToAnchorLine is on, derive the default Line connector from the anchor's own lines (which are NOT
  // equal to each other — the anchor makes them an acceptable pair). Kills cross-line conflicts + O(N^2) cost.
  const connectors = Array.isArray(parentConnectors) && parentConnectors.length
    ? parentConnectors
    : (scopeToAnchorLine && anchorSource && anchorTarget
      ? [{ field: 'lineNo', sourceValue: clean(anchorSource.lineNo || anchorSource.branchName), targetValue: clean(anchorTarget.lineNo || anchorTarget.branchName) }].filter((c) => c.sourceValue && c.targetValue)
      : []);
  const scopedSource = connectors.length ? sourceRecords.filter((r) => passesConnectors(r, connectors, 'source')) : sourceRecords;
  const scopedTarget = connectors.length ? targetRecords.filter((r) => passesConnectors(r, connectors, 'target')) : targetRecords;
  const sourceNodes = dedupeByNode(scopedSource, new Set([clean(anchor?.sourceUid)]));
  const targetNodes = dedupeByNode(scopedTarget, new Set([clean(anchor?.targetUid)]));

  let rows;
  if (basis === 'name') {
    const targetByName = new Map();
    for (const record of targetNodes) { const key = nameKeyOf(record, nameField, nameDelimiter, namePosition); if (key && !targetByName.has(key)) targetByName.set(key, record); }
    rows = sourceNodes.map((source) => {
      const key = nameKeyOf(source, nameField, nameDelimiter, namePosition);
      const target = key ? targetByName.get(key) || null : null;
      const fieldDeltas = target ? fieldDeltasFor(source, target, numericFields, offset, axisTol, toleranceMm) : [];
      const candidateId = `candidate:${clean(source.uid)}=>${clean(target?.uid)}`;
      const overrideText = textOverrides[candidateId];
      let textComparison = null;
      if (target || overrideText !== undefined) {
        const compareTarget = overrideText !== undefined ? { ...(target || {}), [matchTextField]: overrideText } : target;
        textComparison = textMatchFor(source, compareTarget, matchTextField, textOptions);
      }
      const numericValid = fieldsWithinTolerance(fieldDeltas, numericFields);
      const matchPct = textComparison?.matchPct ?? (target ? 1 : 0);
      const status = statusFor({ isAnchor: false, numericValid, matchPct, textMatchThreshold, hasTarget: Boolean(target || overrideText !== undefined), mode: effectiveMode });
      return pairRow(source, target, { deltaMm: null, fieldDeltas, textComparison, matchPct, status, isAnchor: false, method: effectiveMode === 'text' ? 'text' : 'name', matchTextField });
    });
  } else {
    // Coordinate compare in the SOURCE frame: targets are transformed (+offset) then compared to sources.
    const sourcePts = sourceNodes.map((record) => ({ record, point: sourcePointFor(record, numericField, numericOptions) })).filter((item) => item.point);
    const targetPts = numericField
      ? targetNodes.map((record) => ({ record, point: sourcePointFor(record, numericField, numericOptions) })).filter((item) => item.point)
      : alignedTargets(targetNodes, offset);
    // target-driven (recommended for transfer): for each transformed target find the nearest source. Ensures
    // every target is considered (no orphan targets) instead of source-driven, which leaves targets unmatched.
    const targetDriven = matchDirection === 'target';
    const drive = targetDriven ? targetPts : sourcePts;
    const search = targetDriven ? sourcePts : targetPts;
    rows = drive.map(({ record: driver, point: drivePoint }) => {
      const isAnchor = Boolean(anchor && clean(driver.uid) === clean(targetDriven ? anchor.targetUid : anchor.sourceUid));
      const counterpart = targetDriven ? anchorSource : anchorTarget;
      const passing = axisTol ? search.filter((s) => withinPerAxis(axisDeltas(s.point, drivePoint), axisTol)) : [];
      const pool = axisTol && passing.length ? passing : search;
      const best = pool.length ? nearest(drivePoint, pool) : null;
      const matched = isAnchor && counterpart ? counterpart : (best ? best.record : null);
      const source = targetDriven ? matched : driver;
      const target = targetDriven ? driver : matched;
      const deltaMm = isAnchor ? 0 : (best ? best.deltaMm : Number.POSITIVE_INFINITY);
      const delta = isAnchor ? { dx: 0, dy: 0, dz: 0 } : (best ? axisDeltas(drivePoint, best.point) : null);
      const hasMatch = Boolean(source && target);
      const fieldDeltas = hasMatch ? fieldDeltasFor(source, target, numericFields, offset, axisTol, toleranceMm) : [];
      const candidateId = `candidate:${clean(source.uid)}=>${clean(target?.uid)}`;
      const overrideText = textOverrides[candidateId];
      let textComparison = null;
      if (hasMatch || overrideText !== undefined) {
        const compareTarget = overrideText !== undefined ? { ...(target || {}), [matchTextField]: overrideText } : target;
        textComparison = textMatchFor(source, compareTarget, matchTextField, textOptions);
      }
      const fieldNumericValid = numericFields.length ? fieldsWithinTolerance(fieldDeltas, numericFields) : null;
      const coordinateNumericValid = axisTol ? withinPerAxis(delta, axisTol) : (Number.isFinite(deltaMm) && deltaMm <= toleranceMm);
      const numericValid = isAnchor || (fieldNumericValid == null ? coordinateNumericValid : fieldNumericValid);
      const matchPct = textComparison?.matchPct ?? 0;
      const status = statusFor({ isAnchor, numericValid, matchPct, textMatchThreshold, hasTarget: Boolean(hasMatch || overrideText !== undefined), mode: effectiveMode });
      return pairRow(source || {}, target || null, { deltaMm, delta, fieldDeltas, textComparison, matchPct, status, isAnchor, method: methodFor({ mode: effectiveMode, numericField, numericFields, numericValid, matchPct, textMatchThreshold }), matchTextField });
    });
  }

  // Contested side is the one being searched: source-driven -> targets can't be double-claimed; target-driven
  // -> sources can't be double-claimed. Field-based numeric compare is an exception: validity is defined only
  // by the selected numeric fields and tolerances, so duplicate nearest targets must not overwrite that status.
  if (!(effectiveMode === 'numeric' && numericFields.length)) markConflicts(rows, basis !== 'name' && matchDirection === 'target' ? 'sourceUid' : 'targetUid');
  return Object.freeze({ schema: XML_COMPARE_CANDIDATE_PAIR_MODEL_SCHEMA, anchor: anchor || null, offset, basis, mode: effectiveMode, requestedMode: mode, matchDirection, toleranceMm, tolerance: axisTol, numericFields, stringFields, textField: matchTextField, numericCriteria: fieldToleranceSummary(numericFields, axisTol, toleranceMm), textMatchThreshold, scope: Object.freeze({ enabled: connectors.length > 0, connectors: Object.freeze(connectors), sourceLine: clean(connectors.find((c) => c.field === 'lineNo')?.sourceValue), targetLine: clean(connectors.find((c) => c.field === 'lineNo')?.targetValue), sourceNodeCount: sourceNodes.length, targetNodeCount: targetNodes.length }), pairs: Object.freeze(rows.map(Object.freeze)), summary: summarize(rows) });
}

// A target claimed by more than one non-anchor source is contested. For coordinate matching the NEAREST
// source wins (keeps its status) and the rest become conflict; for key/name matching (no distance) all
// claimants are conflict, since there is no nearest to break the tie.
function markConflicts(rows = [], claimKey = 'targetUid') {
  const byTarget = new Map();
  for (const row of rows) { const key = row[claimKey]; if (!key || row.isAnchor) continue; if (!byTarget.has(key)) byTarget.set(key, []); byTarget.get(key).push(row); }
  for (const group of byTarget.values()) {
    if (group.length <= 1) continue;
    if (group.every((row) => Number.isFinite(row.deltaMm))) {
      group.sort((a, b) => a.deltaMm - b.deltaMm);
      for (let i = 1; i < group.length; i += 1) group[i].status = 'conflict';
    } else {
      for (const row of group) row.status = 'conflict';
    }
  }
}
function summarize(rows = []) {
  const by = (status) => rows.filter((row) => row.status === status).length;
  return Object.freeze({ pairCount: rows.length, validCount: by('valid'), reviewCount: by('review'), conflictCount: by('conflict'), noTargetCount: by('no-target') });
}

export const _test = Object.freeze({ clean, label, finiteNumber, distance, nearest, statusFor, markConflicts, summarize, physicalKey, dedupeByNode, nameKeyOf, axisDeltas, withinPerAxis, perAxisTolerance, numericCompareFields, stringCompareFields, textMatchFor, fieldDeltasFor, fieldsWithinTolerance, toleranceForNumericField, passesConnectors, connectorFieldNames });
