/** Workspace package v3 carrying durable support and geometry edit authority. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { sequentialWorkspacePackageFingerprint } from './sequential-workspace-package.js';
import {
  SEQUENTIAL_WORKSPACE_PACKAGE_V2_READER_REVISION,
  SEQUENTIAL_WORKSPACE_PACKAGE_V2_SCHEMA,
  createSequentialWorkspacePackageV2,
  restoreSequentialWorkspacePackageV2,
} from './sequential-workspace-package-v2.js';
import {
  assertSequentialDraftEditPackageExtension,
  restoreSequentialDraftEditPackageExtension,
} from './sequential-draft-edit-package-extension.js';

export const SEQUENTIAL_WORKSPACE_PACKAGE_V3_SCHEMA = 'SequentialWorkspacePackage.v3';
export const SEQUENTIAL_WORKSPACE_PACKAGE_V3_REVISION = 3;
export const SEQUENTIAL_WORKSPACE_PACKAGE_V3_READER_REVISION = 3;

function fail(code, detail = '', Constructor = RangeError) {
  const error = new Constructor(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code;
  throw error;
}
function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function parsed(input) {
  if (typeof input !== 'string') return clone(input);
  try { return JSON.parse(input); }
  catch (error) { fail('WORKSPACE_PACKAGE_V3_JSON_INVALID', error.message, TypeError); }
}
function withoutFingerprint(value) {
  const { packageFingerprint: ignored, ...payload } = value;
  void ignored;
  return payload;
}
function v2Payload(value) {
  const {
    draftEditExtension: ignoredExtension,
    packageFingerprint: ignoredFingerprint,
    ...payload
  } = value;
  void ignoredExtension;
  void ignoredFingerprint;
  const v2 = {
    ...payload,
    schema: SEQUENTIAL_WORKSPACE_PACKAGE_V2_SCHEMA,
    revision: 2,
    minimumReaderRevision: SEQUENTIAL_WORKSPACE_PACKAGE_V2_READER_REVISION,
  };
  return { ...v2, packageFingerprint: sequentialWorkspacePackageFingerprint(v2) };
}
function extensionMatchesAuthority(extension, authority) {
  return extension.sourceFingerprint === authority?.sourceFingerprint
    && extension.branchSetFingerprint === authority?.currentBranchSetFingerprint
    && (extension.commandJournalHeadFingerprint || null)
      === (authority?.journalHeadFingerprint || null);
}
function packageMaterial(options) {
  const base = createSequentialWorkspacePackageV2(options);
  const extension = assertSequentialDraftEditPackageExtension(options.draftEditExtension);
  if (!extensionMatchesAuthority(extension, base.commandAuthority)) {
    fail('WORKSPACE_PACKAGE_V3_EDIT_AUTHORITY_STALE');
  }
  return {
    ...withoutFingerprint(base),
    schema: SEQUENTIAL_WORKSPACE_PACKAGE_V3_SCHEMA,
    revision: SEQUENTIAL_WORKSPACE_PACKAGE_V3_REVISION,
    minimumReaderRevision: SEQUENTIAL_WORKSPACE_PACKAGE_V3_READER_REVISION,
    draftEditExtension: extension,
  };
}
function validateEnvelope(value) {
  if (!value || typeof value !== 'object') fail('WORKSPACE_PACKAGE_V3_INVALID', '', TypeError);
  if (value.schema !== SEQUENTIAL_WORKSPACE_PACKAGE_V3_SCHEMA
    || value.revision !== SEQUENTIAL_WORKSPACE_PACKAGE_V3_REVISION) {
    fail('WORKSPACE_PACKAGE_V3_SCHEMA_INVALID');
  }
  if (!Number.isSafeInteger(value.minimumReaderRevision)
    || value.minimumReaderRevision < 1
    || value.minimumReaderRevision > SEQUENTIAL_WORKSPACE_PACKAGE_V3_READER_REVISION) {
    fail('WORKSPACE_PACKAGE_V3_READER_UNSUPPORTED');
  }
  const expected = sequentialWorkspacePackageFingerprint(value);
  if (value.packageFingerprint !== expected) fail('WORKSPACE_PACKAGE_V3_FINGERPRINT_MISMATCH');
}
function restorationMaterial(value, base, draftEdit) {
  return {
    ...base,
    packageFingerprint: value.packageFingerprint,
    packageSchema: value.schema,
    packageRevision: value.revision,
    minimumReaderRevision: value.minimumReaderRevision,
    draftEditExtension: draftEdit,
  };
}

export function createSequentialWorkspacePackageV3(options = {}) {
  const material = packageMaterial(options);
  return immutableJson({
    ...material,
    packageFingerprint: sequentialWorkspacePackageFingerprint(material),
  }, 'Sequential workspace package v3');
}
export function serializeSequentialWorkspacePackageV3(options = {}) {
  return JSON.stringify(createSequentialWorkspacePackageV3(options), null, 2);
}
export function restoreSequentialWorkspacePackageV3(input) {
  const value = parsed(input);
  validateEnvelope(value);
  const base = restoreSequentialWorkspacePackageV2(v2Payload(value));
  const draftEdit = restoreSequentialDraftEditPackageExtension(value.draftEditExtension, base);
  return immutableJson(restorationMaterial(value, base, draftEdit),
    'Sequential workspace restoration v3 package');
}
