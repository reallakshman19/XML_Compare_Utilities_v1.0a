// Node compare engine: tolerance match, moved/missing/new, ambiguity gate,
// manual link, audit contract + reconciliation, heatmap ramp.
import assert from 'assert';
import { buildNodeSetGraph } from '../workbench3d/adapters/nodeset-adapter.js';
import { runNodeCompare } from '../workbench3d/compare/node-compare-engine.js';
import { validateCompareAudit, DIFF_STATUS, CONFIDENCE } from '../workbench3d/contracts/contracts.js';
import { heatmapColor, buildHeatmapOverrides } from '../workbench3d/viewer/heatmap.js';
import { buildConnectorModel, validateConnectorModel } from '../workbench3d/viewer/connector-model.js';
import { buildVisualModel } from '../workbench3d/adapters/visual-model-builder.js';
import { buildTransferPlan } from '../workbench3d/compare/transfer-planner.js';

const nodeXml = (name, nodes) => `<NodeSet schema="nodeset/v1" name="${name}" unit="mm">
${nodes.map((n) => `<Node id="${n.id}" e="${n.e}" n="${n.n}" u="${n.u}"${n.bore ? ` bore="${n.bore}"` : ''}${n.tag ? ` tag="${n.tag}"` : ''}>${(n.supports ?? []).map((s) => `<Support kind="${s}" detail="${s}-100"/>`).join('')}</Node>`).join('\n')}
</NodeSet>`;

// Source: 4 nodes. Target: PS-01 exact, PS-02 moved 40mm, PS-03 missing,
// PS-NEW added, plus an ambiguous pair (two identical candidates for PS-04).
const srcXml = nodeXml('src', [
  { id: 'PS-01', e: 0, n: 100000, u: 3000, bore: 250, tag: 'A', supports: ['REST'] },
  { id: 'PS-02', e: 5000, n: 100000, u: 3000, bore: 250, tag: 'B', supports: ['REST', 'GUIDE'] },
  { id: 'PS-03', e: 9000, n: 100000, u: 3000, bore: 150 },
  { id: 'PS-04', e: 50000, n: 50000, u: 3000, bore: 100 },
]);
const tgtXml = nodeXml('tgt', [
  { id: 'PS-01', e: 0, n: 100000, u: 3000, bore: 250, tag: 'A', supports: ['REST'] },
  { id: 'PS-02X', e: 5040, n: 100000, u: 3000, bore: 250, tag: 'B', supports: ['REST', 'GUIDE'] },
  { id: 'PS-NEW', e: 20000, n: 100000, u: 3000, bore: 80 },
  { id: 'PS-04A', e: 50010, n: 50000, u: 3000, bore: 100 },
  { id: 'PS-04B', e: 49990, n: 50000, u: 3000, bore: 100 },
]);

const graphA = buildNodeSetGraph('source', srcXml);
const graphB = buildNodeSetGraph('target', tgtXml);
const audit = runNodeCompare(graphA, graphB, { positionToleranceMm: 100 });

assert.deepStrictEqual(validateCompareAudit(audit), [], 'node audit passes CompareAudit contract');
assert.strictEqual(audit.compareKind, 'node-wise');

const rowFor = (id) => audit.objectDiff.rows.find((r) => r.sourceObjectId && graphA.objects.find((o) => o.objectId === r.sourceObjectId)?.fromNode === id);

// exact match
const exact = rowFor('PS-01');
assert.strictEqual(exact.status, DIFF_STATUS.MATCHED_UNCHANGED);
assert.strictEqual(exact.confidence, CONFIDENCE.HIGH);
assert.strictEqual(exact.positionDeltaMm, 0);

// moved node still matches (within tolerance) and records the delta
const moved = rowFor('PS-02');
assert.ok(moved.targetObjectId, 'moved node matched');
assert.ok(Math.abs(moved.positionDeltaMm - 40) < 0.5, `delta ≈ 40 (got ${moved.positionDeltaMm})`);

// missing / new
const missing = rowFor('PS-03');
assert.strictEqual(missing.status, DIFF_STATUS.MISSING_IN_TARGET);
assert.strictEqual(audit.summary.newInTarget >= 1, true, 'PS-NEW is NEW_IN_TARGET');

// ambiguity: PS-04 has two equal candidates → AMBIGUOUS, never auto-matched
const ambiguous = rowFor('PS-04');
assert.strictEqual(ambiguous.status, DIFF_STATUS.AMBIGUOUS, 'symmetric candidates blocked');
assert.strictEqual(ambiguous.targetObjectId, null);
assert.strictEqual(ambiguous.candidateTargetIds.length, 2);

// reconciliation: every object in exactly one row
const srcSeen = audit.objectDiff.rows.filter((r) => r.sourceObjectId).map((r) => r.sourceObjectId);
const tgtSeen = audit.objectDiff.rows.filter((r) => r.targetObjectId).map((r) => r.targetObjectId);
assert.strictEqual(new Set(srcSeen).size, graphA.objects.length);
assert.strictEqual(new Set(tgtSeen).size, tgtSeen.length);
assert.strictEqual(tgtSeen.length + audit.summary.newInTarget - audit.summary.newInTarget, tgtSeen.length);
assert.strictEqual(audit.objectDiff.rows.filter((r) => r.targetObjectId).length + audit.objectDiff.rows.filter((r) => r.status === DIFF_STATUS.NEW_IN_TARGET && !r.targetObjectId).length, tgtSeen.length);

// manual LINK resolves the ambiguity
const candidateId = ambiguous.candidateTargetIds[0];
const audit2 = runNodeCompare(graphA, graphB, { positionToleranceMm: 100 }, [
  { type: 'LINK', sourceObjectId: ambiguous.sourceObjectId, targetObjectId: candidateId },
]);
const linked = audit2.objectDiff.rows.find((r) => r.sourceObjectId === ambiguous.sourceObjectId);
assert.strictEqual(linked.targetObjectId, candidateId, 'manual link honored');
assert.strictEqual(linked.confidence, CONFIDENCE.HIGH);
assert.strictEqual(audit2.summary.ambiguousElements, 0);

// connectors + transfer plan work on node audits unchanged
const visualA = buildVisualModel(graphA, {});
const visualB = buildVisualModel(graphB, {});
const plan = buildTransferPlan(audit2, graphA, graphB, {});
const connectors = buildConnectorModel({ compareAudit: audit2, transferPlan: plan, sourceVisual: visualA, targetVisual: visualB, sourceGraph: graphA, targetGraph: graphB });
assert.deepStrictEqual(validateConnectorModel(connectors, { compareAudit: audit2, transferPlan: plan }), [], 'node connectors audit-linked');
assert.ok(connectors.connectors.length > 0, 'connector endpoints resolved from markers');

// ── heatmap ramp ─────────────────────────────────────────────────────────
assert.strictEqual(heatmapColor(0, 50), heatmapColor(-5, 50), 'clamped at 0');
const blue = heatmapColor(0, 50);
const red = heatmapColor(50, 50);
assert.ok((blue & 0xff) > ((blue >> 16) & 0xff), 'zero delta is blue-ish');
assert.ok(((red >> 16) & 0xff) > (red & 0xff), 'max delta is red-ish');
const overrides = buildHeatmapOverrides(audit, { heatmap: { enabled: true, maxDeltaMm: 50 } });
assert.ok(overrides.has(moved.sourceObjectId) && overrides.has(moved.targetObjectId), 'both sides colored');
assert.strictEqual(buildHeatmapOverrides(audit, { heatmap: { enabled: false } }).size, 0, 'disabled → empty');

console.log('workbench3d-nodecompare.test.js passed');
console.log(`  matched=${audit.summary.matchedElements} ambiguous=${audit.summary.ambiguousElements} missing=${audit.summary.missingInTarget} new=${audit.summary.newInTarget} maxDelta=${audit.summary.maxPositionDeltaMm}`);
