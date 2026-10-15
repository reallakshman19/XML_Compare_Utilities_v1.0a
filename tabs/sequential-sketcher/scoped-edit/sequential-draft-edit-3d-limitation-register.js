/** Immutable owner-attested known-limitation register for Sequential Draft Edit 3D. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';

export const SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_REGISTER_SCHEMA =
  'SequentialDraftEdit3dLimitationRegister.v1';
export const SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ATTESTATION_SCHEMA =
  'SequentialDraftEdit3dLimitationOwnershipAttestation.v1';

const ENTRY_MATERIAL = [
  {
    limitationId: 'NO_STRUCTURAL_TOPOLOGY_APPLICATION',
    accountableRole: 'STRUCTURAL_TOPOLOGY_AUTHORITY_OWNER',
    operationalContainment: 'Keep structural-impact operations preview-only and reject topology publication.',
    evidenceRequirement: 'Qualified structural-topology prepare, review, acceptance, publication and rollback evidence.',
    exitGate: 'A versioned topology journal and qualified application path are released.',
  },
  {
    limitationId: 'NO_GEOMETRY_OR_SUPPORT_PERSISTENCE_IN_PORTABLE_PACKAGE',
    accountableRole: 'PORTABLE_PACKAGE_PERSISTENCE_OWNER',
    operationalContainment: 'Treat geometry and support edits as workspace-only evidence and do not claim portable restoration.',
    evidenceRequirement: 'Versioned package schema, migrations, round-trip tests and stale-artifact invalidation evidence.',
    exitGate: 'Portable save, load and migration qualification covers geometry and support authority.',
  },
  {
    limitationId: 'NO_HETEROGENEOUS_ATOMIC_TRANSACTION',
    accountableRole: 'COMPOSITE_TRANSACTION_AUTHORITY_OWNER',
    operationalContainment: 'Do not present cross-layer operations as atomic and fail before partial publication.',
    evidenceRequirement: 'Composite prepare, acceptance, commit, rollback and receipt evidence across authority layers.',
    exitGate: 'A qualified composite transaction coordinator provides deterministic rollback.',
  },
  {
    limitationId: 'NO_UNRESTRICTED_MULTI_SELECTION',
    accountableRole: 'ENGINEERING_INTERACTION_OWNER',
    operationalContainment: 'Permit only qualified single-target or explicitly bounded selection operations.',
    evidenceRequirement: 'Deterministic multi-selection contracts, conflict rules and browser qualification evidence.',
    exitGate: 'Qualified multi-selection behavior is released for the approved operation set.',
  },
  {
    limitationId: 'NO_AUTOMATIC_TOPOLOGY_REPAIR',
    accountableRole: 'TOPOLOGY_REPAIR_POLICY_OWNER',
    operationalContainment: 'Require supervised decisions and never silently infer or publish topology repair.',
    evidenceRequirement: 'Approved repair policy, deterministic preview, operator acceptance and rollback evidence.',
    exitGate: 'Automatic repair policies are approved, bounded, auditable and qualified.',
  },
  {
    limitationId: 'ENGINEERING_DEMO_ONLY',
    accountableRole: 'SSK_3D_RELEASE_OWNER',
    operationalContainment: 'Restrict use to controlled engineering demonstration and prohibit production release claims.',
    evidenceRequirement: 'Completed Phase 0 evidence, controlled walkthrough record and explicit release-gate decision.',
    exitGate: 'All Phase 0 gates close and an approved internal-pilot release decision is recorded.',
  },
];

export const SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ENTRIES =
  immutableJson(ENTRY_MATERIAL, 'Sequential Draft Edit 3D limitation entries');
export const SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_IDS = Object.freeze(
  SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ENTRIES.map((entry) => entry.limitationId),
);
export const SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_TRUST_BOUNDARY = immutableJson({
  contentIntegrity: 'ESTABLISHED_BY_CANONICAL_FINGERPRINT',
  signerIdentity: 'NOT_ESTABLISHED',
  organizationalAuthority: 'NOT_ESTABLISHED',
  certificateTrust: 'NOT_ESTABLISHED',
  productionApproval: 'NOT_ESTABLISHED',
}, 'Sequential Draft Edit 3D limitation trust boundary');

function fail(message, Constructor = RangeError) { throw new Constructor(message); }
function assignments(entries = SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ENTRIES) {
  return entries.map((entry) => ({
    limitationId: entry.limitationId,
    accountableRole: entry.accountableRole,
  }));
}
function attestationMaterial(entries = SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ENTRIES) {
  return {
    schema: SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ATTESTATION_SCHEMA,
    profile: 'SEMANTIC_FINGERPRINT_ROLE_ATTESTATION',
    accountableRole: 'SSK_3D_RELEASE_OWNER',
    statement: 'The listed authority roles own containment and exit-gate evidence for every open limitation.',
    assignments: assignments(entries),
    trustBoundary: SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_TRUST_BOUNDARY,
  };
}
function registerMaterial() {
  return {
    schema: SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_REGISTER_SCHEMA,
    workPack: 'SSK-3D-P0-D',
    registerStatus: 'OPEN',
    entryCount: SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ENTRIES.length,
    entries: SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ENTRIES,
    ownershipAttestation: createSequentialDraftEdit3dLimitationOwnershipAttestation(),
  };
}
function entriesAreComplete(entries) {
  return Array.isArray(entries) && entries.every((entry) => [
    entry?.limitationId,
    entry?.accountableRole,
    entry?.operationalContainment,
    entry?.evidenceRequirement,
    entry?.exitGate,
  ].every((value) => typeof value === 'string' && value.length > 0));
}
function invariant(register) {
  try {
    const ids = register.entries?.map((entry) => entry.limitationId) || [];
    return register.workPack === 'SSK-3D-P0-D'
      && register.registerStatus === 'OPEN'
      && register.entryCount === SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ENTRIES.length
      && new Set(ids).size === ids.length
      && entriesAreComplete(register.entries)
      && JSON.stringify(register.entries) === JSON.stringify(SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ENTRIES)
      && JSON.stringify(register.ownershipAttestation)
        === JSON.stringify(createSequentialDraftEdit3dLimitationOwnershipAttestation());
  } catch { return false; }
}

export function createSequentialDraftEdit3dLimitationOwnershipAttestation() {
  const base = attestationMaterial();
  return immutableJson({
    ...base,
    attestationFingerprint: sequentialSemanticFingerprint('SSK3DLIMITATIONATTESTATION', base),
  }, 'Sequential Draft Edit 3D limitation ownership attestation');
}

export function createSequentialDraftEdit3dLimitationRegister() {
  const base = registerMaterial();
  return immutableJson({
    ...base,
    registerFingerprint: sequentialSemanticFingerprint('SSK3DLIMITATIONREGISTER', base),
  }, 'Sequential Draft Edit 3D limitation register');
}

export function assertSequentialDraftEdit3dLimitationRegister(value) {
  const register = immutableJson(value, 'Sequential Draft Edit 3D limitation register');
  if (register.schema !== SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_REGISTER_SCHEMA) {
    fail(`Limitation register must use ${SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_REGISTER_SCHEMA}.`, TypeError);
  }
  const { registerFingerprint, ...base } = register;
  const attestation = register.ownershipAttestation;
  const { attestationFingerprint, ...attestationBase } = attestation || {};
  if (attestationFingerprint !== sequentialSemanticFingerprint('SSK3DLIMITATIONATTESTATION', attestationBase)
    || registerFingerprint !== sequentialSemanticFingerprint('SSK3DLIMITATIONREGISTER', base)
    || !invariant(register)) {
    fail('Limitation register differs from the qualified owner-attested limitation inventory.');
  }
  return register;
}
