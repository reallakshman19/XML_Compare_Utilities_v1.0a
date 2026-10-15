/** Exact downloadable session and scope/basis manifests without raw project data. */

import { assertJsonSafe, deepFreeze } from './revision-contract-utils.js';

export const REVISION_SESSION_MANIFEST_SCHEMA = 'RevisionSessionManifest.v1';
export const REVISION_SCOPE_MANIFEST_SCHEMA = 'RevisionScopeBasisManifest.v1';

function intakeManifest(slot) {
  return deepFreeze({
    schema: slot.schema,
    slotId: slot.slotId,
    role: slot.role,
    requestGeneration: slot.requestGeneration,
    status: slot.status,
    fileName: slot.fileName,
    fileSizeBytes: slot.fileSizeBytes,
    contentHash: slot.contentHash,
    document: slot.document,
    branchIndexSummary: slot.branchIndexSummary,
    scopeResult: slot.scopeResult,
    warnings: slot.warnings,
    blockers: slot.blockers,
    error: slot.error,
  });
}

export function createRevisionSessionManifest(state, preflight) {
  const artifact = deepFreeze({
    schema: REVISION_SESSION_MANIFEST_SCHEMA,
    session: state.session,
    revisions: {
      revA: intakeManifest(state.slots.baseline),
      revB: intakeManifest(state.slots.candidate),
    },
    preflight,
    scopeProposalId: state.proposal?.proposalId ?? null,
    scopeSummary: state.proposal?.summary ?? null,
    basisStatus: state.basisStatus,
    basisId: state.basis?.basisId ?? null,
  });
  assertJsonSafe(artifact, REVISION_SESSION_MANIFEST_SCHEMA);
  return artifact;
}

export function createRevisionScopeManifest(state, preflight) {
  if (!state.proposal) throw new Error('Scope proposal is unavailable.');
  const artifact = deepFreeze({
    schema: REVISION_SCOPE_MANIFEST_SCHEMA,
    sessionId: state.session.sessionId,
    proposal: state.proposal,
    basisStatus: state.basisStatus,
    basis: state.basis,
    preflight,
  });
  assertJsonSafe(artifact, REVISION_SCOPE_MANIFEST_SCHEMA);
  return artifact;
}

export function serializeRevisionArtifact(artifact) {
  assertJsonSafe(artifact);
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

function browserDownload(root, fileName, text, mimeType) {
  const windowRef = root?.ownerDocument?.defaultView;
  if (!windowRef?.Blob || !windowRef?.URL?.createObjectURL) throw new Error('Browser download APIs are unavailable.');
  const blob = new windowRef.Blob([text], { type: mimeType });
  const url = windowRef.URL.createObjectURL(blob);
  const anchor = root.ownerDocument.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  windowRef.URL.revokeObjectURL(url);
}

export function downloadRevisionTextArtifact(root, fileName, text, mimeType = 'text/plain;charset=utf-8') {
  browserDownload(root, fileName, String(text ?? ''), mimeType);
}

export function downloadRevisionArtifact(root, fileName, artifact) {
  downloadRevisionTextArtifact(root, fileName, serializeRevisionArtifact(artifact), 'application/json;charset=utf-8');
}

export const _test = Object.freeze({ browserDownload, intakeManifest });
