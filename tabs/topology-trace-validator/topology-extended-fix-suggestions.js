/**
 * Extended fix suggestions beyond the pinned core's set, targeting the
 * benchmark issue census:
 *   · 25–100 mm open-endpoint gaps → BRIDGE_GAP (needs confirmation) — also
 *     covers dangling HREF/TREF relinks geometrically
 *   · unknown restraint family → attribute normalization (auto when the
 *     mapping is unambiguous)
 *   · zero-length policy → expected-inline components auto-tagged OK; true
 *     zero-length PIPEs stay manual (the residual click-UI work)
 *
 * Geometry suggestions are shaped exactly like the core's
 * TopologyFixSuggestion.v1 so core.applyTopologyFixSuggestion accepts them
 * (it validates schema + operations only). Attribute suggestions carry
 * kind 'ATTRIBUTE_EDIT' and flow into the AttributeEditLedger instead.
 */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { readStagedBranches } from '../../workbench3d/core/staged-json-core.js';

const RESTRAINT_FAMILIES = Object.freeze(['REST', 'GUIDE', 'LINESTOP', 'LIMIT', 'ANCHOR', 'HOLDOWN']);
const FAMILY_PATTERNS = Object.freeze([
  ['LINESTOP', /LINE[\s_-]?STOP|LSTP|AXIAL[\s_-]?STOP/i],
  ['HOLDOWN', /HOLD[\s_-]?DOWN|HD[\s_-]?CLAMP/i],
  ['ANCHOR', /ANCH|FIXPOINT|FIX[\s_-]?POINT/i],
  ['GUIDE', /GUID|LATERAL/i],
  ['LIMIT', /LIMIT|STOP[\s_-]?GAP/i],
  ['REST', /REST|SHOE|SADDLE|TROLLEY|SLIDE/i],
]);
const EXPECTED_INLINE_TYPES = Object.freeze(['GASK', 'FLAN', 'VALV', 'INST', 'OLET', 'TEE', 'REDU']);

const xyz = (point) => [Number(point.x), Number(point.y), Number(point.z)];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** 25–100 mm gaps between open endpoints → BRIDGE_GAP suggestions. */
export function buildGapBridgeSuggestions(canonical, { snapToleranceMm = 25, maxBridgeGapMm = 100 } = {}) {
  const nodes = asArray(canonical.nodes).map(objectRecord);
  const edges = asArray(canonical.edges).map(objectRecord);
  const degree = new Map();
  const adjacent = new Map();
  for (const edge of edges) {
    for (const key of ['fromNodeId', 'toNodeId']) {
      const id = cleanText(edge[key]);
      degree.set(id, (degree.get(id) ?? 0) + 1);
      if (!adjacent.has(id)) adjacent.set(id, cleanText(edge.id));
    }
  }
  const open = nodes.filter((node) => degree.get(cleanText(node.id)) === 1);
  const used = new Set();
  const suggestions = [];
  for (const node of open) {
    const id = cleanText(node.id);
    if (used.has(id)) continue;
    let best = null;
    for (const other of open) {
      const otherId = cleanText(other.id);
      if (otherId === id || used.has(otherId)) continue;
      const gap = dist(xyz(node.position), xyz(other.position));
      if (gap <= snapToleranceMm || gap > maxBridgeGapMm) continue;
      if (!best || gap < best.gap) best = { otherId, other, gap };
    }
    if (!best) continue;
    used.add(id); used.add(best.otherId);
    const contextEdgeId = adjacent.get(id) ?? adjacent.get(best.otherId) ?? '';
    if (!contextEdgeId) continue;
    const index = suggestions.length + 1;
    suggestions.push(Object.freeze({
      schema: 'TopologyFixSuggestion.v1',
      id: `XS-GAP-${String(index).padStart(4, '0')}`,
      issueId: `EXT-GAP-${String(index).padStart(4, '0')}`,
      title: `Bridge ${best.gap.toFixed(0)} mm open-endpoint gap`,
      rationale: 'Both endpoints are open, the gap exceeds snap tolerance but stays within the approved bridge range, and the nearest-candidate pairing is unique.',
      confidence: 'MEDIUM',
      risk: 'MEDIUM',
      fixability: 'NEEDS_CONFIRMATION',
      approvedByDefault: false,
      operations: Object.freeze([{ type: 'BRIDGE_GAP', payload: { fromNodeId: id, toNodeId: best.otherId, contextEdgeId } }]),
      preconditions: Object.freeze(['OPEN_ENDPOINTS', 'GAP_WITHIN_BRIDGE_RANGE', 'UNIQUE_NEAREST_CANDIDATE']),
      affectedObjectIds: Object.freeze([id, best.otherId]),
      preview: Object.freeze({ kind: 'BRIDGE_GAP', from: node.position, to: best.other.position, gapMm: best.gap }),
    }));
  }
  return Object.freeze(suggestions);
}

// Catalog-code heuristics: engineering-plausible defaults applied by default
// (user decision 2026-07-17) — each application logs a warning so the mapping
// stays auditable in the update ledger.
const CATALOG_PATTERNS = Object.freeze([
  ['REST', /TRUNNION/i],
  ['REST', /['"]?T['"]?[\s_-]?POST/i],
  ['REST', /PIPE\s+SUPPORT\s+TYPE[\s_-]?\d+/i],
  ['NONE', /FLOOR\s+OPENING|COMMENT\s+ATTA|PENETRATION/i],
]);

function inferRestraintFamily(child) {
  const attributes = objectRecord(child.attributes);
  const strong = ['SUPPORT_TYPE', 'CMPSUPTYPE', 'MDSSUPPFUNC'].map((field) => cleanText(attributes[field])).join(' ');
  const haystack = `${strong} ${['DTXR', 'SKEY', 'DESC'].map((field) => cleanText(attributes[field])).join(' ')} ${cleanText(child.name)}`;
  const matches = FAMILY_PATTERNS.filter(([, pattern]) => pattern.test(strong) || pattern.test(haystack)).map(([family]) => family);
  if (matches.length) return { family: matches[0], ambiguous: new Set(matches).size > 1, catalog: false };
  const catalog = CATALOG_PATTERNS.find(([, pattern]) => pattern.test(haystack));
  if (catalog) return { family: catalog[0], ambiguous: false, catalog: true };
  const descriptor = cleanText(attributes.DTXR);
  // '---', empty descriptors with no support function → non-restraint attachment.
  if (/^-+$/.test(descriptor) || (!descriptor && !strong)) return { family: 'NONE', ambiguous: false, catalog: true };
  return { family: '', ambiguous: false, catalog: false };
}

/**
 * Attribute-only fix suggestions from the staged document:
 * UNKNOWN_RESTRAINT_FAMILY normalization and ZERO_LENGTH policy tags.
 * Each row: { kind:'ATTRIBUTE_EDIT', id, fixCode, title, rationale, fixability,
 *             approvedByDefault, branchIndex, childIndex, sourcePath, field,
 *             before, after, position:[x,y,z]|null }
 */
export function buildAttributeFixSuggestions(stagedDoc) {
  const { branches, rootKey } = readStagedBranches(stagedDoc);
  const rootPath = rootKey ? `$.${rootKey}` : '$';
  const rows = [];
  branches.forEach((branch, branchIndex) => {
    asArray(objectRecord(branch).children).map(objectRecord).forEach((child, childIndex) => {
      const attributes = objectRecord(child.attributes);
      const sourcePath = `${rootPath}[${branchIndex}].children[${childIndex}]`;
      const position = attributes.APOS ?? attributes.POS ?? null;
      const type = cleanText(child.type).toUpperCase();
      if (type === 'SUPPORT') {
        const current = cleanText(attributes.SUPPORT_TYPE).toUpperCase();
        if (RESTRAINT_FAMILIES.includes(current) || current === 'NONE') return;
        const { family, ambiguous, catalog } = inferRestraintFamily(child);
        const descriptor = cleanText(attributes.DTXR) || cleanText(attributes.CMPSUPTYPE) || '(no descriptor)';
        // Catalog REST defaults auto-apply per user decision (2026-07-17) but
        // carry a warning so the assumption stays visible in the ledger/log.
        const catalogRest = catalog && family === 'REST';
        rows.push(Object.freeze({
          kind: 'ATTRIBUTE_EDIT',
          id: `XA-RF-${branchIndex}-${childIndex}`,
          fixCode: 'UNKNOWN_RESTRAINT_FAMILY',
          title: family ? `Normalize restraint family → ${family}` : 'Restraint family unresolved',
          rationale: family
            ? (catalog
              ? `Catalog descriptor "${descriptor}" defaults to ${family} by project heuristic.`
              : `Support text matches the ${family} pattern${ambiguous ? ' but more than one family matched — confirm.' : ' unambiguously.'}`)
            : `No family pattern matched "${descriptor}"; manual engineering review required.`,
          warning: catalogRest ? `Defaulted ${descriptor} → REST by catalog heuristic; verify against the project support catalog.` : '',
          fixability: family ? (ambiguous || (catalog && !catalogRest) ? 'NEEDS_CONFIRMATION' : 'AUTO_APPROVED') : 'MANUAL_ENGINEERING',
          approvedByDefault: Boolean(family) && !ambiguous && (!catalog || catalogRest),
          branchIndex, childIndex, sourcePath,
          field: 'SUPPORT_TYPE', before: cleanText(attributes.SUPPORT_TYPE), after: family || null,
          position: position ? [Number(position.x), Number(position.y), Number(position.z)] : null,
        }));
        return;
      }
      const start = attributes.APOS, end = attributes.LPOS;
      if (start && end && dist(xyz(objectRecord(start)), xyz(objectRecord(end))) < 0.01) {
        if (cleanText(attributes.ZERO_LENGTH_POLICY)) return;
        const expected = EXPECTED_INLINE_TYPES.includes(type);
        // A zero-chord ELBO with a distinct bend POS is a point-elbow marker,
        // not a data error — confirmable, not manual.
        const bendPoint = attributes.POS ? xyz(objectRecord(attributes.POS)) : null;
        const pointElbow = type === 'ELBO' && bendPoint && dist(bendPoint, xyz(objectRecord(start))) > 0.01;
        rows.push(Object.freeze({
          kind: 'ATTRIBUTE_EDIT',
          id: `XA-ZL-${branchIndex}-${childIndex}`,
          fixCode: 'ZERO_LENGTH_COMPONENT',
          title: expected ? `Tag expected-inline ${type}` : pointElbow ? 'Tag point-elbow marker' : `Zero-length ${type} requires review`,
          rationale: expected
            ? `${type} is an expected point-fitting; tagged EXPECTED_INLINE so it stops flagging.`
            : pointElbow
              ? 'Zero chord with a distinct bend POS — point-elbow representation; confirm to tag EXPECTED_INLINE.'
              : `A zero-length ${type} is not an expected inline component; manual engineering decision required.`,
          fixability: expected ? 'AUTO_APPROVED' : pointElbow ? 'NEEDS_CONFIRMATION' : 'MANUAL_ENGINEERING',
          approvedByDefault: expected,
          branchIndex, childIndex, sourcePath,
          field: 'ZERO_LENGTH_POLICY', before: '', after: expected || pointElbow ? 'EXPECTED_INLINE' : null,
          position: start ? [Number(objectRecord(start).x), Number(objectRecord(start).y), Number(objectRecord(start).z)] : null,
        }));
      }
    });
  });
  return Object.freeze(rows);
}

export const _test = Object.freeze({ inferRestraintFamily, FAMILY_PATTERNS, EXPECTED_INLINE_TYPES });
