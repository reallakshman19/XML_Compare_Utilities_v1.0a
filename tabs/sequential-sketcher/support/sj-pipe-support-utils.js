// Copied from 3D_Converters@ffbbafbb1757a84826b736731a8d75c43a2c3e9c.
// Adapted to remove cross-repository resolver dependencies; owned hereafter by Sequential Sketcher.
export function cleanText(value) { return String(value ?? '').trim(); }

export function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function positiveNumber(value, fallback) {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : fallback;
}

export function nonNegativeNumber(value, fallback) {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? number : fallback;
}

export function firstText(attrs, keys) {
  for (const key of keys) {
    const value = cleanText(attrs?.[key]);
    if (value) return value;
  }
  return '';
}

export function sourceAttributes(record) {
  const attrs = record?.attrs || record?.attributes;
  return attrs && typeof attrs === 'object' && !Array.isArray(attrs) ? attrs : {};
}

export function sequenceIndexFromPath(path) {
  if (!Array.isArray(path)) return null;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const value = finiteNumber(path[index]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function cloneJson(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(cloneJson);
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, nested] of Object.entries(value)) out[key] = cloneJson(nested);
  return out;
}

export function clonePoint(point) {
  return point ? { x: Number(point.x), y: Number(point.y), z: Number(point.z) } : null;
}

export function isPoint(value) {
  return value
    && Number.isFinite(Number(value.x))
    && Number.isFinite(Number(value.y))
    && Number.isFinite(Number(value.z));
}

export function pointDistance(left, right) {
  if (!isPoint(left) || !isPoint(right)) return Number.POSITIVE_INFINITY;
  return Math.hypot(
    Number(right.x) - Number(left.x),
    Number(right.y) - Number(left.y),
    Number(right.z) - Number(left.z),
  );
}

/** Owned replacement for the converter-specific point resolver. */
export function parsePoint(value) {
  if (isPoint(value)) return clonePoint(value);
  if (Array.isArray(value) && value.length >= 3) {
    const [x, y, z] = value.map(Number);
    return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
  }
  const text = cleanText(value);
  if (!text) return null;
  const numbers = text.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/gu)?.map(Number) || [];
  return numbers.length >= 3 && numbers.slice(0, 3).every(Number.isFinite)
    ? { x: numbers[0], y: numbers[1], z: numbers[2] }
    : null;
}

/** Owned support-kind resolver; structural/contact semantics remain out of scope. */
export function classifySupportKind(attrs = {}) {
  const text = [
    attrs.SUPPORT_KIND, attrs.SUPPORT_MAPPER_KIND, attrs.SUPPORT_TYPE,
    attrs.CMPSUPTYPE, attrs.MDSSUPPTYPE, attrs.DTXR, attrs.NODETYPE,
  ].map(cleanText).join(' ').toUpperCase();
  if (/\bANCHOR\b|\bFIXED\b/u.test(text)) return 'ANCHOR';
  if (/\bSPRING\b|\bHANGER\b/u.test(text)) return 'SPRING';
  if (/LINE\s*STOP|LINESTOP|\bLS[-_ ]?\d*\b/u.test(text)) return 'LINESTOP';
  if (/\bGUIDE\b|\bGT[-_ ]?\d*\b/u.test(text)) return 'GUIDE';
  return 'REST';
}

export function round6(value) { return Math.round(Number(value) * 1e6) / 1e6; }
export function nullableRound6(value) { return Number.isFinite(value) ? round6(value) : null; }
export function nullableNumber(value, fallback) { return Number.isFinite(value) ? value : fallback; }
export function unique(values) { return [...new Set(values.filter(Boolean))]; }
