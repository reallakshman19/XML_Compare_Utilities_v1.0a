import assert from 'node:assert/strict';
import {
  SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ENTRIES,
  SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_IDS,
  SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_TRUST_BOUNDARY,
  assertSequentialDraftEdit3dLimitationRegister,
  createSequentialDraftEdit3dLimitationOwnershipAttestation,
  createSequentialDraftEdit3dLimitationRegister,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-3d-limitation-register.js';
import { sequentialSemanticFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';

const expectedIds = [
  'NO_STRUCTURAL_TOPOLOGY_APPLICATION',
  'NO_GEOMETRY_OR_SUPPORT_PERSISTENCE_IN_PORTABLE_PACKAGE',
  'NO_HETEROGENEOUS_ATOMIC_TRANSACTION',
  'NO_UNRESTRICTED_MULTI_SELECTION',
  'NO_AUTOMATIC_TOPOLOGY_REPAIR',
  'ENGINEERING_DEMO_ONLY',
];

const register = createSequentialDraftEdit3dLimitationRegister();
const repeated = createSequentialDraftEdit3dLimitationRegister();
const attestation = createSequentialDraftEdit3dLimitationOwnershipAttestation();

assert.equal(register.schema, 'SequentialDraftEdit3dLimitationRegister.v1');
assert.equal(register.workPack, 'SSK-3D-P0-D');
assert.equal(register.registerStatus, 'OPEN');
assert.equal(register.entryCount, 6);
assert.deepEqual(SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_IDS, expectedIds);
assert.deepEqual(register.entries, SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_ENTRIES);
assert.deepEqual(register.entries.map((entry) => entry.limitationId), expectedIds);
assert.equal(new Set(expectedIds).size, expectedIds.length);
assert.equal(JSON.stringify(repeated), JSON.stringify(register));
assert.equal(repeated.registerFingerprint, register.registerFingerprint);
assert.deepEqual(register.ownershipAttestation, attestation);
assert.equal(attestation.profile, 'SEMANTIC_FINGERPRINT_ROLE_ATTESTATION');
assert.equal(attestation.assignments.length, expectedIds.length);
assert.deepEqual(attestation.trustBoundary, SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_TRUST_BOUNDARY);
assert.equal(attestation.trustBoundary.signerIdentity, 'NOT_ESTABLISHED');
assert.equal(attestation.trustBoundary.organizationalAuthority, 'NOT_ESTABLISHED');
assert.equal(attestation.trustBoundary.productionApproval, 'NOT_ESTABLISHED');
assert.equal(Object.isFrozen(register), true);
assert.equal(Object.isFrozen(register.entries), true);
assert.equal(Object.isFrozen(register.ownershipAttestation), true);

for (const entry of register.entries) {
  for (const key of ['limitationId', 'accountableRole', 'operationalContainment',
    'evidenceRequirement', 'exitGate']) {
    assert.equal(typeof entry[key], 'string');
    assert.ok(entry[key].length > 0, `${entry.limitationId}.${key} must be present`);
  }
}

const mutable = structuredClone(register);
const asserted = assertSequentialDraftEdit3dLimitationRegister(mutable);
assert.deepEqual(asserted, register);
assert.notEqual(asserted, mutable);
assert.equal(Object.isFrozen(asserted), true);

function refingerprintAttestation(value) {
  const base = { ...value };
  delete base.attestationFingerprint;
  value.attestationFingerprint = sequentialSemanticFingerprint('SSK3DLIMITATIONATTESTATION', base);
}
function refingerprintRegister(value) {
  const base = { ...value };
  delete base.registerFingerprint;
  value.registerFingerprint = sequentialSemanticFingerprint('SSK3DLIMITATIONREGISTER', base);
}

const forgedOwner = structuredClone(register);
forgedOwner.entries[0].accountableRole = 'UNAUTHORIZED_OWNER';
forgedOwner.ownershipAttestation.assignments[0].accountableRole = 'UNAUTHORIZED_OWNER';
refingerprintAttestation(forgedOwner.ownershipAttestation);
refingerprintRegister(forgedOwner);
assert.throws(() => assertSequentialDraftEdit3dLimitationRegister(forgedOwner));

const forgedTrust = structuredClone(register);
forgedTrust.ownershipAttestation.trustBoundary.signerIdentity = 'VERIFIED';
refingerprintAttestation(forgedTrust.ownershipAttestation);
refingerprintRegister(forgedTrust);
assert.throws(() => assertSequentialDraftEdit3dLimitationRegister(forgedTrust));

const forgedExitGate = structuredClone(register);
forgedExitGate.entries[5].exitGate = 'Release immediately.';
refingerprintRegister(forgedExitGate);
assert.throws(() => assertSequentialDraftEdit3dLimitationRegister(forgedExitGate));

console.log('[PASS] deterministic owner-attested limitation register and trust boundary');
