import { alignElementPaths } from '../model-converters/xml-cii-inputxml-path-aligner.js';
import { deepFreeze } from './cii-workspace-contracts.js';
import { ciiAlignmentScore } from './cii-workspace-evidence.js';

export function buildCiiPathCandidateAudit(sourceGraph, targetGraph, options = {}) {
  const result = alignElementPaths(sourceGraph, targetGraph, { ...options, scoreElementMatch: ciiAlignmentScore });
  return deepFreeze({
    schema: 'CIIWorkspacePathCandidateAudit.v1',
    referencePathRows: result.referencePathRows,
    targetPathRows: result.targetPathRows,
    pathMappings: result.pathMappings,
    alignmentRows: result.alignmentRows,
    pathConflicts: result.pathConflicts,
    summary: result.summary,
  });
}
