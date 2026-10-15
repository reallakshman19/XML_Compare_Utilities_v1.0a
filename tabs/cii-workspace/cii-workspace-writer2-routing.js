import { deepFreeze } from './cii-workspace-contracts.js';
import {
  buildCiiWriter2NodeNameRelocationPlan, CII_WRITER_2_NODENAME_RELOCATION_POLICY,
} from './cii-workspace-writer2-nodename-relocation.js';

const NODE_NAME_PROPERTY = 'Node name / to-name';
const NODE_NAME_EVIDENCE = 'CII_NODENAME_FIXED_LAYOUT';
const WRITER_2_OTHER_FAMILY_POLICY = 'CII_WRITER_2_PHASE1_NODENAME_ONLY';

function text(value) { return String(value ?? '').trim(); }
function statusFrom(blockers) { return blockers.length ? 'BLOCKED' : 'PREVIEW_READY'; }
function writer2Mutation(operation) {
  return operation?.family === 'NODE_NAME' && operation?.property === NODE_NAME_PROPERTY
    && ['CREATE', 'DELETE'].includes(operation?.action) && operation?.status === 'PREVIEW_READY'
    && operation?.policyAuthority === CII_WRITER_2_NODENAME_RELOCATION_POLICY;
}
function operationSummary(operations) {
  const byAction = {};
  for (const operation of operations || []) byAction[operation.action || 'UNKNOWN'] = (byAction[operation.action || 'UNKNOWN'] || 0) + 1;
  return deepFreeze({
    operationCount: (operations || []).length,
    previewReadyCount: (operations || []).filter((item) => item.status === 'PREVIEW_READY').length,
    writer2MutationCount: (operations || []).filter(writer2Mutation).length,
    blockedCount: (operations || []).filter((item) => item.status === 'BLOCKED').length,
    protectedCount: (operations || []).filter((item) => item.status === 'PROTECTED').length,
    byAction: deepFreeze(byAction),
  });
}
function nodeNameOperation(operation) {
  const source = text(operation?.sourceEvidence?.value ?? operation?.proposed);
  const target = text(operation?.targetEvidence?.value ?? operation?.before);
  const blockers = [];
  if (!String(operation?.evidenceAuthority || operation?.sourceEvidence?.authority || '').includes(NODE_NAME_EVIDENCE)) {
    blockers.push('WRITER_2_NODENAME_FIXED_LAYOUT_AUTHORITY_REQUIRED');
  }
  if (source && !target) {
    return deepFreeze({
      ...operation, action: 'CREATE', status: statusFrom(blockers), blockers: deepFreeze(blockers),
      before: '', proposed: source, policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY,
    });
  }
  if (!source && target) {
    return deepFreeze({
      ...operation, action: 'DELETE', status: statusFrom(blockers), blockers: deepFreeze(blockers),
      before: target, proposed: '', policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY,
    });
  }
  if (source && target && source !== target) {
    blockers.push('WRITER_2_NODENAME_OVERWRITE_USE_WRITER_1C');
    return deepFreeze({
      ...operation, action: 'BLOCKED', status: 'BLOCKED', blockers: deepFreeze(blockers),
      before: target, proposed: source, policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY,
    });
  }
  return deepFreeze({ ...operation, action: 'KEEP', status: statusFrom(blockers), blockers: deepFreeze(blockers) });
}
function routeOperation(operation) {
  if (operation?.family === 'NODE_NAME' && operation?.property === NODE_NAME_PROPERTY) return nodeNameOperation(operation);
  if (operation?.action === 'KEEP') return operation;
  const blockers = [...(operation?.blockers || []), 'WRITER_2_PHASE1_NODENAME_ONLY'];
  return deepFreeze({
    ...operation, action: 'BLOCKED', status: 'BLOCKED', blockers: deepFreeze([...new Set(blockers)]),
    policyAuthority: WRITER_2_OTHER_FAMILY_POLICY,
  });
}

export function applyCiiWriter2NodeNamePlanContract(plan) {
  if (!plan) return plan;
  const operations = deepFreeze((plan.operations || []).map(routeOperation));
  const summary = operationSummary(operations);
  const blockers = (plan.blockers || []).filter((item) => item !== 'NO_TRANSFERABLE_PREVIEW_OPERATIONS');
  if (!summary.writer2MutationCount) blockers.push('NO_WRITER_2_NODENAME_TRANSFERABLE_OPERATIONS');
  const uniqueBlockers = deepFreeze([...new Set(blockers)]);
  return deepFreeze({
    ...plan,
    mutationAuthority: uniqueBlockers.length ? 'BLOCKED' : 'WRITER_2_NODENAME_RELOCATION_CONDITIONAL',
    operations,
    status: uniqueBlockers.length ? 'BLOCKED' : 'PREVIEW_READY',
    blockers: uniqueBlockers,
    summary,
    policy: deepFreeze({
      ...(plan.policy || {}),
      geometryProtected: true,
      nodeNumberProtected: true,
      topologyProtected: true,
      nodeNameMutation: 'CREATE_DELETE_RELOCATION_ONLY',
      nodeNameOverwrite: 'WRITER_1C_ONLY',
      processDefault: 'BLOCKED_WRITER_2_PHASE1',
      restraintCardinality: 'BLOCKED_WRITER_2_PHASE1',
      sifTeeMutation: 'BLOCKED_WRITER_2_PHASE1',
      hangerMutation: 'BLOCKED_WRITER_2_PHASE1',
    }),
  });
}

export function ciiWriter2NodeNameReadiness(transferPlan, targetDocument) {
  const relocationPlan = buildCiiWriter2NodeNameRelocationPlan({ targetDocument, transferPlan });
  return deepFreeze({
    schema: 'CIIWorkspaceWriter2NodeNameReadiness.v1',
    status: relocationPlan.ready ? 'READY' : 'BLOCKED',
    ready: relocationPlan.ready,
    mutationCount: relocationPlan.operationCount,
    mutationOperationCount: relocationPlan.operationCount,
    blockers: relocationPlan.blockers,
    relocationPlan,
  });
}

export const _test = Object.freeze({ text, writer2Mutation, operationSummary, nodeNameOperation, routeOperation });
