import { sha256CiiByteString } from './cii-workspace-byte-sha256.js';
import {
  createFindReplaceOperation,
  FIND_REPLACE_CSV_MODES,
  parseFindReplaceCsv,
} from './cii-workspace-find-replace-csv.js';
import { qualifyFindReplaceOutputCandidate } from './cii-workspace-find-replace-output.js';
import {
  buildFindReplacePreview,
  setFindReplaceRowDecision,
  summarizeFindReplacePreview,
} from './cii-workspace-find-replace-preview.js';
import { validateFindReplacePreimage } from './cii-workspace-find-replace-validator.js';
import { buildValidatedFindReplacePostimage } from './cii-workspace-find-replace-executor.js';

const MODES = new Set(Object.values(FIND_REPLACE_CSV_MODES));
const APPLIED_TO_NEW_COPY = 'APPLIED_TO_NEW_COPY';

function freezeRelease(release) {
  if (!release) return null;
  return Object.freeze({
    ...release,
    receipt: release.receipt ? Object.freeze({ ...release.receipt }) : null,
  });
}

function freezeSession(session) {
  return Object.freeze({
    ...session,
    rows: Object.freeze([...(session.rows || [])]),
    errors: Object.freeze([...(session.errors || [])]),
    qualification: session.qualification ? Object.freeze(session.qualification) : null,
    release: freezeRelease(session.release),
  });
}

function normalizedMode(value) {
  const mode = String(value || '').trim().toUpperCase();
  if (!MODES.has(mode)) throw new TypeError(`Unsupported Find & Replace mode: ${value}`);
  return mode;
}

function versionSection(text) {
  const lines = String(text ?? '').split(/\r\n|\n|\r/);
  const start = lines.findIndex((line) => /^\s*#\$\s*VERSION\s*$/i.test(line));
  if (start < 0) return '';
  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*#\$\s*/.test(lines[index])) break;
    body.push(lines[index]);
  }
  return body.join('\n');
}

function versionFromRecord(section) {
  const firstLine = String(section || '').split(/\r\n|\n|\r/, 1)[0] || '';
  const values = firstLine.trim().split(/\s+/).map(Number);
  if (values.length < 2 || !Number.isFinite(values[1])) return null;
  const rounded = Math.round(values[1]);
  return Math.abs(values[1] - rounded) <= 1e-6 ? rounded : null;
}

export function detectFindReplaceCiiVersion(text) {
  const section = versionSection(text);
  const recordVersion = versionFromRecord(section);
  if (recordVersion !== null) return recordVersion;
  const banner = section.match(/Neutral\s+file\s+interface\s+Ver\s+(\d+(?:\.\d+)?)/i);
  return banner ? Number(banner[1]) : null;
}

export function createFindReplaceSession() {
  return freezeSession({
    mode: FIND_REPLACE_CSV_MODES.DOCUMENT,
    target: null,
    csv: null,
    rows: [],
    status: 'EMPTY',
    errors: [],
    qualification: null,
    release: null,
  });
}

function invalidate(session, overrides = {}) {
  return freezeSession({
    ...session,
    ...overrides,
    qualification: null,
    release: null,
  });
}

export function withFindReplaceTarget(session, input = {}) {
  const text = String(input.text ?? '');
  const version = detectFindReplaceCiiVersion(text);
  const target = Object.freeze({
    name: String(input.name || 'target.cii'),
    text,
    version,
    hash: sha256CiiByteString(text),
  });
  return invalidate(session, {
    target,
    status: version === 14 ? 'TARGET_READY' : 'TARGET_VERSION_BLOCKED',
    errors: version === 14 ? [] : [`TARGET_V14_REQUIRED:${version ?? 'UNKNOWN'}`],
  });
}

export function withFindReplaceCsv(session, input = {}) {
  const mode = normalizedMode(input.mode || session.mode);
  const text = String(input.text ?? '');
  const parsed = parseFindReplaceCsv(text, mode);
  return invalidate(session, {
    mode,
    csv: Object.freeze({ name: String(input.name || 'find-replace.csv'), text, status: parsed.status }),
    rows: buildFindReplacePreview(parsed.operations),
    status: parsed.status === 'INVALID' ? 'CSV_INVALID' : 'PREVIEW_READY',
    errors: [...parsed.errors],
  });
}

export function withFindReplaceMode(session, mode) {
  const nextMode = normalizedMode(mode);
  if (session.csv?.text) return withFindReplaceCsv(session, { ...session.csv, mode: nextMode });
  return invalidate(session, { mode: nextMode, rows: [], status: session.target ? 'TARGET_READY' : 'EMPTY', errors: [] });
}

export function appendFindReplaceManualRow(session, input = {}) {
  const operation = createFindReplaceOperation(input, session.mode, { source: 'MANUAL' });
  return invalidate(session, {
    rows: buildFindReplacePreview([...(session.rows || []), operation]),
    status: 'PREVIEW_READY',
    errors: [],
  });
}

function withoutSequence(row) {
  const { sequence, ...candidate } = row || {};
  return candidate;
}

function editorStatus(session, rows) {
  const targetBlocked = Boolean(session.target && session.target.version !== 14);
  if (targetBlocked) return 'TARGET_VERSION_BLOCKED';
  if (rows.length) return 'PREVIEW_READY';
  return session.target ? 'TARGET_READY' : 'EMPTY';
}

export function replaceFindReplaceManualRows(session, inputs = []) {
  const retained = (session.rows || [])
    .filter((row) => row.source !== 'MANUAL')
    .map(withoutSequence);
  const manual = (inputs || []).map((input) => createFindReplaceOperation(input, session.mode, { source: 'MANUAL' }));
  const rows = buildFindReplacePreview([...retained, ...manual]);
  const targetBlocked = Boolean(session.target && session.target.version !== 14);
  const csvInvalid = session.csv?.status === 'INVALID';
  const targetErrors = targetBlocked ? [`TARGET_V14_REQUIRED:${session.target.version ?? 'UNKNOWN'}`] : [];
  return invalidate(session, {
    rows,
    status: targetBlocked
      ? 'TARGET_VERSION_BLOCKED'
      : csvInvalid
        ? 'CSV_INVALID'
        : rows.length
          ? 'PREVIEW_READY'
          : session.target
            ? 'TARGET_READY'
            : 'EMPTY',
    errors: targetBlocked ? targetErrors : csvInvalid ? [...session.errors] : [],
  });
}

export function replaceFindReplaceEditorRows(session, inputs = []) {
  const operations = (inputs || []).map((input) => createFindReplaceOperation(input, session.mode, {
    source: input?.source || 'MANUAL',
    rowNumber: input?.rowNumber ?? null,
  }));
  const rows = buildFindReplacePreview(operations);
  const targetBlocked = Boolean(session.target && session.target.version !== 14);
  const targetErrors = targetBlocked ? [`TARGET_V14_REQUIRED:${session.target.version ?? 'UNKNOWN'}`] : [];
  return invalidate(session, {
    rows,
    csv: null,
    status: editorStatus(session, rows),
    errors: targetErrors,
  });
}

export function decideFindReplaceRow(session, sequence, decision) {
  return invalidate(session, {
    rows: setFindReplaceRowDecision(session.rows, sequence, decision),
    status: 'PREVIEW_READY',
    errors: [],
  });
}

export function approveAllFindReplaceRows(session) {
  let rows = session.rows;
  for (const row of session.rows) {
    if (row.status === 'PROPOSED') rows = setFindReplaceRowDecision(rows, row.sequence, 'APPROVED');
  }
  return invalidate(session, { rows, status: 'PREVIEW_READY', errors: [] });
}

export function resetFindReplaceDecisions(session) {
  let rows = session.rows;
  for (const row of session.rows) {
    if (row.status === 'APPROVED' || row.status === 'REJECTED') rows = setFindReplaceRowDecision(rows, row.sequence, 'PROPOSED');
  }
  return invalidate(session, { rows, status: 'PREVIEW_READY', errors: [] });
}

export function qualifyFindReplaceSession(session) {
  const blockers = [];
  if (!session.target) blockers.push('TARGET_CII_REQUIRED');
  if (session.target && session.target.version !== 14) blockers.push(`TARGET_V14_REQUIRED:${session.target.version ?? 'UNKNOWN'}`);
  const summary = summarizeFindReplacePreview(session.rows);
  if (!summary.readyForTransaction) blockers.push('REVIEW_NOT_COMPLETE');
  if (blockers.length) return freezeSession({ ...session, status: 'QUALIFICATION_BLOCKED', errors: blockers, qualification: null, release: null });

  const approved = session.rows.filter((row) => row.status === 'APPROVED');
  const preimage = validateFindReplacePreimage(session.target.text, approved);
  if (preimage.status !== 'PASS') {
    return freezeSession({
      ...session,
      status: 'VALIDATION_FAILED',
      errors: [...preimage.blockers],
      qualification: { preimage, postimage: null },
      release: null,
    });
  }

  const postimage = buildValidatedFindReplacePostimage(session.target.text, preimage);
  return freezeSession({
    ...session,
    status: postimage.status === 'QUALIFIED_POSTIMAGE' ? 'QUALIFIED_PREVIEW' : 'POSTIMAGE_BLOCKED',
    errors: [...(postimage.blockers || [])],
    qualification: { preimage, postimage },
    release: null,
  });
}

export function applyFindReplaceToNewCopy(session) {
  if (session?.status !== 'QUALIFIED_PREVIEW') {
    return freezeSession({ ...session, status: 'APPLY_TO_NEW_COPY_BLOCKED', errors: ['QUALIFIED_PREVIEW_REQUIRED'], release: null });
  }
  if (session.release?.status === APPLIED_TO_NEW_COPY) return session;
  const output = qualifyFindReplaceOutputCandidate(session);
  if (output.status !== 'READY_FOR_APPLY_TO_NEW_COPY') {
    return freezeSession({ ...session, status: 'APPLY_TO_NEW_COPY_BLOCKED', errors: [...output.blockers], release: null });
  }
  return freezeSession({
    ...session,
    errors: [],
    release: {
      status: APPLIED_TO_NEW_COPY,
      targetHash: output.artifact.receipt.targetHash,
      receipt: output.artifact.receipt,
    },
  });
}

export function summarizeFindReplaceSession(session) {
  const preview = summarizeFindReplacePreview(session.rows);
  const qualified = session.status === 'QUALIFIED_PREVIEW';
  const appliedToNewCopy = qualified && session.release?.status === APPLIED_TO_NEW_COPY;
  return Object.freeze({
    ...preview,
    mode: session.mode,
    targetLoaded: Boolean(session.target),
    targetVersion: session.target?.version ?? null,
    sourceHash: session.target?.hash ?? null,
    canValidate: session.target?.version === 14 && preview.readyForTransaction,
    qualified,
    appliedToNewCopy,
    canApply: false,
    canApplyToNewCopy: qualified && !appliedToNewCopy,
    canDownload: appliedToNewCopy,
  });
}

export { FIND_REPLACE_CSV_MODES };
