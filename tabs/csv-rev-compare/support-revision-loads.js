export const SUPPORT_REV_LOAD_POLICY_V1 = Object.freeze({
  policyId: 'SUPPORT_REV_LOAD_POLICY_V1',
  version: '1.1.0',
  absoluteTolerance: 0.001,
  relativeTolerance: 1e-9,
});

const clean = (value) => String(value ?? '').trim();
const semanticRaw = (value) => {
  const raw = clean(value);
  return raw === '-' ? '' : raw;
};

export function normalizeLoadVector(loadNodes = []) {
  const slots = Object.freeze(loadNodes.map((node) => normalizeSlot(node)));
  const nonEmpty = slots.filter((slot) => semanticRaw(slot.raw) !== '').length;
  const numeric = slots.filter((slot) => semanticRaw(slot.raw) !== '' && slot.value != null).length;
  const state = nonEmpty === 0 ? 'EMPTY' : numeric === nonEmpty ? 'NUMERIC' : numeric === 0 ? 'SYMBOLIC' : 'MIXED';
  return Object.freeze({ state, slots });
}

function normalizeSlot(node = {}) {
  const raw = clean(node.raw ?? node.fields?.raw);
  const number = semanticRaw(raw) === '' ? Number.NaN : Number(raw);
  return Object.freeze({
    ordinal: Number(node.ordinal ?? node.fields?.ordinal ?? 0),
    columnOrdinal: Number(node.columnOrdinal ?? node.fields?.columnOrdinal ?? 0),
    columnId: clean(node.columnId ?? node.fields?.columnId),
    sourceHeader: clean(node.sourceHeader ?? node.fields?.sourceHeader),
    raw,
    value: Number.isFinite(number) ? number : null,
    sourceCellRef: clean(node.sourceCellRef ?? node.fields?.sourceCellRef),
  });
}

export function compareLoadVectors(beforeNodes, afterNodes, policy = SUPPORT_REV_LOAD_POLICY_V1) {
  const before = beforeNodes?.state ? beforeNodes : normalizeLoadVector(beforeNodes || []);
  const after = afterNodes?.state ? afterNodes : normalizeLoadVector(afterNodes || []);
  const deltas = loadDeltas(before, after, policy);
  if (before.state === 'EMPTY' && after.state === 'NUMERIC') return result('LOAD_BECAME_NUMERIC', before, after, deltas);
  if (before.state === 'NUMERIC' && after.state === 'NUMERIC') return result(deltas.some((item) => !item.equal) ? 'LOAD_SIGNATURE_CHANGED' : 'UNCHANGED', before, after, deltas);
  if (before.state !== after.state || rawSignature(before) !== rawSignature(after)) return result('LOAD_SIGNATURE_CHANGED', before, after, deltas);
  return result('UNCHANGED', before, after, Object.freeze([]));
}

function loadDeltas(before, after, policy) {
  const a = new Map(before.slots.map((slot) => [slotKey(slot), slot]));
  const b = new Map(after.slots.map((slot) => [slotKey(slot), slot]));
  return Object.freeze([...new Set([...a.keys(), ...b.keys()])].map((key) => compareSlot(key, a.get(key), b.get(key), policy)));
}
function compareSlot(key, before, after, policy) {
  const delta = before?.value != null && after?.value != null ? after.value - before.value : null;
  const scale = Math.max(Math.abs(before?.value || 0), Math.abs(after?.value || 0), 1);
  const tolerance = Math.max(policy.absoluteTolerance, scale * policy.relativeTolerance);
  const equal = delta != null ? Math.abs(delta) <= tolerance : semanticRaw(before?.raw) === semanticRaw(after?.raw);
  return Object.freeze({ slotKey: key, before: before || null, after: after || null, delta, tolerance, equal });
}
function slotKey(slot) {
  const columnId = clean(slot?.columnId);
  if (columnId) return `COLUMN:${columnId.toUpperCase()}`;
  const columnOrdinal = Number(slot?.columnOrdinal || 0);
  if (columnOrdinal > 0) return `ORDINAL:${columnOrdinal}:${clean(slot?.sourceHeader).toUpperCase()}`;
  return `${clean(slot?.sourceHeader).toUpperCase()}#${Number(slot?.ordinal || 0)}`;
}
function rawSignature(vector) { return vector.slots.map((slot) => `${slotKey(slot)}=${semanticRaw(slot.raw)}`).join('|'); }
function result(classification, before, after, deltas) { return Object.freeze({ classification, before, after, deltas }); }

export const _test = Object.freeze({ normalizeSlot, slotKey, rawSignature, loadDeltas, semanticRaw });
