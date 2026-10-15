import { deepFreeze, stableId, stableStringify } from './cii-workspace-contracts.js';
import { sha256CiiByteString } from './cii-workspace-byte-sha256.js';

function rowIdentity(row) {
  return {
    correspondenceId: row.correspondenceId,
    kind: row.kind,
    status: row.status,
    authority: row.authority || '',
    sourceNodeId: row.sourceNodeId || null,
    targetNodeId: row.targetNodeId || null,
    sourceElementId: row.sourceElementId || null,
    sourceElementIds: row.sourceElementIds || [],
    targetElementIds: row.targetElementIds || [],
    sourceComponentId: row.sourceComponentId || null,
    targetComponentId: row.targetComponentId || null,
    evidence: row.evidence || null,
  };
}
function utf8ByteString(value) {
  const bytes = new TextEncoder().encode(String(value ?? '')); let result = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) result += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  return result;
}

export function bindCiiCorrespondenceIdentity(correspondence, sourceDocument, targetDocument, anchors) {
  const material = {
    sourceContentSha256: sourceDocument?.contentSha256 || '',
    targetContentSha256: targetDocument?.contentSha256 || '',
    anchors: (anchors || []).map((pair) => ({ sourceNodeId: String(pair.sourceNodeId), targetNodeId: String(pair.targetNodeId), status: pair.status || 'LOCKED' })),
    nodeRows: (correspondence?.nodeRows || []).map(rowIdentity),
    elementRows: (correspondence?.elementRows || []).map(rowIdentity),
    componentRows: (correspondence?.componentRows || []).map(rowIdentity),
    blockers: correspondence?.blockers || [],
    status: correspondence?.status || 'UNRESOLVED',
  };
  const materialSha256 = sha256CiiByteString(utf8ByteString(stableStringify(material)));
  return deepFreeze({ ...correspondence, correspondenceIdentity: stableId('correspondence-v1', materialSha256) });
}

export const _test = Object.freeze({ rowIdentity, utf8ByteString });
