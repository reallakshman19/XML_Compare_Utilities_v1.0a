/** Workspace migration and transitions for current and historical offline transfer archives. */
import { deepFreeze } from './revision-contract-utils.js';
import {
  completeRevisionCompareTransferArchiveState, createRevisionCompareTransferArchiveState,
  failRevisionCompareTransferArchiveState, revisionCompareTransferArchiveAuthorityMatches,
  revisionCompareTransferArchiveStateForReadiness, staleRevisionCompareTransferArchiveState,
} from './revision-transfer-archive-state.js';

export const REVISION_COMPARE_TRANSFER_ARCHIVE_WORKSPACE_SCHEMA = 'RevisionCompareWorkspaceState.v13';
const WORKSPACE_SCHEMA_PATTERN = /^RevisionCompareWorkspaceState\.v(\d+)$/;
function workspaceSchemaVersion(schema) {
  const match = WORKSPACE_SCHEMA_PATTERN.exec(String(schema ?? ''));
  return match ? Number(match[1]) : 0;
}
function archiveWorkspaceSchema(state) {
  return workspaceSchemaVersion(state?.schema) > 13
    ? state.schema : REVISION_COMPARE_TRANSFER_ARCHIVE_WORKSPACE_SCHEMA;
}
export function adoptRevisionCompareTransferArchiveWorkspace(state) {
  const schema = archiveWorkspaceSchema(state);
  if (state?.schema === schema && state.transferArchive) return state;
  return deepFreeze({
    ...state, schema,
    transferArchive: state?.transferArchive ?? revisionCompareTransferArchiveStateForReadiness(state),
  });
}
function nextArchive(previous, next) {
  const prior = previous?.transferArchive ?? createRevisionCompareTransferArchiveState();
  return prior.artifact
    ? staleRevisionCompareTransferArchiveState(prior)
    : revisionCompareTransferArchiveStateForReadiness(next);
}
export function reconcileRevisionCompareTransferArchiveAfterAuthorityChange(previous, next) {
  const adopted = adoptRevisionCompareTransferArchiveWorkspace(next);
  const transferArchive = nextArchive(previous, adopted);
  return transferArchive === adopted.transferArchive ? adopted : deepFreeze({ ...adopted, transferArchive });
}
export function completeWorkspaceTransferArchive(state, captured, artifact) {
  const adopted = adoptRevisionCompareTransferArchiveWorkspace(state);
  if (!revisionCompareTransferArchiveAuthorityMatches(captured, adopted)) {
    const prior = staleRevisionCompareTransferArchiveState(adopted.transferArchive);
    return deepFreeze({
      ...adopted,
      transferArchive: failRevisionCompareTransferArchiveState(
        'Offline transfer archive authority changed during creation. Create the archive again.', prior,
      ),
    });
  }
  return deepFreeze({ ...adopted, transferArchive: completeRevisionCompareTransferArchiveState(artifact, adopted) });
}
export function failWorkspaceTransferArchive(state, error) {
  const adopted = adoptRevisionCompareTransferArchiveWorkspace(state);
  return deepFreeze({ ...adopted, transferArchive: failRevisionCompareTransferArchiveState(error, adopted.transferArchive) });
}
export const _test = Object.freeze({ nextArchive });
