/** Backward-compatible workspace package v2 carrying accepted-command authority. */
import { immutableJson, isIsoTimestamp } from '../../../contracts/contract-values.js';
import { createConfirmedSequentialConstruction } from '../construction/sequential-construction-acceptance.js';
import { createSequentialBranchWorkspaceRegistry } from '../sequential-branch-workspace-state.js';
import { buildConfirmedConstructionSupportProjection } from '../support/sequential-confirmed-support-projection.js';
import {
  SEQUENTIAL_WORKSPACE_PACKAGE_SCHEMA,
  createSequentialWorkspacePackage,
  restoreSequentialWorkspacePackage,
  sequentialWorkspacePackageFingerprint,
} from './sequential-workspace-package.js';
import {
  SEQUENTIAL_WORKSPACE_COMMAND_AUTHORITY_READER_REVISION,
  createSequentialWorkspaceCommandAuthority,
  restoreSequentialWorkspaceCommandAuthority,
} from './sequential-workspace-command-authority.js';

export const SEQUENTIAL_WORKSPACE_PACKAGE_V2_SCHEMA = 'SequentialWorkspacePackage.v2';
export const SEQUENTIAL_WORKSPACE_RESTORATION_V2_SCHEMA = 'SequentialWorkspaceRestoration.v2';
export const SEQUENTIAL_WORKSPACE_PACKAGE_V2_REVISION = 2;
export const SEQUENTIAL_WORKSPACE_PACKAGE_V2_READER_REVISION = 2;

const SUPPORT_OPTIONS = Object.freeze({
  projectionToleranceMm: 50,
  onCenterlineToleranceMm: 0.001,
  ambiguityToleranceMm: 1,
});

function fail(code, detail = '') {
  throw new Error(`${code}${detail ? `: ${detail}` : ''}`);
}
function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
function requiredCreatedAt(value) {
  if (!isIsoTimestamp(value)) fail('WORKSPACE_PACKAGE_V2_CREATED_AT_INVALID');
  return value;
}
function parsedPackage(input) {
  if (typeof input !== 'string') return cloneJson(input);
  try { return JSON.parse(input); }
  catch (error) { fail('WORKSPACE_PACKAGE_V2_JSON_INVALID', error.message); }
}
function downstream(session, indexes) {
  if (session?.state !== 'ROUTE_COMPLETE') {
    return Object.freeze({ confirmedConstruction: null, supportProjection: null });
  }
  const confirmedConstruction = createConfirmedSequentialConstruction(session, indexes);
  const supportProjection = buildConfirmedConstructionSupportProjection(
    confirmedConstruction, indexes, SUPPORT_OPTIONS,
  );
  return Object.freeze({ confirmedConstruction, supportProjection });
}
function normalizedRegistry(branchIds, workspaces, indexes) {
  const registry = createSequentialBranchWorkspaceRegistry();
  const rows = workspaces.map((row) => {
    const session = row?.snapshot?.session;
    if (!session) fail('WORKSPACE_PACKAGE_V2_SESSION_MISSING', row?.branchId);
    return Object.freeze({
      branchId: row.branchId,
      snapshot: Object.freeze({
        session,
        ...downstream(session, indexes),
        selectedCandidateId: row.snapshot.selectedCandidateId || '',
      }),
    });
  });
  registry.replace(branchIds, rows);
  return registry;
}
function explicitV1Package(options) {
  const createdAt = requiredCreatedAt(options.createdAt);
  const generated = createSequentialWorkspacePackage(options);
  const { packageFingerprint: ignored, ...payload } = cloneJson(generated);
  void ignored;
  const explicit = { ...payload, createdAt };
  const result = { ...explicit, packageFingerprint: sequentialWorkspacePackageFingerprint(explicit) };
  const restoration = restoreSequentialWorkspacePackage(result);
  return Object.freeze({ packageValue: result, restoration });
}
function v1Payload(value) {
  const {
    commandAuthority: ignoredAuthority,
    minimumReaderRevision: ignoredReader,
    packageFingerprint: ignoredFingerprint,
    ...payload
  } = value;
  void ignoredAuthority;
  void ignoredReader;
  void ignoredFingerprint;
  const legacy = { ...payload, schema: SEQUENTIAL_WORKSPACE_PACKAGE_SCHEMA, revision: 1 };
  return { ...legacy, packageFingerprint: sequentialWorkspacePackageFingerprint(legacy) };
}

export function createSequentialWorkspacePackageV2(options = {}) {
  const prepared = explicitV1Package(options);
  const base = prepared.packageValue;
  const authorityRegistry = normalizedRegistry(
    prepared.restoration.branchIds,
    prepared.restoration.workspaces,
    prepared.restoration.indexes,
  );
  const commandAuthority = createSequentialWorkspaceCommandAuthority({
    journalState: options.journalState,
    sourceFingerprint: base.source.sourceFingerprint,
    branchRegistry: authorityRegistry,
  });
  const { packageFingerprint: ignored, ...basePayload } = cloneJson(base);
  void ignored;
  const payload = {
    ...basePayload,
    schema: SEQUENTIAL_WORKSPACE_PACKAGE_V2_SCHEMA,
    revision: SEQUENTIAL_WORKSPACE_PACKAGE_V2_REVISION,
    minimumReaderRevision: SEQUENTIAL_WORKSPACE_PACKAGE_V2_READER_REVISION,
    commandAuthority,
  };
  return immutableJson({
    ...payload,
    packageFingerprint: sequentialWorkspacePackageFingerprint(payload),
  }, 'Sequential workspace package v2');
}

export function serializeSequentialWorkspacePackageV2(options = {}) {
  return JSON.stringify(createSequentialWorkspacePackageV2(options), null, 2);
}

export function restoreSequentialWorkspacePackageV2(input) {
  const value = parsedPackage(input);
  if (!value || typeof value !== 'object') fail('WORKSPACE_PACKAGE_V2_INVALID');
  if (value.schema !== SEQUENTIAL_WORKSPACE_PACKAGE_V2_SCHEMA
    || value.revision !== SEQUENTIAL_WORKSPACE_PACKAGE_V2_REVISION) {
    fail('WORKSPACE_PACKAGE_V2_SCHEMA_INVALID');
  }
  if (!Number.isSafeInteger(value.minimumReaderRevision) || value.minimumReaderRevision < 1) {
    fail('WORKSPACE_PACKAGE_V2_READER_INVALID');
  }
  if (value.minimumReaderRevision > SEQUENTIAL_WORKSPACE_PACKAGE_V2_READER_REVISION) {
    fail('WORKSPACE_PACKAGE_V2_READER_UNSUPPORTED');
  }
  const expected = sequentialWorkspacePackageFingerprint(value);
  if (value.packageFingerprint !== expected) fail('WORKSPACE_PACKAGE_V2_FINGERPRINT_MISMATCH');
  const restoration = restoreSequentialWorkspacePackage(v1Payload(value));
  const registry = normalizedRegistry(restoration.branchIds, restoration.workspaces, restoration.indexes);
  const workspaces = registry.entries();
  const commandAuthority = restoreSequentialWorkspaceCommandAuthority(value.commandAuthority, {
    ...restoration,
    workspaces,
  });
  if (commandAuthority.readerRevision !== SEQUENTIAL_WORKSPACE_COMMAND_AUTHORITY_READER_REVISION) {
    fail('WORKSPACE_PACKAGE_V2_COMMAND_AUTHORITY_REVISION_INVALID');
  }
  return Object.freeze({
    ...restoration,
    schema: SEQUENTIAL_WORKSPACE_RESTORATION_V2_SCHEMA,
    packageFingerprint: value.packageFingerprint,
    packageSchema: value.schema,
    packageRevision: value.revision,
    minimumReaderRevision: value.minimumReaderRevision,
    workspaces,
    commandAuthority,
    journalState: commandAuthority.journalState,
  });
}
