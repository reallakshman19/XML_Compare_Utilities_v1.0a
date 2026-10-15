import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createSequentialConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { sequentialSessionFingerprint } from '../tabs/sequential-sketcher/construction/sequential-session-fingerprint.js';
import {
  createSequentialWorkspacePackage,
  restoreSequentialWorkspacePackage,
  sequentialSourceRecordsFingerprint,
  sequentialWorkspacePackageFingerprint,
} from '../tabs/sequential-sketcher/persistence/sequential-workspace-package.js';
import {
  createSequentialWorkspacePackageV2,
  restoreSequentialWorkspacePackageV2,
} from '../tabs/sequential-sketcher/persistence/sequential-workspace-package-v2.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialNativeCommand,
  sequentialSemanticFingerprint,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';
import {
  createSequentialCommandService,
  createSequentialJournalAdoption,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';

const CREATED_AT = '2026-07-27T04:29:00.000Z';
const ADOPTED_AT = '2026-07-27T04:30:00.000Z';
const ISSUED_AT = '2026-07-27T04:31:00.000Z';
const COMPLETED_AT = '2026-07-27T04:32:00.000Z';
const BRANCH_ID = '/PKG/V2/AUTHORITY';

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function pipe(name, start, end) { return { type: 'PIPE', name, attributes: { APOS: start, LPOS: end } }; }
function branch(name, children) {
  return { type: 'BRANCH', name, attributes: { NAME: name, HPOS: { x: 0, y: 0, z: 0 } }, children };
}
function ownerRevision(token) {
  return Object.freeze({ revision: Object.freeze({ schema: 'EngineeringRevisionToken.v1', token }) });
}
function refreshAuthorityFingerprint(value) {
  const { authorityFingerprint: ignored, ...material } = value.commandAuthority;
  void ignored;
  value.commandAuthority.authorityFingerprint = sequentialSemanticFingerprint('SWPKGAUTH', material);
}
function refreshPackageFingerprint(value) {
  value.packageFingerprint = sequentialWorkspacePackageFingerprint(value);
  return value;
}
function packageOptions(fixture) {
  return {
    records: fixture.records,
    evidence: fixture.evidence,
    branchRegistry: fixture.branchRegistry,
    activeBranchId: BRANCH_ID,
    journalState: fixture.state.journalState,
    createdAt: CREATED_AT,
  };
}
function buildAcceptedFixture() {
  const records = [branch(BRANCH_ID, [
    pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ])];
  const evidence = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidence);
  const sourceFingerprint = sequentialSourceRecordsFingerprint(records);
  const branchRegistry = createSequentialBranchWorkspaceRegistry();
  branchRegistry.reset([BRANCH_ID]);
  branchRegistry.save(BRANCH_ID, { session: createSequentialConstructionSession(BRANCH_ID) });
  let state = {
    sourceFingerprint, evidence, indexes, branchRegistry,
    session: branchRegistry.get(BRANCH_ID).session,
    journalState: createSequentialJournalAdoption({
      documentId: `sequential-document:${sourceFingerprint}`,
      sessionId: `sequential-session:${sourceFingerprint}`,
      sourceFingerprint, branchRegistry, adoptedAt: ADOPTED_AT,
    }),
    confirmedConstruction: null, supportProjection: null,
    ownerSnapshot: ownerRevision('PKG-V2-REV-0'), engineOptions: {},
  };
  const service = createSequentialCommandService({
    readCurrentState: () => state,
    publishCandidate({ candidate, expectedAuthority, preparedId }) {
      branchRegistry.replace(branchRegistry.ids(), candidate.branchEntries);
      state = {
        ...state, session: candidate.session,
        confirmedConstruction: candidate.confirmedConstruction,
        supportProjection: candidate.supportProjection,
        journalState: candidate.journalState,
        ownerSnapshot: ownerRevision(sequentialSemanticFingerprint('PKGV2REV', {
          preparedId,
          sessionFingerprint: sequentialSessionFingerprint(candidate.session),
          authorityId: expectedAuthority.authorityId,
        })),
      };
      return Object.freeze({
        schema: 'SequentialCommandPublication.v1', committed: true, preparedId,
        expectedAuthorityId: expectedAuthority.authorityId,
      });
    },
  });
  const execution = service.execute({
    command: { commandType: 'ADVANCE_ONE', branchId: BRANCH_ID },
    origin: { kind: 'USER', actorId: 'PACKAGE_V2_TEST', issuedAt: ISSUED_AT },
  });
  assert.equal(execution.acceptance.accepted, true);
  const completion = service.execute({
    command: { commandType: 'RUN_UNTIL_BLOCKED', branchId: BRANCH_ID },
    origin: { kind: 'USER', actorId: 'PACKAGE_V2_TEST', issuedAt: COMPLETED_AT },
  });
  assert.equal(completion.acceptance.accepted, true);
  assert.equal(state.session.state, 'ROUTE_COMPLETE');
  return { records, evidence, indexes, branchRegistry, state };
}
function tamper(packageValue, mutate, refreshAuthority = false) {
  const value = clone(packageValue);
  mutate(value);
  if (refreshAuthority) refreshAuthorityFingerprint(value);
  return refreshPackageFingerprint(value);
}
function expectCode(value, code) {
  assert.throws(() => restoreSequentialWorkspacePackageV2(value), new RegExp(code));
}

const first = buildAcceptedFixture();
const second = buildAcceptedFixture();
const firstInputs = {
  records: clone(first.records),
  journalState: clone(first.state.journalState),
  registryEntries: clone(first.branchRegistry.entries()),
};
assert.throws(() => createSequentialWorkspacePackageV2({ ...packageOptions(first), createdAt: undefined }),
  /WORKSPACE_PACKAGE_V2_CREATED_AT_INVALID/);
const packageV2 = createSequentialWorkspacePackageV2(packageOptions(first));
const equivalentPackage = createSequentialWorkspacePackageV2(packageOptions(second));
assert.deepEqual(packageV2, equivalentPackage);
assert.equal(packageV2.createdAt, CREATED_AT);
assert.equal(packageV2.schema, 'SequentialWorkspacePackage.v2');
assert.equal(packageV2.revision, 2);
assert.equal(packageV2.minimumReaderRevision, 2);
assert.equal(Object.hasOwn(packageV2.commandAuthority, 'branchSetFingerprint'), false);
assert.notEqual(packageV2.commandAuthority.adoptionBranchSetFingerprint,
  packageV2.commandAuthority.currentBranchSetFingerprint);
assert.equal(packageV2.commandAuthority.journalState.journal.entries.length, 2);
assert.equal(packageV2.commandAuthority.journalState.journal.entries[0].commandType, 'ADVANCE_ONE');
assert.equal(first.state.journalState.journal.entries[0].transactionId,
  first.state.session.transactionLedger[0].transactionId);
assert.equal(Object.hasOwn(packageV2.workspaces[0], 'confirmedConstruction'), false);
assert.equal(Object.hasOwn(packageV2.workspaces[0], 'supportProjection'), false);
assert.deepEqual(first.records, firstInputs.records);
assert.deepEqual(first.state.journalState, firstInputs.journalState);
assert.deepEqual(first.branchRegistry.entries(), firstInputs.registryEntries);

const restoreInput = clone(packageV2);
const restoreInputBefore = clone(restoreInput);
const restored = restoreSequentialWorkspacePackageV2(restoreInput);
assert.deepEqual(restoreInput, restoreInputBefore);
assert.equal(restored.schema, 'SequentialWorkspaceRestoration.v2');
assert.equal(restored.packageFingerprint, packageV2.packageFingerprint);
assert.deepEqual(restored.journalState, packageV2.commandAuthority.journalState);
assert.equal(restored.commandAuthority.journalHeadFingerprint,
  packageV2.commandAuthority.journalHeadFingerprint);
const restoredLedger = restored.workspaces[0].snapshot.session.transactionLedger;
for (const entry of restored.journalState.journal.entries) {
  assert(restoredLedger.some((transaction) => transaction.transactionId === entry.transactionId));
}
assert(restored.workspaces[0].snapshot.confirmedConstruction);
assert(restored.workspaces[0].snapshot.supportProjection);
assert(restored.indexes.branches instanceof Map);
assert(restored.indexes.components instanceof Map);
assert(restored.indexes.ports instanceof Map);

expectCode(tamper(packageV2, (value) => { value.minimumReaderRevision = 3; }),
  'WORKSPACE_PACKAGE_V2_READER_UNSUPPORTED');
expectCode(tamper(packageV2, (value) => { value.commandAuthority.minimumReaderRevision = 3; }),
  'WORKSPACE_COMMAND_AUTHORITY_READER_UNSUPPORTED');
expectCode(tamper(packageV2, (value) => {
  value.commandAuthority.journalState.journal.entries[0].basis.documentHash = 'SOURCE-MISMATCH';
}), 'WORKSPACE_COMMAND_SOURCE_BASIS_MISMATCH');
expectCode(tamper(packageV2, (value) => {
  value.commandAuthority.journalState.journal.entries[0].payload.commandType = 'MALFORMED';
}), 'WORKSPACE_COMMAND_NATIVE_IDENTITY_INVALID');
expectCode(tamper(packageV2, (value) => {
  value.commandAuthority.journalState.journal.entries[0].payload.nativeCommandId = 'SNATIVE-TAMPER';
}), 'WORKSPACE_COMMAND_NATIVE_IDENTITY_INVALID');
expectCode(tamper(packageV2, (value) => {
  const entry = value.commandAuthority.journalState.journal.entries[0];
  entry.payload = createSequentialNativeCommand({ ...entry.payload, branchId: '/UNKNOWN' });
}), 'WORKSPACE_COMMAND_BRANCH_UNKNOWN');
expectCode(tamper(packageV2, (value) => {
  value.commandAuthority.journalState.journal.entries[0].transactionId = 'TXN-UNKNOWN';
}), 'WORKSPACE_COMMAND_TRANSACTION_UNKNOWN');
expectCode(tamper(packageV2, (value) => {
  value.commandAuthority.journalState.journal.entries[0].transactionId = '';
}), 'WORKSPACE_COMMAND_TRANSACTION_UNKNOWN');
expectCode(tamper(packageV2, (value) => {
  value.commandAuthority.journalState.journal.activeCommandIds = ['CJ-UNKNOWN'];
}), 'WORKSPACE_COMMAND_JOURNAL_INVALID');
expectCode(tamper(packageV2, (value) => {
  value.commandAuthority.adoptionBranchSetFingerprint = 'ADOPTION-TAMPER';
}, true), 'WORKSPACE_COMMAND_AUTHORITY_EVIDENCE_MISMATCH: adoptionBranchSetFingerprint');
expectCode(tamper(packageV2, (value) => {
  value.commandAuthority.currentBranchSetFingerprint = 'CURRENT-TAMPER';
}, true), 'WORKSPACE_COMMAND_AUTHORITY_EVIDENCE_MISMATCH: currentBranchSetFingerprint');
const outerTamper = clone(packageV2);
outerTamper.packageFingerprint = 'PACKAGE-TAMPER';
expectCode(outerTamper, 'WORKSPACE_PACKAGE_V2_FINGERPRINT_MISMATCH');
expectCode(tamper(packageV2, (value) => {
  value.commandAuthority.authorityFingerprint = 'AUTHORITY-TAMPER';
}), 'WORKSPACE_COMMAND_AUTHORITY_FINGERPRINT_MISMATCH');

const legacy = createSequentialWorkspacePackage({
  records: first.records,
  evidence: first.evidence,
  branchRegistry: first.branchRegistry,
  activeBranchId: BRANCH_ID,
});
assert.equal(legacy.schema, 'SequentialWorkspacePackage.v1');
assert.equal(restoreSequentialWorkspacePackage(legacy).schema, 'SequentialWorkspaceRestoration.v1');

const productionPaths = [
  '../tabs/sequential-sketcher/persistence/sequential-workspace-command-authority.js',
  '../tabs/sequential-sketcher/persistence/sequential-workspace-package-v2.js',
];
for (const relative of productionPaths) {
  const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
  assert(source.split(/\r?\n/).length < 300);
  assert.doesNotMatch(source, /export\s+default|module\.exports/);
  assert.doesNotMatch(source, /from\s+['"][^'"]*(?:controller|markup|canvas|svg|sequential-sketcher-workspace)[^'"]*['"]/i);
  assert.doesNotMatch(source, /compatibility\s+shim|hidden\s+fallback|default\s+mock|silent\s+downgrade/i);
}
const testSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
assert(testSource.split(/\r?\n/).length < 300);
console.log('sequential workspace command-authority package v2 tests passed');
