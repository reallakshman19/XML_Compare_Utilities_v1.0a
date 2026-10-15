import {
  SEQUENTIAL_WORKSPACE_PACKAGE_SCHEMA,
  createSequentialWorkspacePackage,
  restoreSequentialWorkspacePackage,
  sequentialWorkspacePackageFingerprint,
} from './sequential-workspace-package.js';
import {
  SEQUENTIAL_WORKSPACE_PACKAGE_V2_SCHEMA,
  createSequentialWorkspacePackageV2,
  restoreSequentialWorkspacePackageV2,
} from './sequential-workspace-package-v2.js';
import {
  SEQUENTIAL_WORKSPACE_PACKAGE_V3_SCHEMA,
  createSequentialWorkspacePackageV3,
  restoreSequentialWorkspacePackageV3,
} from './sequential-workspace-package-v3.js';
import { validateSequentialWorkspaceApplicationReceipt } from './sequential-workspace-application-receipt.js';
import { validateSequentialCommandJournalState } from '../scoped-edit/sequential-command-journal.js';

function fail(code, detail = '') { throw new Error(`${code}${detail ? `: ${detail}` : ''}`); }
function cloneJson(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function validatedReceipts(values = []) {
  return Object.freeze(values.map((receipt, index) => validateSequentialWorkspaceApplicationReceipt(receipt, index)));
}
function validatedJournalState(value) {
  const errors = validateSequentialCommandJournalState(value);
  if (errors.length) fail('WORKSPACE_COMMAND_JOURNAL_INVALID', errors.join('; '));
  return value;
}
function basePackage(options) {
  if (options.draftEditExtension) {
    if (options.journalState === null || options.journalState === undefined) {
      fail('WORKSPACE_DRAFT_EDIT_JOURNAL_REQUIRED');
    }
    return createSequentialWorkspacePackageV3({
      ...options,
      journalState: validatedJournalState(options.journalState),
    });
  }
  if (options.journalState === null || options.journalState === undefined) {
    return createSequentialWorkspacePackage(options);
  }
  return createSequentialWorkspacePackageV2({
    ...options,
    journalState: validatedJournalState(options.journalState),
  });
}
function parsedPackage(input) {
  if (typeof input !== 'string') return cloneJson(input);
  try { return JSON.parse(input); }
  catch (error) { fail('WORKSPACE_PACKAGE_RECEIPTS_JSON_INVALID', error.message); }
}
function authoritativeRestoration(raw) {
  if (raw?.schema === SEQUENTIAL_WORKSPACE_PACKAGE_SCHEMA) return restoreSequentialWorkspacePackage(raw);
  if (raw?.schema === SEQUENTIAL_WORKSPACE_PACKAGE_V2_SCHEMA) return restoreSequentialWorkspacePackageV2(raw);
  if (raw?.schema === SEQUENTIAL_WORKSPACE_PACKAGE_V3_SCHEMA) return restoreSequentialWorkspacePackageV3(raw);
  fail('WORKSPACE_PACKAGE_SCHEMA_UNSUPPORTED');
}

export function createSequentialWorkspacePackageWithReceipts(options = {}) {
  const base = basePackage(options);
  const receipts = validatedReceipts(options.applicationReceipts || []);
  const { packageFingerprint: ignored, ...payload } = cloneJson(base);
  void ignored;
  const withReceipts = { ...payload, applicationReceipts: cloneJson(receipts) };
  return Object.freeze({
    ...withReceipts,
    packageFingerprint: sequentialWorkspacePackageFingerprint(withReceipts),
  });
}
export function serializeSequentialWorkspacePackageWithReceipts(options = {}) {
  return JSON.stringify(createSequentialWorkspacePackageWithReceipts(options), null, 2);
}
export function restoreSequentialWorkspacePackageWithReceipts(input) {
  const raw = parsedPackage(input);
  const restoration = authoritativeRestoration(raw);
  const applicationReceipts = validatedReceipts(raw.applicationReceipts || []);
  return Object.freeze({
    ...restoration,
    packageSchema: raw.schema,
    packageRevision: raw.revision,
    applicationReceipts,
  });
}
