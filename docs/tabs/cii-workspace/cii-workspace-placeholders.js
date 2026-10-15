import { CII_WORKSPACE_SCHEMAS, CII_WORKSPACE_STAGES, deepFreeze } from './cii-workspace-contracts.js';

function writerStage(readiness) {
  const ready = readiness?.ready === true;
  const writer = String(readiness?.schema || '').includes('Writer1B') ? 'WRITER_1B' : 'WRITER_1A';
  const blockers = readiness?.blockers?.length
    ? [...readiness.blockers]
    : ready ? [] : [`Build an approved ${writer.replace('_', ' ')} transfer plan before target mutation.`];
  return {
    schema: CII_WORKSPACE_SCHEMAS.stage,
    stageId: '06',
    capability: 'Apply to target CII',
    status: ready ? `READY_${writer}` : `BLOCKED_${writer}`,
    actionEnabled: ready,
    blockers: Object.freeze(blockers),
    nextQualificationSlice: ready ? `${writer}_EXECUTION` : `${writer}_QUALIFIED_MUTATION_AUTHORITY`,
  };
}

export function createUnavailableCiiWorkspaceStage(stageId, capability) {
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.stage,
    stageId: String(stageId), capability: String(capability), status: 'NOT_IMPLEMENTED', actionEnabled: false,
    blockers: Object.freeze([`${capability} is reserved for a later qualified CII Workspace slice.`]),
    nextQualificationSlice: 'CII_TARGET_WRITER_AUTHORITY',
  });
}

export function createCiiWorkspaceStageModel(writerReadiness = null) {
  return deepFreeze(CII_WORKSPACE_STAGES.map((stage) => {
    if (stage.id === '06') return { ...stage, ...writerStage(writerReadiness) };
    if (stage.id === '07') return {
      ...stage,
      schema: CII_WORKSPACE_SCHEMAS.stage,
      status: 'ACTIVE_AUDIT',
      actionEnabled: true,
      modifiedTargetCiiExportEnabled: writerReadiness?.ready === true,
    };
    return { ...stage, schema: CII_WORKSPACE_SCHEMAS.stage, status: 'ACTIVE', actionEnabled: true };
  }));
}

export function attemptCiiTargetApply() {
  throw new Error('USE_APPLY_CII_WORKSPACE_TARGET_WRITER_1B');
}

export function canExportModifiedTargetCii(writerReadiness = null) {
  return writerReadiness?.ready === true;
}
