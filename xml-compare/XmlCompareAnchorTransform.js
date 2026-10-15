// Manual base-anchor transform: a pure translation offset (offset = sourceCoord - targetCoord)
// added to every target node so the target frame re-bases onto the source frame before
// nearest-match, coordinate validation, and compare. No rotation/axis/sign in this phase.
export const XML_COMPARE_ANCHOR_TRANSFORM_SCHEMA = 'xml-compare-anchor-transform/v1';

const num = (value) => { const n = Number(value); return Number.isFinite(n) ? n : null; };

export function anchorPoint(record = {}) {
  const src = record?.position || record?.coordinate || record?.coOrds || record?.points?.[0] || record;
  const x = num(src?.x), y = num(src?.y), z = num(src?.z);
  return [x, y, z].every((value) => value != null) ? Object.freeze({ x, y, z }) : null;
}

export function offsetFromPoints(sourcePoint = null, targetPoint = null) {
  if (!sourcePoint || !targetPoint) return null;
  return Object.freeze({ x: sourcePoint.x - targetPoint.x, y: sourcePoint.y - targetPoint.y, z: sourcePoint.z - targetPoint.z });
}

export function createAnchorOffset({ sourceAnchor = null, targetAnchor = null } = {}) {
  return offsetFromPoints(anchorPoint(sourceAnchor), anchorPoint(targetAnchor));
}

export function applyAnchorOffset(point = null, offset = null) {
  if (!point || !offset) return point;
  return Object.freeze({ x: point.x + offset.x, y: point.y + offset.y, z: point.z + offset.z });
}

// Which coordinate axis (if any) a compare-field name maps to — e.g. globalX, FROM_GLOBAL_X, x -> 'x'.
// Deliberately conservative so ordinary fields (e.g. 'index', 'temperature1') never match.
export function coordinateAxisForField(field = '') {
  const f = String(field ?? '').trim().toLowerCase();
  if (!f) return null;
  if (/^[xyz]$/.test(f)) return f;
  const m = f.match(/(?:global|coord|_)([xyz])$/) || (/(?:global|coord)/.test(f) ? f.match(/([xyz])$/) : null);
  return m ? m[1] : null;
}

// Shift a coordinate field's value by the anchor offset; non-coordinate/blank values pass through unchanged.
export function alignedFieldValue(field = '', value = null, offset = null) {
  const axis = coordinateAxisForField(field);
  const n = num(value);
  if (!offset || !axis || n == null) return value;
  return n + offset[axis];
}

export const _test = Object.freeze({ num, anchorPoint, offsetFromPoints, createAnchorOffset, applyAnchorOffset, coordinateAxisForField, alignedFieldValue });
