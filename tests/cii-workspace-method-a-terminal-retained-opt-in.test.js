import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { qualifyCiiMethodATerminalContinuation } from '../tabs/cii-workspace/cii-workspace-terminal-continuation.js';
import { compareLockedCiiAnchorSpan } from '../tabs/cii-workspace/cii-workspace-topology.js';
import { ciiAutomaticBaseSelection } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';
import { createCiiWriter2SourceSetPreviewWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';
import { buildCiiSourceTargetAudit } from '../tabs/cii-workspace/cii-workspace-source-target-audit.js';

const cryptoRef = globalThis.crypto || webcrypto;
const fixture = (name) => readFileSync(fileURLToPath(new URL('../Benchmark/' + name, import.meta.url)));
const sources = ['S1', 'S2', 'S3'].map((sourceId) =>
  ({ sourceId, fileName: sourceId + '.CII', bytes: fixture(sourceId + '.CII') }));
const input = { sources, targetFileName: 'T.CII', targetBytes: fixture('T.CII') };
const { inspection, preparedSession } = await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge(input, { cryptoRef });
const baseLoopsBySource = Object.fromEntries((inspection.memberInspections || []).map(({ sourceId, inspection: member }) => {
  const choice = ciiAutomaticBaseSelection(member.baseAnchorSuggestions || []);
  assert.equal(choice.status, 'READY', 'authentic ' + sourceId + ' method A base must be READY');
  return [sourceId, choice.baseLoops];
}));
const previewInput = { ...input, baseLoopsBySource };
const baseline = await createCiiWriter2SourceSetPreviewWithVersionBridge(previewInput, { cryptoRef });
const trial = await createCiiWriter2SourceSetPreviewWithVersionBridge(previewInput, {
  cryptoRef, methodATerminalContinuation: true,
});
const before = buildCiiSourceTargetAudit(baseline);
const after = buildCiiSourceTargetAudit(trial);
const expected = [
  ['S1','3830','860'], ['S1','4960','1060'],
  ['S2','80','40050'], ['S2','50','40040'], ['S2','620','10460'],
  ['S3','1920','21920'],
];
// Negative source/target graphs are local test-only clones. None is routed to
// Writer2, and a failure cannot be repaired by dropping the failed predicate.
const s1Member = preparedSession.members.find((member) => member.sourceId === 'S1');
const s1Loop = baseline.memberPreviews.find((member) => member.sourceId === 'S1').preview
  .multiBaseCorrespondence.loopResults.find(({loop}) => loop.method === 'METHOD_A_SPATIAL');
assert(s1Member && s1Loop, 'authentic selected S1 Method A loop expected');
const s1Graph = s1Member.sourceGraph;
const targetGraph = preparedSession.target.targetGraph;
const sourceSpan = compareLockedCiiAnchorSpan(s1Graph, targetGraph, s1Loop.loop.anchorPairs,
  {cryptoRef, geometryTransform:s1Loop.loop.geometry});
const negativeRows = (source, target, loop, correspondence) =>
  qualifyCiiMethodATerminalContinuation(source, target, loop, correspondence).nodeRows;
const asPairs = (rows) => rows.map((row) => String(row.sourceNodeId) + '=>' + String(row.targetNodeId));
const positiveNative = qualifyCiiMethodATerminalContinuation(s1Graph,targetGraph,s1Loop.loop,sourceSpan);
assert.deepEqual(asPairs(positiveNative.nodeRows).sort(),
  ['3830=>860','4960=>1060'].sort(),
  'pre-projection compareLocked Method A source diagnostic: ' + JSON.stringify({
    method:s1Loop.loop.method, confidence:s1Loop.loop.confidence,
    geometry:s1Loop.loop.geometry?.status, spanStatus:sourceSpan.status,
    gateStatus:sourceSpan.pathGate?.status, regions:positiveNative.regions,
  }));
assert.deepEqual(negativeRows(s1Graph,targetGraph,{ ...s1Loop.loop,confidence:'REVIEW' },sourceSpan),[],
  'unqualified base confidence must not create terminal ownership');
assert.deepEqual(negativeRows(s1Graph,targetGraph,{ ...s1Loop.loop,geometry:{status:'AMBIGUOUS'} },sourceSpan),[],
  'ambiguous registration cannot be used as NODE identity');
assert.deepEqual(negativeRows(s1Graph,targetGraph,s1Loop.loop,{...sourceSpan,status:'UNRESOLVED'}),[],
  'unready span cannot propagate exterior identity');
assert.deepEqual(negativeRows(s1Graph,targetGraph,s1Loop.loop,
  {...sourceSpan,pathGate:{status:'BLOCKED'}}),[],
  'blocked topology/path gate cannot propagate exterior identity');
const startId = String(sourceSpan.sourcePath.startNode);
const fakeSourceBranch = { elementId:'REC03_SYNTHETIC_SOURCE_BRANCH',from:startId,to:'REC03_FAKE_S',
  lengthMm:100,diameter:273 };
const branchedSource = { ...s1Graph, adjacency:new Map(s1Graph.adjacency) };
branchedSource.adjacency.set(startId,[...s1Graph.adjacency.get(startId),fakeSourceBranch]);
assert.equal(asPairs(negativeRows(branchedSource,targetGraph,s1Loop.loop,sourceSpan))
  .includes('3830=>860'),false,'source root branch must halt exterior propagation');
const target860 = targetGraph.nodes.find((item) => String(item.id) === '860');
assert(target860?.position, 'retained T860 position required for synthetic nearby competitor');
const competingTarget = {...targetGraph,nodes:[...targetGraph.nodes,
  {id:'REC03_TARGET_COLLISION',position:{...target860.position}}]};
assert.equal(asPairs(negativeRows(s1Graph,competingTarget,s1Loop.loop,sourceSpan))
  .includes('3830=>860'),false,'two co-located TARGET NODEs cannot silently win');
const claimed = {...sourceSpan,nodeRows:[...sourceSpan.nodeRows,
  {kind:'NODE',status:'REVIEW',sourceNodeId:'REC03_OTHER_SOURCE',targetNodeId:'860'}]};
assert.equal(asPairs(negativeRows(s1Graph,targetGraph,s1Loop.loop,claimed))
  .includes('3830=>860'),false,'already claimed TARGET cannot be reassigned');
const endId = String(sourceSpan.targetPath.endNode);
const fakeTargetBranch = {elementId:'REC03_SYNTHETIC_TARGET_BRANCH',
  from:endId,to:'REC03_FAKE_T',lengthMm:100,diameter:273};
const branchedTarget = {...targetGraph,adjacency:new Map(targetGraph.adjacency)};
branchedTarget.adjacency.set(endId,[...targetGraph.adjacency.get(endId),fakeTargetBranch]);
assert.equal(asPairs(negativeRows(s1Graph,branchedTarget,s1Loop.loop,sourceSpan))
  .includes('4960=>1060'),false,'TARGET root branch must halt exterior propagation');

// An off-route TARGET EDGE is a real alternative even when the selected
// TARGET anchor's outgoing adjacency remains unique. A singleton candidate
// list would incorrectly bind 3830 here; competing spatial edges must veto.
const selected860 = positiveNative.nodeRows.find((row) => String(row.sourceNodeId) === '3830');
assert(selected860?.evidence?.terminalStep?.targetElementId);
const primaryEdge = targetGraph.edges.find((edge) =>
  String(edge.elementId) === selected860.evidence.terminalStep.targetElementId);
assert(primaryEdge, 'retained physical target edge for 3830 required');
const cloneEdge = (n) => ({ ...primaryEdge, elementId: 'REC03_COMPETING_OFF_ROUTE_EDGE_' + n });
const offRouteCandidate = { ...targetGraph, edges: [...targetGraph.edges, cloneEdge(1)] };
const challenged = qualifyCiiMethodATerminalContinuation(s1Graph, offRouteCandidate, s1Loop.loop, sourceSpan);
assert.equal(asPairs(challenged.nodeRows).includes('3830=>860'), false,
  'spatially competing off-route target EDGE must veto singleton assumption');
const challengedStart = challenged.regions.find((row) => row.side === 'START');
assert.equal(challengedStart.steps[0]?.spatialCandidateCount, 2,
  'candidate set must contain chosen and off-route physical TARGET edges');
assert.equal(challengedStart.steps[0]?.candidateStatus, 'AMBIGUOUS',
  'two equally qualified candidate elements must trigger real winner-gap veto');
const manyCompetitors = { ...targetGraph,
  edges: [...targetGraph.edges, ...Array.from({length:33}, (_,i)=>cloneEdge(i+1))] };
const overflow = qualifyCiiMethodATerminalContinuation(s1Graph, manyCompetitors, s1Loop.loop, sourceSpan);
assert.equal(asPairs(overflow.nodeRows).includes('3830=>860'), false,
  'bounded candidate overflow must fail closed instead of truncating challengers');
assert.equal(overflow.regions.find((row)=>row.side==='START').steps[0]?.spatialCandidateSetStatus,
  'SPATIAL_CANDIDATE_SET_OVERFLOW');


const extracted = trial.memberPreviews.map(({sourceId,preview}) => ({
  sourceId,
  correspondenceStatus: preview.correspondence?.status,
  regions: (preview.multiBaseCorrespondence?.loopResults || []).flatMap(({loop,correspondence}) =>
    loop.method === 'METHOD_A_SPATIAL' ? (correspondence.methodATerminalContinuation?.regions || []) : []),
  proposed: (preview.multiBaseCorrespondence?.loopResults || []).flatMap(({loop,correspondence}) =>
    loop.method === 'METHOD_A_SPATIAL'
      ? (correspondence.methodATerminalContinuation?.nodeRows || []).map(({sourceNodeId,targetNodeId}) =>
          ({sourceNodeId,targetNodeId})) : []),
}));
const discovered = extracted.flatMap(({sourceId,proposed}) => proposed.map(({sourceNodeId,targetNodeId}) =>
  [sourceId, String(sourceNodeId), String(targetNodeId)]));
const payload = {
  schema: 'CiiMethodATerminalContinuationOptInQualification.v1',
  baseline: before.summary, trial: after.summary,
  combinedStatus: trial.correspondence?.status,
  combinedConflicts: trial.correspondence?.conflicts || [],
  discovered, expected, members: extracted,
  expectedRows: expected.map(([sourceId,sourceNodeId,targetNodeId]) => {
    const row = after.rows.find((candidate) => candidate.rowKey === sourceId + ':' + sourceNodeId);
    return {sourceId,sourceNodeId,targetNodeId,state:row?.state || 'MISSING',
      actualTargetId:row?.targetNodeId || null,confidence:row?.confidence || null,
      reasons:row?.reasons || []};
  }),
};
const dir = fileURLToPath(new URL('../test-results/cii-method-a-qualification/', import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'terminal-optin.json'), JSON.stringify(payload,null,2) + '\n', 'utf8');
console.log(JSON.stringify(payload,null,2));

assert.equal(before.summary.totalSourceNodes, 150);
assert.equal(after.summary.totalSourceNodes, 150);
assert.equal(trial.correspondence?.status, 'READY', 'opt-in terminal stage must never introduce target conflicts');
assert.equal(trial.correspondence?.conflicts?.length, 0);
assert.deepEqual(discovered.sort((a,b)=>a.join('|').localeCompare(b.join('|'))),
  expected.sort((a,b)=>a.join('|').localeCompare(b.join('|'))),
  'only six strict, registered M1+M2+OD exterior pairs may emit');
for(const [sourceId,sourceNodeId,targetNodeId] of expected) {
  const row = after.rows.find((candidate) => candidate.rowKey === sourceId + ':' + sourceNodeId);
  const terminal = trial.memberPreviews.find((member)=>member.sourceId === sourceId)?.preview
    ?.multiBaseCorrespondence?.loopResults?.filter(({loop})=>loop.method==='METHOD_A_SPATIAL')
    .flatMap(({correspondence})=>correspondence.methodATerminalContinuation?.nodeRows || [])
    .find((item)=>String(item.sourceNodeId)===sourceNodeId);
  assert(terminal?.evidence?.terminalCandidate?.status==='SUPPORTED');
  assert.equal(terminal.evidence.terminalStep.spatialCandidateCount,
    terminal.evidence.terminalCandidate.candidateCount,
    'candidate arbitration must include all spatially eligible physical elements');
  assert.equal(row?.state, 'BOUND', sourceId + ':' + sourceNodeId + ' physically qualified terminal must be BOUND');
  assert.equal(String(row?.targetNodeId), targetNodeId);
  assert.equal(row.confidence, sourceId === 'S2' ? 'HIGH' : 'MEDIUM',
    'selected Method A base ceiling must be preserved');
}
for(const row of before.rows.filter((item)=>item.state==='BOUND')) {
  const next = after.rows.find((candidate)=>candidate.rowKey===row.rowKey);
  assert.equal(next?.state, 'BOUND', row.rowKey + ' baseline identity regression');
  assert.equal(next?.targetNodeId, row.targetNodeId);
  assert.equal(next?.confidence, row.confidence);
}
assert.equal(after.summary.BOUND, before.summary.BOUND + 6, 'only independently qualified terminal nodes may be recovered');
assert.equal(after.summary.UNRESOLVED, before.summary.UNRESOLVED);
assert.equal(after.summary.UNEMITTED, before.summary.UNEMITTED - 6);
console.log('CII authentic Method A terminal opt-in exact-pair qualification: PASS');
