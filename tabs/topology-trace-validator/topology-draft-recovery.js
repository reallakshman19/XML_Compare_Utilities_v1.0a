/** Source-bound recovery with one exclusive browser writer per Topology document. */
import { parseTopologyEditSessionDraft, serializeTopologyEditSessionDraft } from './topology-edit-session-draft.js';
export const TOPOLOGY_RECOVERY_KEY_PREFIX = 'topology-edit-recovery.v2:';
export const TOPOLOGY_RECOVERY_WRITER_PREFIX = 'topology-edit-writer.v1:';
function coded(code, message, Constructor = Error) { const error = new Constructor(message); error.code = code; return error; }
function recoveryKey(documentId) { const value = String(documentId ?? '').trim(); if (!value) throw new TypeError('Recovery documentId is required.'); return `${TOPOLOGY_RECOVERY_KEY_PREFIX}${value}`; }
function writerName(documentId) { return `${TOPOLOGY_RECOVERY_WRITER_PREFIX}${String(documentId ?? '').trim()}`; }
export async function releaseTopologyDraftAuthority(service, recovery) {
  service?.destroy();
  await recovery?.releaseWriter();
}
export function createTopologyDraftRecovery(storage, options = {}) {
  if (!storage || !['getItem', 'setItem', 'removeItem'].every((key) => typeof storage[key] === 'function')) throw new TypeError('Topology crash recovery requires a Storage-compatible adapter.');
  const lockManager = options.lockManager;
  let heldDocumentId = '', releaseHold = null, leaseTask = null;
  const load = (documentId) => { const text = storage.getItem(recoveryKey(documentId)); return text === null ? null : parseTopologyEditSessionDraft(text); };
  async function acquireWriter(documentId) {
    const value = String(documentId ?? '').trim();
    if (!value) throw new TypeError('Writer documentId is required.');
    if (heldDocumentId === value) return Object.freeze({ documentId: value, lockName: writerName(value), exclusive: true });
    if (leaseTask) throw coded('TOPOLOGY_EDIT_WRITER_UNAVAILABLE', `Another document writer is already held by this recovery adapter.`, RangeError);
    let resolveAcquired, rejectAcquired, acquiredSettled = false;
    const acquired = new Promise((resolve, reject) => { resolveAcquired = resolve; rejectAcquired = reject; });
    const hold = new Promise((resolve) => { releaseHold = resolve; });
    leaseTask = Promise.resolve(lockManager.request(writerName(value), { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock) { acquiredSettled = true; rejectAcquired(coded('TOPOLOGY_EDIT_WRITER_UNAVAILABLE', `Topology edit document ${value} already has an active writer.`, RangeError)); return; }
      heldDocumentId = value; acquiredSettled = true; resolveAcquired(); await hold;
    })).catch((error) => { if (!acquiredSettled) rejectAcquired(error); }).finally(() => {
      heldDocumentId = ''; releaseHold = null; leaseTask = null;
    });
    try { await acquired; }
    catch (error) { throw error; }
    return Object.freeze({ documentId: value, lockName: writerName(value), exclusive: true });
  }
  function requireWriter(documentId) {
    const value = String(documentId ?? '').trim();
    if (heldDocumentId !== value) throw coded('TOPOLOGY_EDIT_WRITER_UNAVAILABLE', `No exclusive Topology edit writer is held for ${value}.`, RangeError);
  }
  function accept(input = {}) {
    const documentId = String(input.documentId ?? '').trim(); requireWriter(documentId);
    if (typeof input.authorityOf !== 'function') throw new TypeError('Recovery acceptance requires authorityOf().');
    const serialized = serializeTopologyEditSessionDraft(input.nextSnapshot);
    const current = load(documentId), currentAuthorityId = current ? input.authorityOf(current) : null;
    if (currentAuthorityId !== (input.expectedAuthorityId ?? null)) return Object.freeze({ accepted: false, currentAuthorityId });
    storage.setItem(recoveryKey(documentId), serialized);
    return Object.freeze({ accepted: true, currentAuthorityId: input.nextAuthorityId });
  }
  function clear(documentId) { requireWriter(documentId); storage.removeItem(recoveryKey(documentId)); }
  async function releaseWriter() { const task = leaseTask, release = releaseHold; releaseHold = null; heldDocumentId = ''; release?.(); await task?.catch(() => {}); }
  function writerEvidence() { return Object.freeze({ documentId: heldDocumentId || null, exclusive: Boolean(heldDocumentId) }); }
  return Object.freeze({ load, acquireWriter, accept, clear, releaseWriter, writerEvidence });
}
