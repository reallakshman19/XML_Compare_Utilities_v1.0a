// Staged JSON edit pipeline: scope core, input adapter, extended fixes,
// attribute ledger, update-ledger rows, ghost model, and staged export.
import assert from 'node:assert/strict';

import {
  readStagedBranches, buildBranchScopeTree, filterStagedByScope, stagedDocumentStats,
} from '../workbench3d/core/staged-json-core.js';
import { scopeRegex, splitScopeTokens } from '../workbench3d/core/scope-pattern.js';
import {
  buildTraceEvidenceFromStagedJson, shouldOfferScopePopup,
} from '../tabs/topology-trace-validator/topology-staged-input-adapter.js';
import {
  buildGapBridgeSuggestions, buildAttributeFixSuggestions,
} from '../tabs/topology-trace-validator/topology-extended-fix-suggestions.js';
import {
  appendAttributeEdit, applyAttributeLedgerToStaged, createAttributeEditLedger,
  redoAttributeEdit, undoAttributeEdit,
} from '../tabs/topology-trace-validator/topology-attribute-edit-ledger.js';
import { buildUpdateLedgerRows, updateLedgerCsv } from '../tabs/topology-trace-validator/topology-update-ledger-model.js';
import { buildGhostVisualModel, ghostSuggestionId } from '../tabs/topology-trace-validator/topology-fix-ghost-model.js';
import { buildPositionRemaps, buildStagedExport } from '../tabs/topology-trace-validator/topology-staged-export.js';
import {
  branchSelectionIdsForIndexes, createTopologyEditScope, scopeCanonicalForDraft,
  scopeContainsBranchIndexes, suggestionBranchIndexes, topologyModelMode,
} from '../tabs/topology-trace-validator/topology-edit-scope-model.js';
import { buildTopologyExportAuditLog } from '../tabs/topology-trace-validator/topology-export-audit-log.js';

const point = (x, y, z) => ({ x, y, z });
const NOW = '2026-07-17T11:11:44.000Z';

// ── staged-json core: root shapes, scope tree, filter stats ───────────────
const stagedDoc = {
  schema: 'inputxml-managed-stage/v1',
  objects: [
    {
      name: '/A/B1', type: 'BRANCH',
      attributes: { NAME: '/A/B1', OWNER: '/A', OWNER_SITE: '/SITE-1', HPOS: point(0, 0, 0), TPOS: point(2000, 0, 0) },
      children: [
        { name: 'PIPE-1', type: 'PIPE', attributes: { APOS: point(0, 0, 0), LPOS: point(1000, 0, 0) } },
        { name: 'GASK-1', type: 'GASK', attributes: { APOS: point(1000, 0, 0), LPOS: point(1000, 0, 0) } },
        { name: 'SUPPORT-1', type: 'SUPPORT', attributes: { POS: point(500, 0, 0), DTXR: 'PIPE SUPPORT TYPE-102', SUPPORT_TYPE: '' } },
        { name: 'SUPPORT-2', type: 'SUPPORT', attributes: { POS: point(700, 0, 0), DTXR: 'LATERAL GUIDE', SUPPORT_TYPE: '' } },
      ],
    },
    { name: '/A/B2', type: 'BRANCH', attributes: { NAME: '/A/B2', OWNER: '/A', OWNER_SITE: '/SITE-1' }, children: [] },
    { name: '/C/B3', type: 'BRANCH', attributes: { NAME: '/C/B3', OWNER: '/C', OWNER_SITE: '/SITE-2' }, children: [] },
  ],
};

assert.equal(readStagedBranches(stagedDoc).branches.length, 3);
assert.equal(readStagedBranches(stagedDoc).rootKey, 'objects');
assert.equal(readStagedBranches(stagedDoc.objects).rootKey, null, 'bare arrays are accepted');
const stats = stagedDocumentStats(stagedDoc);
assert.equal(stats.branchCount, 3);
assert.equal(stats.componentCount, 4);
assert.equal(stats.componentTypes.SUPPORT, 2);

const tree = buildBranchScopeTree(stagedDoc.objects);
assert.equal(tree.length, 2, 'two sites');
assert.equal(tree[0].kind, 'SITE');
assert.equal(tree[0].branchCount, 2);
assert.equal(tree[0].children[0].children[0].kind, 'BRANCH');

const wildcardFilter = filterStagedByScope(stagedDoc, { wildcard: '*B1*' });
assert.deepEqual(wildcardFilter.stats, { scanned: 3, matched: 1, filtered: 2 });
assert.equal(wildcardFilter.filtered.objects.length, 1);
const idFilter = filterStagedByScope(stagedDoc, { selectedIds: ['site:/SITE-2'] });
assert.equal(idFilter.stats.matched, 1);
const noScope = filterStagedByScope(stagedDoc, {});
assert.equal(noScope.stats.matched, 3, 'empty scope keeps everything');
assert.deepEqual(splitScopeTokens('a, b; c\nd'), ['a', 'b', 'c', 'd']);
assert.ok(scopeRegex('S88*').test('S881'));
assert.ok(!scopeRegex('S88*').test('XS881'), 'globbed tokens are anchored');
assert.ok(scopeRegex('881').test('XS881'), 'plain tokens match substrings');

// ── staged input adapter ───────────────────────────────────────────────────
const evidence = buildTraceEvidenceFromStagedJson(stagedDoc, { sourceName: 'bench.json' });
assert.equal(evidence.artifacts.source.raw, stagedDoc);
assert.equal(evidence.hashes.canonical, '', 'empty canonical hash skips the pinned-hash guard');
assert.match(evidence.hashes.source, /^staged-[0-9a-f]{8}-\d+$/);
assert.equal(evidence.fileNames.source, 'bench.json');
assert.throws(() => buildTraceEvidenceFromStagedJson({ objects: [] }), /no branch objects/);
assert.equal(shouldOfferScopePopup(501, 0), true);
assert.equal(shouldOfferScopePopup(10, 6 * 1024 * 1024), true);
assert.equal(shouldOfferScopePopup(10, 1024), false);
const editScope = createTopologyEditScope(stagedDoc, { wildcard: '', selectedIds: ['branch:/A/B1'] });
assert.deepEqual(editScope.sourceBranchIndexes, [0]);
assert.deepEqual(branchSelectionIdsForIndexes(stagedDoc, [0]), ['branch:/A/B1']);
assert.equal(topologyModelMode({ edges: Array.from({ length: 200 }) }, 200).kind, 'SMALL_FULL');
assert.equal(topologyModelMode({ edges: Array.from({ length: 201 }) }, 200).kind, 'LARGE_SCOPED');

// ── extended fixes: gap bridge + attribute suggestions ────────────────────
const canonical = {
  toleranceMm: 0.1,
  nodes: [
    { id: 'CN-1', position: point(0, 0, 0), sourcePaths: ['$[0].children[0]'] },
    { id: 'CN-2', position: point(1000, 0, 0), sourcePaths: ['$[0].children[0]'] },
    { id: 'CN-3', position: point(1050, 0, 0), sourcePaths: ['$[1].children[0]'] }, // 50 mm gap to CN-2
    { id: 'CN-4', position: point(2050, 0, 0), sourcePaths: ['$[1].children[0]'] },
  ],
  edges: [
    { id: 'CE-1', fromNodeId: 'CN-1', toNodeId: 'CN-2', sourcePaths: ['$[0].children[0]'] },
    { id: 'CE-2', fromNodeId: 'CN-3', toNodeId: 'CN-4', sourcePaths: ['$[1].children[0]'] },
  ],
};
const scopedCanonical = scopeCanonicalForDraft(canonical, editScope);
assert.deepEqual(scopedCanonical.edges.map((row) => row.id), ['CE-1'], 'Draft view filters while the canonical input stays complete');
const scopedSuggestion = [{ operations: [{ type: 'MOVE_NODE', payload: { nodeId: 'CN-2' } }] }];
assert.deepEqual(suggestionBranchIndexes(canonical, scopedSuggestion), [0]);
assert.equal(scopeContainsBranchIndexes(editScope, suggestionBranchIndexes(canonical, scopedSuggestion)), true);
const bridges = buildGapBridgeSuggestions(canonical, { snapToleranceMm: 25, maxBridgeGapMm: 100 });
assert.equal(bridges.length, 1);
assert.equal(bridges[0].schema, 'TopologyFixSuggestion.v1');
assert.equal(bridges[0].operations[0].type, 'BRIDGE_GAP');
assert.equal(bridges[0].fixability, 'NEEDS_CONFIRMATION');
assert.ok(bridges[0].operations[0].payload.contextEdgeId, 'bridge carries a context edge');

const attributeRows = buildAttributeFixSuggestions(stagedDoc);
const families = attributeRows.filter((row) => row.fixCode === 'UNKNOWN_RESTRAINT_FAMILY');
assert.equal(families.length, 2);
const catalogRow = families.find((row) => row.sourcePath.endsWith('children[2]'));
assert.equal(catalogRow.after, 'REST');
assert.equal(catalogRow.fixability, 'AUTO_APPROVED', 'catalog REST defaults apply automatically');
assert.equal(catalogRow.approvedByDefault, true);
assert.match(catalogRow.warning, /catalog heuristic/i, 'catalog defaults carry an audit warning');
const guideRow = families.find((row) => row.sourcePath.endsWith('children[3]'));
assert.equal(guideRow.after, 'GUIDE');
assert.equal(guideRow.approvedByDefault, true, 'explicit family text is auto-approved');
const zeroRows = attributeRows.filter((row) => row.fixCode === 'ZERO_LENGTH_COMPONENT');
assert.equal(zeroRows.length, 1, 'zero-length GASK detected');
assert.equal(zeroRows[0].approvedByDefault, true);

// ── attribute ledger: append / undo / redo / apply ────────────────────────
let ledger = createAttributeEditLedger();
ledger = appendAttributeEdit(ledger, {
  branchIndex: 0, childIndex: 2, sourcePath: catalogRow.sourcePath,
  field: 'SUPPORT_TYPE', before: '', after: 'REST', reason: 'test', fixCode: 'UNKNOWN_RESTRAINT_FAMILY',
  origin: 'AUTOFIX:UNKNOWN_RESTRAINT_FAMILY', appliedAt: NOW,
});
assert.equal(ledger.edits.length, 1);
assert.equal(ledger.edits[0].id, 'AE-000001');
const undone = undoAttributeEdit(ledger);
assert.equal(undone.edits.length, 0);
assert.equal(redoAttributeEdit(undone).edits.length, 1);
const patched = applyAttributeLedgerToStaged(stagedDoc, ledger);
assert.equal(patched.objects[0].children[2].attributes.SUPPORT_TYPE, 'REST');
assert.equal(stagedDoc.objects[0].children[2].attributes.SUPPORT_TYPE, '', 'input is never mutated');

// ── update-ledger rows + CSV ───────────────────────────────────────────────
const draft = {
  baseCanonicalTopologyHash: 'hash:base', topologyEditDraftHash: 'hash:draft',
  commands: [
    { id: 'EC-000001', type: 'MOVE_NODE', payload: { nodeId: 'CN-2', position: point(1010, 0, 0) } },
    { id: 'EC-000002', type: 'TRANSACTION', payload: { metadata: { suggestionIds: ['TS-1'], issueIds: ['ISSUE-1'] }, operations: [
      { type: 'MERGE_NODES', payload: { sourceNodeId: 'CN-3', targetNodeId: 'CN-2' } },
    ] } },
  ],
  redoCommands: [],
};
const rows = buildUpdateLedgerRows({ draft, attributeLedger: ledger, remarks: { 'EC-000001': 'checked' } });
assert.equal(rows.length, 3, 'MOVE + nested MERGE + attribute edit');
assert.equal(rows[0].remark, 'checked');
assert.match(rows[1].origin, /^AUTOFIX:TS-1/);
const auditLog = buildTopologyExportAuditLog({ built: { canonicalTopology: { canonicalTopologyHash: 'hash:edited' }, editValidation: { findings: [] } },
  draft, attributeLedger: ledger, remarks: {}, checkerEvidence: { report: { issues: [] }, suggestions: [], reviewState: {} },
  modelMode: { kind: 'SMALL_FULL', elementCount: 2, threshold: 200 }, editScope: null, createdAt: NOW });
assert.equal(auditLog.operations[1].status, 'AUTO_FIX_APPLIED');
assert.deepEqual(auditLog.operations[1].issueIds, ['ISSUE-1'], 'producer transaction metadata links an autofix operation to its issue');
assert.equal(rows[2].kind, 'ATTRIBUTE_EDIT · UNKNOWN_RESTRAINT_FAMILY');
const csv = updateLedgerCsv(rows);
assert.match(csv.split('\n')[0], /^#,Id,Kind/);
assert.equal(csv.trim().split('\n').length, 4);

// ── ghost model ────────────────────────────────────────────────────────────
const ghostDocument = { documentId: 'topology-test-document', unit: 'MM', coordinateFrame: 'UNKNOWN', verticalAxis: 'Y' };
const ghost = buildGhostVisualModel(bridges, [catalogRow], canonical, ghostDocument);
assert.equal(ghost.schema, 'VisualGeometryModel.v2');
assert.equal(ghost.segments.length, 1);
assert.ok(ghost.segments[0].objectId.startsWith('ghost:XS-GAP-'));
assert.equal(ghostSuggestionId(ghost.segments[0].objectId), bridges[0].id);
assert.ok(ghost.markers.some((marker) => marker.objectId === `ghost:${catalogRow.id}`), 'attribute ghost badge present');

// ── staged export: position remap + provenance round-trip ────────────────
const remaps = buildPositionRemaps(canonical, draft);
assert.equal(remaps.length, 2, 'CN-2 moved; CN-3 merged onto CN-2');
const remapped = new Map(remaps.map((row) => [row.nodeId, row.to]));
assert.deepEqual(remapped.get('CN-2'), [1010, 0, 0]);
assert.deepEqual(remapped.get('CN-3'), [1010, 0, 0], 'merge follows the moved target');

const exportResult = buildStagedExport({
  baseStagedJson: stagedDoc,
  baseCanonical: canonical,
  draft,
  editedCanonicalHash: 'hash:edited',
  attributeLedger: ledger,
  commandJournal: { schema: 'CommandJournal.v1' },
  exportedAt: NOW,
  ledgerRows: rows,
  toleranceMm: 0.5,
});
const exported = JSON.parse(exportResult.text);
assert.equal(exported.schema, 'inputxml-managed-stage/v1');
assert.equal(exported.provenance.schema, 'StagedEditProvenance.v1');
assert.equal(exported.provenance.ledger.length, 3);
assert.equal(exported.objects[0].children[2].attributes.SUPPORT_TYPE, 'REST', 'attribute ledger applied');
assert.deepEqual(exported.objects[0].children[0].attributes.LPOS, { x: 1010, y: 0, z: 0 }, 'PIPE-1 endpoint follows the moved node');
assert.deepEqual(exported.objects[0].children[1].attributes.APOS, { x: 1010, y: 0, z: 0 }, 'GASK follows too');
assert.ok(exportResult.summary.coordinatesTouched >= 2);
const reread = readStagedBranches(exported);
assert.equal(reread.branches.length, 3, 'export re-reads through the staged reader');

console.log('topology staged-edit pipeline passed: scope core, adapter, extended fixes, ledger, ghost model, and export verified.');
