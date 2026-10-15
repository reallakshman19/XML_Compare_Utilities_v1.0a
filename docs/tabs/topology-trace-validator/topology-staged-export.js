/**
 * Staged JSON export: the loaded staged hierarchy with the draft's geometry
 * mutations and attribute ledger applied. The primary engineering interchange
 * document preserves the source root shape exactly: a bare hierarchy remains a
 * bare array, and an existing hierarchy/branches/objects envelope retains its
 * original keys. Audit provenance is returned separately and must never change
 * the staged hierarchy contract consumed by 3D Converters and other modules.
 *
 * Geometry mapping is a deterministic position remap derived from the
 * command payloads themselves (MOVE_NODE / MERGE_NODES / TRIM_EDGE move
 * existing nodes; other commands create or remove elements and are recorded
 * in provenance only). Staged coordinates are rewritten only when they match
 * the moved node's original position at coordinate-identity precision. A
 * topology snap tolerance must never be used as an identity tolerance because
 * nearby but distinct source ports may otherwise be moved and merged.
 *
 * A topology-edited support has three independent authorities: its current node
 * position, the immutable source point used for carrier projection, and the
 * exact canonical carrier source path. When a support coordinate is remapped,
 * the latter two are retained as explicit staged evidence so a conforming
 * consumer cannot switch to a nearer adjacent component at a moved junction.
 */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { applyAttributeLedgerToStaged } from './topology-attribute-edit-ledger.js';
import { isIsoTimestamp } from '../../contracts/contract-values.js';

const COORD_FIELDS = Object.freeze(['APOS', 'LPOS', 'POS', 'BPOS', 'HPOS', 'TPOS']);
const SUPPORT_TYPES = Object.freeze(new Set(['ATTA', 'SUPPORT', 'ANCI']));
export const TOPOLOGY_SOURCE_POSITION_FIELD = 'TOPOLOGY_SOURCE_POSITION';
export const TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD = 'TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH';
export const STAGED_POSITION_IDENTITY_TOLERANCE_MM = 1e-6;

const xyz = (value) => {
  const record = objectRecord(value);
  const coords = [Number(record.x), Number(record.y), Number(record.z)];
  return coords.every(Number.isFinite) ? coords : null;
};
const point = (coords) => ({ x: coords[0], y: coords[1], z: coords[2] });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function buildPositionRemaps(baseCanonical, draft) {
  const positions = new Map(asArray(baseCanonical.nodes).map(objectRecord)
    .map((node) => [cleanText(node.id), xyz(node.position)]));
  const original = new Map(positions);
  const applyOperation = (operation) => {
    const record = objectRecord(operation);
    const payload = objectRecord(record.payload);
    const type = cleanText(record.type);
    if (type === 'TRANSACTION') { asArray(payload.operations).forEach(applyOperation); return; }
    if (type === 'MOVE_NODE' || type === 'TRIM_EDGE') {
      const nodeId = cleanText(payload.nodeId);
      const next = xyz(payload.position);
      if (positions.has(nodeId) && next) positions.set(nodeId, next);
    } else if (type === 'MERGE_NODES') {
      const source = cleanText(payload.sourceNodeId), target = cleanText(payload.targetNodeId);
      if (positions.has(source) && positions.get(target)) positions.set(source, positions.get(target));
    }
  };
  asArray(draft?.commands).forEach(applyOperation);
  const remaps = [];
  for (const [nodeId, current] of positions) {
    const base = original.get(nodeId);
    if (base && current && dist(base, current) > STAGED_POSITION_IDENTITY_TOLERANCE_MM) remaps.push({ nodeId, from: base, to: current });
  }
  return Object.freeze(remaps);
}

function positionIdentityTolerance(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return STAGED_POSITION_IDENTITY_TOLERANCE_MM;
  if (parsed > 1e-4) throw new RangeError('Staged position identity tolerance must not exceed 0.0001 mm.');
  return parsed;
}

function isSupportOwner(owner, attributes) {
  const type = cleanText(owner?.type ?? attributes?.TYPE).toUpperCase();
  return SUPPORT_TYPES.has(type);
}

function buildSupportEvidenceBySourcePath(baseCanonical) {
  const evidence = new Map();
  for (const supportValue of asArray(baseCanonical?.supports)) {
    const support = objectRecord(supportValue);
    const sourcePosition = xyz(support.sourcePosition);
    const carrierPath = cleanText(support.attachmentEdgeSourcePath);
    if (!sourcePosition || !carrierPath) continue;
    for (const sourcePathValue of asArray(support.sourcePaths)) {
      const sourcePath = cleanText(sourcePathValue);
      if (!sourcePath) continue;
      const next = Object.freeze({ sourcePosition, carrierPath, supportId: cleanText(support.id), tag: cleanText(support.tag) });
      const current = evidence.get(sourcePath);
      if (current && (dist(current.sourcePosition, sourcePosition) > STAGED_POSITION_IDENTITY_TOLERANCE_MM || current.carrierPath !== carrierPath)) {
        throw new Error(`Support source path ${sourcePath} resolves to conflicting canonical support evidence.`);
      }
      evidence.set(sourcePath, next);
    }
  }
  return evidence;
}

function validateExistingSupportEvidence(owner, attributes, canonical, identityToleranceMm) {
  const label = cleanText(owner?.name ?? attributes.NAME) || canonical.tag || canonical.supportId || '(unnamed)';
  if (Object.hasOwn(attributes, TOPOLOGY_SOURCE_POSITION_FIELD)) {
    const existing = xyz(attributes[TOPOLOGY_SOURCE_POSITION_FIELD]);
    if (!existing || dist(existing, canonical.sourcePosition) > identityToleranceMm) {
      throw new TypeError(`Support ${label} has invalid or conflicting ${TOPOLOGY_SOURCE_POSITION_FIELD} evidence.`);
    }
  }
  if (Object.hasOwn(attributes, TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD)) {
    const existing = cleanText(attributes[TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD]);
    if (!existing || existing !== canonical.carrierPath) {
      throw new TypeError(`Support ${label} has invalid or conflicting ${TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD} evidence.`);
    }
  }
}

function preserveSupportProjectionEvidence(owner, ownerPath, attributes, supportEvidence, stats, identityToleranceMm) {
  if (!isSupportOwner(owner, attributes)) return;
  const canonical = supportEvidence.get(ownerPath);
  const label = cleanText(owner?.name ?? attributes.NAME) || ownerPath;
  if (!canonical) {
    throw new Error(`Remapped support ${label} has no canonical carrier evidence for source path ${ownerPath}.`);
  }
  validateExistingSupportEvidence(owner, attributes, canonical, identityToleranceMm);
  const hadSource = Object.hasOwn(attributes, TOPOLOGY_SOURCE_POSITION_FIELD);
  const hadCarrier = Object.hasOwn(attributes, TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD);
  if (hadSource !== hadCarrier) {
    throw new TypeError(
      `Support ${label} requires both ${TOPOLOGY_SOURCE_POSITION_FIELD} and ${TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD}.`,
    );
  }
  if (!hadSource) {
    attributes[TOPOLOGY_SOURCE_POSITION_FIELD] = point(canonical.sourcePosition);
    attributes[TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD] = canonical.carrierPath;
    stats.supportProjectionEvidencePreserved += 1;
  }
}

function remapDocumentPositions(
  doc,
  remaps,
  identityToleranceMm,
  supportEvidence = new Map(),
  stats = { supportProjectionEvidencePreserved: 0 },
) {
  if (!remaps.length) return 0;
  let touched = 0;
  const branches = Array.isArray(doc) ? doc : (doc.hierarchy ?? doc.branches ?? doc.objects ?? []);
  const rewrite = (owner, ownerPath) => {
    const attributes = owner?.attributes;
    for (const field of COORD_FIELDS) {
      const coords = attributes && xyz(attributes[field]);
      if (!coords) continue;
      for (const remap of remaps) {
        if (dist(coords, remap.from) <= identityToleranceMm) {
          preserveSupportProjectionEvidence(owner, ownerPath, attributes, supportEvidence, stats, identityToleranceMm);
          attributes[field] = point(remap.to);
          touched += 1;
          break;
        }
      }
    }
  };
  branches.forEach((branch, branchIndex) => {
    const branchPath = `$[${branchIndex}]`;
    rewrite(branch, branchPath);
    const children = Array.isArray(branch?.children) ? branch.children : [];
    children.forEach((child, childIndex) => rewrite(child, `${branchPath}.children[${childIndex}]`));
  });
  return touched;
}

export function buildStagedExport(input) {
  if (!isIsoTimestamp(input.exportedAt)) throw new TypeError('Staged export requires an exact ISO exportedAt timestamp.');
  const identityToleranceMm = positionIdentityTolerance(input.positionIdentityToleranceMm);
  const withAttributes = applyAttributeLedgerToStaged(input.baseStagedJson, input.attributeLedger);
  const remaps = buildPositionRemaps(input.baseCanonical, input.draft);
  const supportEvidence = buildSupportEvidenceBySourcePath(input.baseCanonical);
  const remapStats = { supportProjectionEvidencePreserved: 0 };
  const coordinatesTouched = remapDocumentPositions(
    withAttributes,
    remaps,
    identityToleranceMm,
    supportEvidence,
    remapStats,
  );
  const provenance = {
    schema: 'StagedEditProvenance.v1',
    exportedAt: input.exportedAt,
    baseCanonicalTopologyHash: cleanText(objectRecord(input.draft).baseCanonicalTopologyHash),
    topologyEditDraftHash: cleanText(objectRecord(input.draft).topologyEditDraftHash),
    editedCanonicalTopologyHash: cleanText(input.editedCanonicalHash),
    positionIdentityToleranceMm: identityToleranceMm,
    positionRemaps: remaps,
    supportSourcePositionField: TOPOLOGY_SOURCE_POSITION_FIELD,
    supportCarrierAuthorityField: TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD,
    supportProjectionEvidencePreserved: remapStats.supportProjectionEvidencePreserved,
    commands: asArray(objectRecord(input.draft).commands),
    attributeEdits: asArray(objectRecord(input.attributeLedger).edits),
    commandJournal: input.commandJournal,
    ledger: asArray(input.ledgerRows).map((row) => ({
      seq: row.seq, id: row.id, kind: row.kind, target: row.target,
      before: row.before, after: row.after, origin: row.origin, remark: row.remark,
    })),
  };
  const rootShape = Array.isArray(withAttributes)
    ? 'array'
    : ['hierarchy', 'branches', 'objects'].find((key) => Array.isArray(withAttributes?.[key])) ?? 'object';
  return {
    text: `${JSON.stringify(withAttributes, null, 2)}\n`,
    provenanceText: `${JSON.stringify(provenance, null, 2)}\n`,
    provenance,
    summary: {
      remaps: remaps.length,
      coordinatesTouched,
      supportProjectionEvidencePreserved: remapStats.supportProjectionEvidencePreserved,
      attributeEdits: provenance.attributeEdits.length,
      positionIdentityToleranceMm: identityToleranceMm,
      rootShape,
    },
  };
}

export const _test = Object.freeze({
  positionIdentityTolerance,
  isSupportOwner,
  buildSupportEvidenceBySourcePath,
  validateExistingSupportEvidence,
  preserveSupportProjectionEvidence,
  remapDocumentPositions,
});
