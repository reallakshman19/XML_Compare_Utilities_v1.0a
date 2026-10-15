/** Dedicated topology-checker dashboard and pinned-core acceptance contracts. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { checkerBucketMarkup, topologyCheckerPanelMarkup } from '../tabs/topology-trace-validator/topology-checker-panel.js';
import {
  CHECKER_FILTER_DEFAULTS, checkerCategoryCounts, checkerIssueRow, checkerObjectIndexes,
  filterCheckerIssueRows,
} from '../tabs/topology-trace-validator/topology-checker-model.js';
import { topologyCheckerIconUrl } from '../tabs/topology-trace-validator/topology-checker-icons.js';
import { workspaceMarkup } from '../tabs/topology-trace-validator/topology-workspace-markup.js';
import * as core from '../vendor/3d-converters/topology-browser-core.mjs';

const node = (id, x, y) => ({ id, position: { x, y, z: 0 }, sourcePortIds: [`P-${id}`], positionAuthority: 'SOURCE', inputXmlNodeIds: [id] });
const edge = (id, fromNodeId, toNodeId, role = 'PIPE') => ({
  id, fromNodeId, toNodeId, segmentRole: role, ownerBranchId: 'BRANCH-ASIM', branchIds: ['BRANCH-ASIM'],
  sourceEntityIds: [`SOURCE-${id}`, 'BRANCH-ASIM'], sourceTypes: [role], inputXmlElementIds: [`PE-${id}`], diameterMm: 100,
});
const canonical = {
  schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'fnv1a64:dashboard', toleranceMm: 0.1,
  nodes: [node('N1', 0, 0), node('N2', 3.2, 0), node('N3', 100, 0), node('N4', 100, 100), node('N5', 120, 100), node('N6', 140, 100)],
  edges: [edge('GASK-1', 'N1', 'N2', 'GASK'), edge('PIPE-1', 'N2', 'N3'), edge('PIPE-2', 'N3', 'N4'), edge('PIPE-3', 'N5', 'N6')],
  pointFeatures: [], junctions: [], boundaries: [], supports: [], rigids: [], bends: [], buildIssues: [],
};

const report = core.runTopologyChecks(canonical, { shortElementMm: 6, toleranceMm: 0.1, snapToleranceMm: 25, angleToleranceDeg: 5, originToleranceMm: 0.1, clearanceMm: 0 });
assert.equal(report.schema, 'TopologyCheckReport.v1');
assert.equal(report.summary.countsByCode.EXPECTED_SHORT_INLINE_COMPONENT, 1);
assert.equal(report.summary.countsByCode.RIGHT_ANGLE_WITHOUT_BEND, 1);
assert.equal(report.summary.countsByCode.SNAP_GAP, 1);
assert.equal(report.summary.findingCount, Object.values(report.summary.countsByCode).reduce((sum, count) => sum + count, 0));

const suggestions = core.buildTopologyFixSuggestions(canonical, report, {});
assert(suggestions.some((row) => row.schema === 'TopologyFixSuggestion.v1' && row.operations[0]?.type === 'ADD_BEND_DEFINITION'));
const review = core.createTopologyReviewState(report);
const resolved = core.setTopologyIssueStatus(report, review, report.issues[0].id, 'RESOLVED', '');
assert.equal(core.topologyReviewSummary(report, resolved).resolvedCount, 1);

const indexes = checkerObjectIndexes(canonical), suggestionByIssue = new Map(suggestions.map((row) => [row.issueId, row]));
const rows = report.issues.map((issue) => checkerIssueRow(issue, suggestionByIssue.get(issue.id), { indexes, reviewState: resolved, baselineIssueIds: new Set(report.issues.map((row) => row.id)) }));
assert.equal(Object.values(checkerCategoryCounts(rows)).reduce((sum, count) => sum + count, 0), rows.length);
assert(filterCheckerIssueRows(rows, { ...CHECKER_FILTER_DEFAULTS, category: 'CONNECTIVITY' }, new Set()).every((row) => row.category === 'CONNECTIVITY'));

const markup = topologyCheckerPanelMarkup();
for (const token of ['data-ttv-checker-kpis', 'data-ttv-checker-buckets', 'data-ttv-checker-scroll', 'data-ttv-checker-detail', 'data-ttv-checker-auto-fix', 'data-ttv-checker-settings', 'data-ttv-checker-layout="right"', 'data-ttv-checker-layout="bottom"']) assert(markup.includes(token), token);
const bucketMarkup = checkerBucketMarkup({ GEOMETRY: 2 }, '');
assert(bucketMarkup.includes('data-ttv-checker-skip-bucket="GEOMETRY"'), 'bucket Skip action is available');
const controllerSource = readFileSync(new URL('../tabs/topology-trace-validator/topology-checker-controller.js', import.meta.url), 'utf8');
assert(controllerSource.includes('USER_CONFIRMATION_PENDING'), 'large-model unconfirmed cases are persisted as pending');
assert(controllerSource.includes("exportPolicy: 'ALWAYS_ALLOWED'"), 'checker report documents non-blocking export policy');
assert(!markup.includes('⌁'));
assert(existsSync(new URL('../vendor/lucide/icons/scan-search.svg', import.meta.url)));
assert(existsSync(new URL('../vendor/lucide/icons/settings.svg', import.meta.url)));
assert(topologyCheckerIconUrl('scan-search').endsWith('/vendor/lucide/icons/scan-search.svg'));

const workspace = workspaceMarkup();
const tracePanel = workspace.slice(workspace.indexOf('data-ttv-workspace-panel="trace"'), workspace.indexOf('data-ttv-workspace-panel="edit"'));
const editPanel = workspace.slice(workspace.indexOf('data-ttv-workspace-panel="edit"'), workspace.indexOf('data-ttv-workspace-panel="parity"'));
assert(tracePanel.includes('data-ttv-edit-export'), 'Bundle + Log is promoted to the Trace/main header');
assert(tracePanel.includes('data-ttv-edit-export-staged'), 'staged JSON export is promoted to the Trace/main header');
assert(!editPanel.includes('data-ttv-edit-export disabled'), 'Edit Draft no longer duplicates the Bundle + Log button');
assert(!editPanel.includes('data-ttv-edit-export-staged'), 'Edit Draft no longer duplicates the staged JSON button');
assert(editPanel.includes('data-ttv-edit-load-branches') && editPanel.includes('Load JSON branches'), 'Edit Draft exposes explicit JSON branch loading');
assert(!editPanel.includes('data-ttv-edit-change-scope'), 'the ambiguous Change scope action is removed');
assert(tracePanel.includes('<details class="ttv-manual-overrides">'), 'legacy loaders use a disclosure');
assert(tracePanel.includes('Load Canonical Topology') && tracePanel.includes('Load Trace Ledger') && tracePanel.includes('Load Topology InputXML'));
assert(workspace.includes('data-ttv-autofix-toast') && workspace.includes('data-ttv-autofix-toast-export="bundle"'));

const manifest = JSON.parse(readFileSync(new URL('../vendor/3d-converters/topology-browser-core.manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.sourceCommit, '49316020e0841e11c620c3cf9c45a8c1025e5803');
for (const name of ['runTopologyChecks', 'buildTopologyFixSuggestions', 'applyTopologyFixSuggestion', 'applyApprovedTopologyFixes']) assert.equal(typeof core[name], 'function', name);

console.log('topology checker dashboard passed: pinned core, filters, reconciled KPIs, review state, local icons, and modeless controls verified.');
