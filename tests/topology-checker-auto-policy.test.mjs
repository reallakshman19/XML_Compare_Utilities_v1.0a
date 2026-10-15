/** Policy, safe MOVE_NODE planning, one-transaction, and Resolved-history integration. */

import assert from 'node:assert/strict';
import * as core from '../vendor/3d-converters/topology-browser-core.mjs';
import {
  defaultTopologyCheckerPolicy, loadTopologyCheckerPolicy, normalizeTopologyCheckerPolicy, parseTopologyCheckerPolicy,
  saveTopologyCheckerPolicy, topologyCheckerOptions, topologyCheckerPolicyHash,
} from '../tabs/topology-trace-validator/topology-checker-policy.js';
import { buildEffectiveTopologySuggestions } from '../tabs/topology-trace-validator/topology-checker-short-fix.js';
import { planSafeTopologyAutoFixes } from '../tabs/topology-trace-validator/topology-checker-auto-fix.js';
import { activeTopologyAutoFixRuns, resolvedTopologyIssues } from '../tabs/topology-trace-validator/topology-checker-history.js';
import { buildTopologyExportAuditLog } from '../tabs/topology-trace-validator/topology-export-audit-log.js';

const node = (id, x) => ({ id, position: { x, y: 0, z: 0 }, sourcePortIds: [`P-${id}`], positionAuthority: 'SOURCE', inputXmlNodeIds: [id] });
const edge = (id, fromNodeId, toNodeId, role, branch) => ({ id, fromNodeId, toNodeId, segmentRole: role,
  ownerBranchId: branch, branchIds: [branch], sourceEntityIds: [`S-${id}`], sourceTypes: [role], inputXmlElementIds: [`PE-${id}`], diameterMm: 100 });

function canonicalFixture() {
  return { schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'fnv1a64:auto-policy', toleranceMm: 0.1,
    nodes: [node('A1', 0), node('A2', 0.421), node('A3', 20), node('B1', 300), node('B2', 300.421), node('B3', 306.5)],
    edges: [edge('SAFE-SHORT', 'A1', 'A2', 'PIPE_SUPPORT_SPLIT', 'B-SAFE'), edge('SAFE-PIPE', 'A2', 'A3', 'PIPE', 'B-SAFE'),
      edge('UNSAFE-SHORT', 'B1', 'B2', 'PIPE_SUPPORT_SPLIT', 'B-UNSAFE'), edge('UNSAFE-PIPE', 'B2', 'B3', 'PIPE', 'B-UNSAFE')],
    pointFeatures: [], junctions: [], boundaries: [], supports: [], rigids: [], bends: [], buildIssues: [] };
}

const memory = new Map();
const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
const defaults = defaultTopologyCheckerPolicy();
assert.equal(loadTopologyCheckerPolicy(storage).schema, 'TopologyCheckerPolicy.v1');
assert.equal(defaults.rules.find((row) => row.issueCode === 'SHORT_ELEMENT').fixMode, 'AUTO');
assert.equal(defaults.rules.find((row) => row.issueCode === 'EXPECTED_SHORT_INLINE_COMPONENT').fixMode, 'AUTO');
assert.match(topologyCheckerPolicyHash(defaults), /^fnv1a32:/);
saveTopologyCheckerPolicy(storage, defaults);
assert.deepEqual(loadTopologyCheckerPolicy(storage), defaults);
assert.throws(() => parseTopologyCheckerPolicy('{bad'), /policy import failed/i);
assert.throws(() => normalizeTopologyCheckerPolicy({ ...defaults, thresholds: { ...defaults.thresholds, shortElementMm: 0.01 } }), /greater than tolerance/i);

const canonical = canonicalFixture(), options = topologyCheckerOptions(canonical, defaults);
const report = core.runTopologyChecks(canonical, options);
const producer = core.buildTopologyFixSuggestions(canonical, report, {});
const effective = buildEffectiveTopologySuggestions(canonical, report, producer, defaults);
const safeIssue = report.issues.find((row) => row.code === 'SHORT_ELEMENT' && row.objectIds.includes('SAFE-SHORT'));
const unsafeIssue = report.issues.find((row) => row.code === 'SHORT_ELEMENT' && row.objectIds.includes('UNSAFE-SHORT'));
const safeSuggestion = effective.find((row) => row.issueId === safeIssue.id), unsafeSuggestion = effective.find((row) => row.issueId === unsafeIssue.id);
assert.equal(safeIssue.details.expectedInline, false);
assert.equal(safeSuggestion.effectiveFixMode, 'AUTO');
assert.equal(safeSuggestion.operations[0].type, 'MOVE_NODE');
assert.equal(unsafeSuggestion.effectiveFixMode, 'AUTO');
assert.equal(unsafeSuggestion.executionState, 'UNAVAILABLE');
assert.equal(unsafeSuggestion.operations.length, 0);

const gasketNeighbourCanonical = { ...canonical, canonicalTopologyHash: 'fnv1a64:gasket-neighbour',
  edges: canonical.edges.map((row) => row.id === 'SAFE-PIPE' ? { ...row, segmentRole: 'GASK', sourceTypes: ['GASK'] } : row) };
const gasketReport = core.runTopologyChecks(gasketNeighbourCanonical, options);
const gasketIssue = gasketReport.issues.find((row) => row.code === 'SHORT_ELEMENT' && row.objectIds.includes('SAFE-SHORT'));
const gasketSuggestions = buildEffectiveTopologySuggestions(gasketNeighbourCanonical, gasketReport,
  core.buildTopologyFixSuggestions(gasketNeighbourCanonical, gasketReport, {}), defaults);
assert.equal(gasketSuggestions.find((row) => row.issueId === gasketIssue.id).operations[0].type, 'MOVE_NODE',
  'an adjacent GASK is an eligible fourth-priority stretch absorber');

const draft = core.createTopologyEditDraft(canonical, { projection: 'XY', snapToleranceMm: 0.1, showOriginal: true });
const plan = await planSafeTopologyAutoFixes({ core, baseCanonical: canonical, canonical, draft, report, policy: defaults,
  policyHash: topologyCheckerPolicyHash(defaults), checkOptions: options, issueIds: [safeIssue.id, unsafeIssue.id],
  outOfScopeIssueIds: [], issuedAt: '2026-07-18T07:30:00+04:00' });
assert.equal(plan.run.applied.length, 1);
assert.equal(plan.run.rejected.length, 1);
assert.equal(plan.run.rejected[0].reasonCode, 'NO_SAFE_STRETCH_ENDPOINT');
assert.equal(plan.candidateDraft.commands.length, 1, 'safe subset is one undoable transaction');
assert.equal(plan.candidateDraft.commands[0].payload.metadata.autoFixRun.schema, 'TopologyAutoFixRun.v1');
assert(!plan.finalReport.issues.some((row) => row.id === safeIssue.id));
assert(plan.finalReport.issues.some((row) => row.id === unsafeIssue.id));
assert.equal(activeTopologyAutoFixRuns(plan.candidateDraft).length, 1);
assert.equal(resolvedTopologyIssues(plan.candidateDraft, plan.finalReport.issues).length, 1);
const resolved = resolvedTopologyIssues(plan.candidateDraft, plan.finalReport.issues);
const audit = buildTopologyExportAuditLog({
  checkerEvidence: { report: plan.finalReport, suggestions: effective, reviewState: core.createTopologyReviewState(plan.finalReport),
    policy: defaults, policyHash: topologyCheckerPolicyHash(defaults), autoFixRuns: [{ ...plan.run, active: true }], resolvedIssues: resolved },
  draft: plan.candidateDraft, attributeLedger: { edits: [] }, remarks: {},
  built: { canonicalTopology: core.materializeTopologyEditDraft(canonical, plan.candidateDraft).canonicalTopology, editValidation: { findings: [] } },
  modelMode: { kind: 'SMALL_FULL' }, editScope: null, createdAt: '2026-07-18T07:30:00+04:00',
});
assert.equal(audit.exportPolicy, 'ALWAYS_ALLOWED');
assert.equal(audit.policy.hash, topologyCheckerPolicyHash(defaults));
assert.equal(audit.autoFixRuns.length, 1);
assert.equal(audit.findings.find((row) => row.issueId === safeIssue.id).status, 'AUTO_FIX_RESOLVED');
assert(audit.operations[0].issueIds.includes(safeIssue.id));
const undone = core.undoTopologyEditCommand(plan.candidateDraft);
assert.equal(activeTopologyAutoFixRuns(undone).length, 0);
assert.equal(resolvedTopologyIssues(undone, report.issues).length, 0);

const expectedCanonical = { ...canonical, canonicalTopologyHash: 'fnv1a64:expected-inline',
  edges: canonical.edges.map((row) => row.id === 'SAFE-SHORT' ? { ...row, segmentRole: 'GASK', sourceTypes: ['GASK'] } : row) };
const expectedReport = core.runTopologyChecks(expectedCanonical, options);
const expectedIssue = expectedReport.issues.find((row) => row.code === 'EXPECTED_SHORT_INLINE_COMPONENT' && row.objectIds.includes('SAFE-SHORT'));
const expectedSuggestions = buildEffectiveTopologySuggestions(expectedCanonical, expectedReport,
  core.buildTopologyFixSuggestions(expectedCanonical, expectedReport, {}), defaults);
assert.equal(expectedIssue.code, 'EXPECTED_SHORT_INLINE_COMPONENT');
assert.equal(expectedIssue.details.expectedInline, true);
assert.equal(expectedSuggestions.find((row) => row.issueId === expectedIssue.id).effectiveFixMode, 'AUTO');

console.log('topology checker Auto policy passed: typed profile, both expectedInline values, safe subset, one transaction, rejection, and Undo-aware Resolved history verified.');
