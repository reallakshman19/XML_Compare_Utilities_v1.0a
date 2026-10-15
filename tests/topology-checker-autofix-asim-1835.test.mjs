/** Real 25 MB ASIM-1835 safe-subset Auto fix acceptance. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as core from '../vendor/3d-converters/topology-browser-core.mjs';
import {
  defaultTopologyCheckerPolicy, topologyCheckerOptions, topologyCheckerPolicyHash,
} from '../tabs/topology-trace-validator/topology-checker-policy.js';
import { buildEffectiveTopologySuggestions } from '../tabs/topology-trace-validator/topology-checker-short-fix.js';
import { planSafeTopologyAutoFixes } from '../tabs/topology-trace-validator/topology-checker-auto-fix.js';

const fixturePath = process.env.ASIM_1835_SOURCE
  || 'C:/Users/reall/Downloads/ATTRIBUTE-AML_ASIM-1835_managed_stage_enriched_stage.json';
const branchName = '/ASIM-1835-1/2"-P8810294-36620T3/B2';

if (!existsSync(fixturePath)) {
  console.log(`topology checker Auto fix ASIM-1835 SKIPPED: real fixture missing (${fixturePath})`);
} else {
  const started = performance.now(), sourceText = readFileSync(fixturePath, 'utf8');
  const source = JSON.parse(sourceText);
  const branches = Array.isArray(source) ? source : (source.hierarchy ?? source.branches ?? source.objects ?? []);
  const built = await core.buildComponentTopologyArtifacts(sourceText, {
    sourceName: 'ASIM-1835.json', jobName: 'ASIM-1835 Auto Fix Acceptance', toleranceMm: 0.1,
    supportProjectionToleranceMm: 50, enrichmentConfig: {},
  });
  const canonical = built.canonicalTopology, policy = defaultTopologyCheckerPolicy();
  const checkOptions = topologyCheckerOptions(canonical, policy);
  const report = core.runTopologyChecks(canonical, checkOptions);
  const suggestions = buildEffectiveTopologySuggestions(canonical, report,
    core.buildTopologyFixSuggestions(canonical, report, {}), policy);
  const autoSuggestions = suggestions.filter((row) => row.effectiveFixMode === 'AUTO');
  const branchIndex = branches.findIndex((row) => row?.name === branchName || row?.attributes?.NAME === branchName);
  assert.ok(branchIndex >= 0, `real acceptance branch ${branchName} exists`);
  const pathPrefix = `$.objects[${branchIndex}]`;
  const scopedObjectIds = new Set(canonical.edges.filter((edge) => edge.sourcePaths?.some((path) =>
    path === pathPrefix || path.startsWith(`${pathPrefix}.`))).map((edge) => edge.id));
  const issuesById = new Map(report.issues.map((row) => [row.id, row]));
  const inScope = autoSuggestions.filter((suggestion) => issuesById.get(suggestion.issueId)?.objectIds.some((id) => scopedObjectIds.has(id)));
  const outOfScopeIssueIds = autoSuggestions.filter((row) => !inScope.includes(row)).map((row) => row.issueId);
  const issueIds = inScope.map((row) => row.issueId);
  assert(issueIds.length > 0, 'largest branch contains Auto candidates');
  const draft = core.createTopologyEditDraft(canonical, {
    projection: 'XY', snapToleranceMm: Number(canonical.toleranceMm), showOriginal: true,
  });
  const plan = await planSafeTopologyAutoFixes({
    core, baseCanonical: canonical, canonical, draft, report, policy,
    policyHash: topologyCheckerPolicyHash(policy), checkOptions, issueIds, outOfScopeIssueIds,
    issuedAt: '2026-07-18T08:00:00+04:00',
  });
  const initialIds = new Set(report.issues.map((row) => row.id));
  const finalIds = new Set(plan.finalReport.issues.map((row) => row.id));
  const resolvedIds = [...plan.run.applied, ...plan.run.related].map((row) => row.issue.id);
  const materialized = core.materializeTopologyEditDraft(canonical, plan.candidateDraft);

  assert.equal(branches.length, 276);
  assert.equal(canonical.nodes.length, 4406);
  assert.equal(canonical.edges.length, 4434);
  assert.equal(report.issues.length, 694);
  assert.equal(autoSuggestions.length, 682);
  assert.equal(autoSuggestions.length, plan.run.applied.length + plan.run.related.length + plan.run.rejected.length);
  assert.equal(plan.candidateDraft.commands.length, plan.run.committed ? 1 : 0);
  assert.equal(materialized.validation.ok, true);
  assert(resolvedIds.every((id) => !finalIds.has(id)), 'every accepted or related target disappears');
  assert([...finalIds].every((id) => initialIds.has(id)), 'accepted moves introduce zero new finding IDs');
  assert(plan.run.rejected.every((row) => row.reasonCode && row.message), 'every rejection is documented');

  console.log(`topology checker Auto fix ASIM-1835 passed [REAL model] ${JSON.stringify({
    elapsedMs: Math.round(performance.now() - started), branches: branches.length, nodes: canonical.nodes.length,
    edges: canonical.edges.length, initialFindings: report.issues.length, modelAutoCandidates: autoSuggestions.length,
    inScope: issueIds.length, outOfScope: outOfScopeIssueIds.length,
    applied: plan.run.applied.length, related: plan.run.related.length, rejected: plan.run.rejected.length,
    finalFindings: plan.finalReport.issues.length, transactionCount: plan.candidateDraft.commands.length,
  })}`);
}
