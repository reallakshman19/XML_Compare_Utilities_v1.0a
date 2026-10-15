import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { applyCiiWorkspaceTargetWriter1C } from '../tabs/cii-workspace/cii-workspace-core.js';
import { CII_WRITER_1C_NODENAME_POLICY } from '../tabs/cii-workspace/cii-workspace-writer1c-nodename.js';

function nodeCandidate(custody) {
  const byNode = new Map();
  for (const span of Object.values(custody?.bySpan || {})) {
    const ownerNodes = [...new Set((span.owners || []).map((owner) => String(owner.nodeId)))];
    for (const nodeId of ownerNodes) {
      if (!byNode.has(nodeId)) byNode.set(nodeId, []);
      byNode.get(nodeId).push(span);
    }
  }
  for (const [nodeId, spans] of byNode) {
    if (!spans.length) continue;
    if (spans.some((span) => (span.owners || []).some((owner) => String(owner.nodeId) !== nodeId))) continue;
    const values = [...new Set(spans.map((span) => String(span.value || '')))];
    if (values.length !== 1) continue;
    const proposed = values[0] === 'W1C-QUAL' ? 'W1C-QUAL2' : 'W1C-QUAL';
    if (spans.every((span) => proposed.length <= Number(span.width))) return { nodeId, spans, before: values[0], proposed };
  }
  return null;
}

const targetPath = new URL('../Benchmark/CIICompare/BM_CII_TARGET1.CII', import.meta.url);
const targetBytes = new Uint8Array(await readFile(targetPath));
const targetDocument = await intakeCiiWorkspaceDocument(targetBytes, 'BM_CII_TARGET1.CII', { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(targetDocument.writer1CByteEligible, true);
assert.equal(targetDocument.nodeNameEvidence.physicalCustody.status, 'QUALIFIED',
  `benchmark NODENAME custody blockers: ${targetDocument.nodeNameEvidence.physicalCustody.blockers.join('|')}`);

const candidate = nodeCandidate(targetDocument.nodeNameEvidence.physicalCustody);
assert(candidate, 'benchmark must contain at least one non-aliased, preimage-consistent existing NODENAME node');

const operation = Object.freeze({
  operationId: `W1C_BENCH_${candidate.nodeId}`,
  family: 'NODE_NAME', property: 'Node name / to-name', action: 'COPY', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
  policyAuthority: CII_WRITER_1C_NODENAME_POLICY,
  before: candidate.before, proposed: candidate.proposed,
  targetEvidence: Object.freeze({ identity: candidate.nodeId }),
  matchAuthority: Object.freeze({ status: 'REVIEWED' }),
});
const transferPlan = Object.freeze({
  status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze([operation]),
  transferScope: Object.freeze({ status: 'BOUND', appliedOperationIds: Object.freeze([operation.operationId]), excludedOperationIds: Object.freeze([]) }),
});
const preview = Object.freeze({
  writerVersion: '1C', targetDocument, transferPlan,
  correspondence: Object.freeze({ status: 'READY' }),
});

const applied = await applyCiiWorkspaceTargetWriter1C(preview, targetBytes, { cryptoRef: webcrypto });
assert.equal(applied.status, 'PASS');
assert.equal(applied.writer, 'WRITER_1C');
assert.equal(applied.byteLength, targetBytes.length);
assert(applied.mutationCount >= 1);
assert.equal(applied.validation.status, 'PASS');
assert.equal(applied.validation.schema, 'CIIWorkspaceWriterCompositeValidation.v2',
  'public Writer1C apply now returns the independently authorized composite validation contract');
const component = applied.validation.componentValidations?.writer1C;
assert(component && component.schema === 'CIIWorkspaceWriter1CValidation.v2',
  'Writer1C independent semantic assurance must remain present inside composite validation');
assert.equal(component.status, 'PASS');
assert.equal(component.expectedSemanticDeltaCount, 1);
assert.equal(component.actualSemanticDeltaCount, 1);
assert.equal(component.unexpectedSemanticDeltaCount, 0);
assert.equal(component.authorizedSpanCount, applied.mutationCount);
assert.equal(applied.validation.authorizedSpanCount, applied.mutationCount,
  'composite authorized-byte-span union must match Writer1C actual mutation count');
assert.equal(applied.validation.changedByteCount, component.changedByteCount,
  'both independent validators must account for the same changed-byte set');
assert(applied.validation.changedByteCount > 0);
assert(applied.validation.checks.includes('FINAL_BYTE_DIFF_SUBSET_OF_AUTHORIZED_UNION'));
assert(component.checks.includes('BYTE_DIFF_SUBSET_OF_INDEPENDENT_AUTHORIZATION'));
assert.notEqual(applied.modifiedTargetSha256, applied.sourceTargetSha256);

console.log('Writer 1C benchmark production-parser round trip passed', {
  nodeId: candidate.nodeId,
  physicalSpanCount: candidate.spans.length,
  mutationCount: applied.mutationCount,
  changedByteCount: applied.validation.changedByteCount,
});
