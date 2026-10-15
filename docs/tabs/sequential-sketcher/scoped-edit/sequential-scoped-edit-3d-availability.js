/** Read-only availability and visible status classification for Sequential Draft Edit 3D. */
export const SEQUENTIAL_DRAFT_EDIT_3D_AVAILABILITY_SCHEMA =
  'SequentialDraftEdit3dAvailability.v1';

function unavailable(code, title, message, status, evidence = null) {
  return Object.freeze({ schema: SEQUENTIAL_DRAFT_EDIT_3D_AVAILABILITY_SCHEMA,
    available: false, code, title, message, status, evidence });
}

function failure(error, evidence = null) {
  const detail = error?.message || String(error || 'Certified Sequential branch shadow is unavailable.');
  const errorCode = String(error?.code || '').trim();
  const reason = errorCode ? `${errorCode}: ${detail}` : detail;
  return unavailable(evidence?.status || 'UNAVAILABLE',
    `Draft Edit 3D unavailable — ${reason}`,
    `Draft Edit 3D unavailable: ${reason}`, 'error', evidence);
}

export function classifySequentialDraftEdit3dAvailability(shadow) {
  let evidence;
  try {
    evidence = shadow.evidence();
    if (shadow.host() && shadow.readModel()) {
      return Object.freeze({ schema: SEQUENTIAL_DRAFT_EDIT_3D_AVAILABILITY_SCHEMA,
        available: true, code: 'READY', title: 'Open the certified Draft Edit 3D view',
        message: 'Draft Edit 3D ready for the current Sequential branch.',
        status: 'ready', evidence });
    }
  } catch (error) { return failure(error, evidence); }
  if (evidence?.status === 'DEGRADED') return failure(evidence.lastDiagnostic?.error, evidence);
  if (evidence?.status === 'DESTROYED') {
    return failure(new Error('Certified Sequential branch shadow has been destroyed.'), evidence);
  }
  return unavailable(evidence?.status || 'IDLE',
    'Draft Edit 3D requires an open Sequential branch',
    'Draft Edit 3D disabled: open an authoritative Sequential branch.', 'ready', evidence);
}

export function sequentialDraftEdit3dActiveMessage(entityCount) {
  const count = Number(entityCount) || 0;
  return count > 0
    ? `Draft Edit 3D active · ${count} entities · supervised geometry authority enabled.`
    : 'Draft Edit 3D active · open branch has no visible entities yet · supervised construction commands enabled.';
}

export const _test = Object.freeze({ failure, unavailable });
