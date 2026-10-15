const DEFAULT_DIAMETER_RATIO_TOL = 0.02;
const DEFAULT_ANCHOR_COORD_TOL = 0.03;

function text(value) { return value === undefined || value === null ? '' : String(value).trim(); }
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function unique(values) { return [...new Set((values || []).filter((value) => text(value)))]; }
function attrs(element) { return Array.from(element?.attributes || []); }
function children(element) { return Array.from(element?.children || []); }
function enabled(options, key, fallback = true) { return options?.[key] === undefined ? fallback : !!options[key]; }
function tokenise(value) {
  const raw = text(value).toUpperCase();
  if (!raw) return [];
  return raw
    .split(/[^A-Z0-9]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && /[A-Z]/.test(item));
}
function isNameKey(name) {
  const key = text(name).toUpperCase();
  if (!key) return false;
  if (/^(FROM_NODE|TO_NODE|DELTA_X|DELTA_Y|DELTA_Z|NUM|TYPE|COUNT|INDEX)$/.test(key)) return false;
  return /(NAME|NODE_NAME|COMP|COMPONENT|REF|REFERENCE|TAG|LINE|CLASS|RATING|ID|DESC|DESCRIPTION|MAT|MATERIAL)/.test(key);
}
function collectNameValues(element, depth = 0, out = []) {
  if (!element || depth > 2) return out;
  for (const attr of attrs(element)) if (isNameKey(attr.name)) out.push(attr.value);
  for (const child of children(element)) collectNameValues(child, depth + 1, out);
  return out;
}
function collectExactNameMap(element, depth = 0, out = new Map()) {
  if (!element || depth > 2) return out;
  for (const attr of attrs(element)) {
    const key = text(attr.name).toUpperCase();
    if (!/^(TAG|NAME|COMPONENT_REF|COMPONENT_REFERENCE|REF|REFERENCE)$/.test(key)) continue;
    const value = text(attr.value).toUpperCase();
    if (!value) continue;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(value);
  }
  for (const child of children(element)) collectExactNameMap(child, depth + 1, out);
  return out;
}
function exactNameConflict(refEdge, targetEdge) {
  const ref = collectExactNameMap(refEdge?.element);
  const target = collectExactNameMap(targetEdge?.element);
  for (const key of ['TAG', 'NAME', 'COMPONENT_REF', 'COMPONENT_REFERENCE', 'REF', 'REFERENCE']) {
    const a = unique(ref.get(key) || []);
    const b = unique(target.get(key) || []);
    if (!a.length || !b.length) continue;
    if (a.some((value) => b.includes(value))) continue;
    return `${key}_MISMATCH`;
  }
  return '';
}
export function edgeNameTokens(edge) {
  if (edge?.nameTokens?.length) return edge.nameTokens;
  const tokens = unique(collectNameValues(edge?.element).flatMap(tokenise)).sort();
  edge.nameTokens = tokens;
  return tokens;
}
export function diameterRatioEvidence(refEdge, targetEdge, options = {}) {
  if (!enabled(options, 'useDiameterRatioEvidence', true)) return { score: 50, ratio: '', status: 'DIAMETER_RATIO_DISABLED' };
  const ref = finite(refEdge?.diameter);
  const target = finite(targetEdge?.diameter);
  if (!(ref > 0) || !(target > 0)) return { score: 50, ratio: '', status: 'NO_DIAMETER' };
  const ratio = Math.min(ref, target) / Math.max(ref, target);
  const tolerance = Number(options.diameterRatioTolerance || DEFAULT_DIAMETER_RATIO_TOL);
  const score = Math.max(0, Math.min(100, 100 * (ratio - (1 - tolerance * 6)) / Math.max(tolerance * 6, 0.0001)));
  const status = ratio >= 1 - tolerance ? 'DIAMETER_RATIO_OK' : ratio >= 1 - tolerance * 3 ? 'DIAMETER_RATIO_WARN' : 'DIAMETER_RATIO_CONFLICT';
  return { score, ratio: Number(ratio.toFixed(6)), status };
}
export function nameEvidence(refEdge, targetEdge, options = {}) {
  if (!enabled(options, 'useNameEvidence', true)) return { score: 50, common: '', status: 'NAME_EVIDENCE_DISABLED', refTokens: '', targetTokens: '' };
  const refTokens = edgeNameTokens(refEdge);
  const targetTokens = edgeNameTokens(targetEdge);
  if (!refTokens.length || !targetTokens.length) return { score: 50, common: '', status: 'NO_NAME_EVIDENCE', refTokens: refTokens.join(';'), targetTokens: targetTokens.join(';') };
  const targetSet = new Set(targetTokens);
  const common = refTokens.filter((token) => targetSet.has(token));
  const score = 100 * common.length / Math.max(refTokens.length, targetTokens.length, 1);
  const exactConflict = exactNameConflict(refEdge, targetEdge);
  const status = exactConflict || !common.length ? 'NAME_EVIDENCE_CONFLICT' : 'NAME_EVIDENCE_MATCH';
  return { score, common: common.join(';'), status, refTokens: refTokens.join(';'), targetTokens: targetTokens.join(';'), exactConflict };
}
function vec(edge, key) { return edge?.[key] || { x: 0, y: 0, z: 0 }; }
function mag(v) { return Math.hypot(Number(v?.x || 0), Number(v?.y || 0), Number(v?.z || 0)); }
function sub(a, b) { return { x: Number(a?.x || 0) - Number(b?.x || 0), y: Number(a?.y || 0) - Number(b?.y || 0), z: Number(a?.z || 0) - Number(b?.z || 0) }; }
function normalizedMid(edge) {
  const mid = vec(edge, 'pathMidCoord');
  const span = Math.max(Number(edge?.pathTotalVectorLengthMm || 0), Number(edge?.componentLengthMm || 0), Number(edge?.pathStationEndMm || 0), 1);
  return { x: Number(mid.x || 0) / span, y: Number(mid.y || 0) / span, z: Number(mid.z || 0) / span };
}
export function anchorCoordinateEvidence(refEdge, targetEdge, options = {}) {
  if (!enabled(options, 'useAnchorCoordinateEvidence', true)) return { score: 50, distance: '', status: 'ANCHOR_COORD_DISABLED' };
  if (!refEdge?.isAnchorElement && !targetEdge?.isAnchorElement) return { score: 50, distance: '', status: 'NO_ANCHOR_COORD_EVIDENCE' };
  const ref = normalizedMid(refEdge);
  const target = normalizedMid(targetEdge);
  const distance = mag(sub(ref, target));
  const tol = Number(options.anchorCoordinateTolerance || DEFAULT_ANCHOR_COORD_TOL);
  const score = Math.max(0, Math.min(100, 100 * (1 - distance / Math.max(tol * 4, 0.0001))));
  const status = distance <= tol ? 'ANCHOR_COORD_OK' : distance <= tol * 3 ? 'ANCHOR_COORD_WARN' : 'ANCHOR_COORD_CONFLICT';
  return { score, distance: Number(distance.toFixed(6)), status };
}
export function supplementalEvidence(refEdge, targetEdge, options = {}) {
  const diameter = diameterRatioEvidence(refEdge, targetEdge, options);
  const name = nameEvidence(refEdge, targetEdge, options);
  const anchorCoord = anchorCoordinateEvidence(refEdge, targetEdge, options);
  const conflictFlags = [diameter, name, anchorCoord].filter((item) => /CONFLICT$/.test(item.status)).map((item) => item.status);
  const score = Math.max(0, Math.min(100,
    diameter.score * 0.45 +
    name.score * 0.25 +
    anchorCoord.score * 0.30
  ));
  return {
    score: Number(score.toFixed(1)),
    diameterRatio: diameter.ratio,
    diameterStatus: diameter.status,
    nameStatus: name.status,
    nameCommon: name.common,
    refNameTokens: name.refTokens,
    targetNameTokens: name.targetTokens,
    anchorCoordDistance: anchorCoord.distance,
    anchorCoordStatus: anchorCoord.status,
    conflictFlags,
  };
}
export function tightenedConfidence(baseConfidence, evidence, options = {}) {
  if (!evidence) return baseConfidence;
  if (enabled(options, 'downgradeOnSupplementalConflict', false) && (evidence.conflictFlags || []).length) return baseConfidence === 'HIGH' ? 'MEDIUM' : baseConfidence === 'MEDIUM' ? 'LOW' : baseConfidence;
  if (enabled(options, 'upgradeWithCleanSupplementalEvidence', false) && baseConfidence === 'MEDIUM' && !(evidence.conflictFlags || []).length && Number(evidence.score || 0) >= 80) return 'HIGH';
  return baseConfidence;
}
