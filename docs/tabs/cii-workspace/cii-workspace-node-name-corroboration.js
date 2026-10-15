import { deepFreeze } from './cii-workspace-contracts.js';

const SMART_FAMILY = /^(?:\/)?\s*(SL|PS)[\s._-]*(\d+)(?:\.\d+)?(?:\s*(?:\((?:REF|DATUM)\)|\/(?:REF|DATUM)))?\s*(?:\/)?$/i;

function raw(value) { return String(value ?? '').trim(); }
function upper(value) { return raw(value).toUpperCase(); }
function normalizeDigits(value) { return String(value || '').replace(/^0+(?=\d)/, '') || '0'; }

export function canonicalizeCiiNodeName(value) {
  const source = raw(value); if (!source) return null;
  const match = source.match(SMART_FAMILY); if (!match) return null;
  const family = String(match[1]).toUpperCase(); const number = normalizeDigits(match[2]);
  return deepFreeze({ raw: source, family, number, key: `${family}-${number}` });
}

export function compareCiiNodeNames(sourceValue, targetValue) {
  const sourceRaw = raw(sourceValue); const targetRaw = raw(targetValue);
  if (!sourceRaw || !targetRaw) return deepFreeze({ available: false, match: false, kind: 'UNAVAILABLE', matchRatio: null, sourceRaw, targetRaw, canonicalKey: null });
  if (upper(sourceRaw) === upper(targetRaw)) return deepFreeze({ available: true, match: true, kind: 'EXACT', matchRatio: 1, sourceRaw, targetRaw, canonicalKey: canonicalizeCiiNodeName(sourceRaw)?.key || null });
  const source = canonicalizeCiiNodeName(sourceRaw); const target = canonicalizeCiiNodeName(targetRaw);
  const match = Boolean(source && target && source.key === target.key);
  return deepFreeze({ available: true, match, kind: match ? 'CANONICAL' : 'NONE', matchRatio: match ? 1 : 0, sourceRaw, targetRaw, canonicalKey: match ? source.key : null });
}

function pairOrientation(sourceNames, targetNames, reverse) {
  const pairs = reverse
    ? [[sourceNames[0], targetNames[1]], [sourceNames[1], targetNames[0]]]
    : [[sourceNames[0], targetNames[0]], [sourceNames[1], targetNames[1]]];
  const evidence = pairs.map(([source, target]) => compareCiiNodeNames(source, target));
  const available = evidence.filter((item) => item.available).length;
  const matched = evidence.filter((item) => item.match).length;
  const exact = evidence.filter((item) => item.kind === 'EXACT').length;
  return { reverse, evidence, available, matched, exact, ratio: available ? matched / available : null };
}

export function compareCiiElementNodeNames(sourceEdge, targetEdge) {
  const sourceNames = [sourceEdge?.fromNodeName || '', sourceEdge?.toNodeName || ''];
  const targetNames = [targetEdge?.fromNodeName || '', targetEdge?.toNodeName || ''];
  const direct = pairOrientation(sourceNames, targetNames, false); const reverse = pairOrientation(sourceNames, targetNames, true);
  const winner = [direct, reverse].sort((a, b) => (b.matched - a.matched) || (b.exact - a.exact) || Number(a.reverse) - Number(b.reverse))[0];
  if (!winner.available) return deepFreeze({ available: false, match: false, kind: 'UNAVAILABLE', matchRatio: null, orientation: null, pairs: deepFreeze([]) });
  const kind = winner.matched === winner.available
    ? (winner.exact === winner.available ? 'EXACT' : 'CANONICAL')
    : (winner.matched ? 'PARTIAL' : 'NONE');
  return deepFreeze({
    available: true, match: winner.matched > 0, kind, matchRatio: Number((winner.ratio || 0).toFixed(3)),
    orientation: winner.reverse ? 'REVERSED' : 'DIRECT', matchedEndpointCount: winner.matched, availableEndpointCount: winner.available,
    pairs: deepFreeze(winner.evidence),
  });
}

export function ciiNodeNameUniqueKey(value) {
  const source = raw(value); if (!source) return null;
  return canonicalizeCiiNodeName(source)?.key || `RAW:${upper(source)}`;
}

export const _test = Object.freeze({ SMART_FAMILY });
