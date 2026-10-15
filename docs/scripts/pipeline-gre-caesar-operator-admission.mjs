import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PIPELINE_GRE_CAESAR_CASES,
  scaffoldEvidencePackage,
  verifyEvidencePackage,
  writeSha256Manifest,
} from './pipeline-gre-caesar-evidence-package.mjs';

export const PIPELINE_GRE_CAESAR_OPERATOR_ADMISSION_SCHEMA =
  'PipelineGreCaesarOperatorAdmission.v1';

const SESSION_IDENTITY_FIELDS = Object.freeze([
  'operatorId', 'workstationId', 'sessionId', 'timeZone',
]);
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const text = (value) => typeof value === 'string' ? value.trim() : '';

async function exists(target) {
  try { await fs.access(target); return true; } catch { return false; }
}

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, 'utf8'));
}

async function writeJson(target, value) {
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sessionTemplate() {
  return { operatorId: '', workstationId: '', sessionId: '', executedAt: '',
    timeZone: '', noManualXmlEdits: false };
}

function validTimestamp(value) {
  return RFC3339.test(text(value)) && Number.isFinite(Date.parse(value));
}

function validTimeZone(value) {
  const zone = text(value);
  if (!zone) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0); return true; } catch { return false; }
}

function validateSession(value, diagnostics) {
  const session = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  for (const field of SESSION_IDENTITY_FIELDS) {
    if (!text(session[field])) diagnostics.push(`OPERATOR_SESSION_FIELD_MISSING:${field}`);
  }
  if (!validTimestamp(session.executedAt)) diagnostics.push('OPERATOR_EXECUTED_AT_INVALID');
  if (!validTimeZone(session.timeZone)) diagnostics.push('OPERATOR_TIME_ZONE_INVALID');
  if (session.noManualXmlEdits !== true) diagnostics.push('NO_MANUAL_XML_EDIT_ATTESTATION_MISSING');
  return { operatorId: text(session.operatorId), workstationId: text(session.workstationId),
    sessionId: text(session.sessionId), executedAt: text(session.executedAt),
    timeZone: text(session.timeZone), noManualXmlEdits: session.noManualXmlEdits === true };
}

async function screenshotFiles(root, relative = '') {
  const target = path.join(root, relative);
  const entries = await fs.readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => compare(a.name, b.name))) {
    const next = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`SCREENSHOT_SYMBOLIC_LINK:${next.split(path.sep).join('/')}`);
    if (entry.isDirectory()) files.push(...await screenshotFiles(root, next));
    else if (entry.isFile()) files.push(next);
  }
  return files;
}

async function validateScreenshots(directory, diagnostics) {
  const root = path.join(directory, 'screenshots');
  if (!await exists(root)) { diagnostics.push('SCREENSHOT_DIRECTORY_MISSING'); return; }
  try {
    const files = await screenshotFiles(root);
    if (!files.length) diagnostics.push('SCREENSHOT_EVIDENCE_MISSING');
    for (const relative of files) {
      if ((await fs.stat(path.join(root, relative))).size === 0) {
        diagnostics.push(`SCREENSHOT_FILE_EMPTY:${relative.split(path.sep).join('/')}`);
      }
    }
  } catch (error) {
    diagnostics.push(text(error.message) || 'SCREENSHOT_EVIDENCE_INVALID');
  }
}

async function scaffoldOperatorSessions(root) {
  for (const caseId of PIPELINE_GRE_CAESAR_CASES) {
    const directory = path.join(root, caseId), target = path.join(directory, 'manifest.json');
    const manifest = await readJson(target);
    if (!manifest.operatorSession) {
      await writeJson(target, { ...manifest, operatorSession: sessionTemplate() });
      await writeSha256Manifest(directory);
    }
  }
}

function baseFailureReport(sourceCommitSha, code) {
  const cases = PIPELINE_GRE_CAESAR_CASES.map((caseId) => ({ caseId, fixtureId: '',
    status: 'REJECTED_WITH_REASON', diagnostics: [code], evidenceReady: false }));
  return buildReport({ sourceCommitSha, baseSchema: '', baseReady: false, cases,
    packageDiagnostics: [code], session: null });
}

async function augmentCase(root, item) {
  if (item.status !== 'ADMITTED') return { ...item, session: null, sessionValid: false };
  const diagnostics = [...(item.diagnostics || [])], directory = path.join(root, item.caseId);
  let session = null;
  try {
    const manifest = await readJson(path.join(directory, 'manifest.json'));
    session = validateSession(manifest.operatorSession, diagnostics);
  } catch { diagnostics.push('OPERATOR_MANIFEST_INVALID'); }
  await validateScreenshots(directory, diagnostics);
  const unique = [...new Set(diagnostics)].sort(compare);
  return { ...item, diagnostics: unique, status: unique.length ? 'REJECTED_WITH_REASON' : 'ADMITTED',
    session, sessionValid: unique.length === 0 };
}

function enforceSessionIdentity(cases, packageDiagnostics) {
  const basis = cases.find((item) => item.sessionValid === true);
  if (!basis) {
    if (cases.some((item) => item.status === 'ADMITTED')) packageDiagnostics.push('OPERATOR_SESSION_BASIS_MISSING');
    return null;
  }
  for (const item of cases.filter((candidate) => candidate.sessionValid === true)) {
    for (const field of SESSION_IDENTITY_FIELDS) {
      if (item.session[field] !== basis.session[field]) {
        item.diagnostics = [...new Set([...item.diagnostics, `OPERATOR_SESSION_CONFLICT:${field}`])].sort(compare);
        item.status = 'REJECTED_WITH_REASON';
        item.sessionValid = false;
        packageDiagnostics.push(`OPERATOR_SESSION_CONFLICT:${item.caseId}:${field}`);
      }
    }
  }
  return Object.fromEntries(SESSION_IDENTITY_FIELDS.map((field) => [field, basis.session[field]]));
}

function buildReport({ sourceCommitSha, baseSchema, baseReady, cases, packageDiagnostics, session }) {
  const outputCases = cases.map(({ session: ignored, sessionValid: ignoredValid, ...item }) => item);
  const counts = Object.fromEntries(['ADMITTED', 'REJECTED_WITH_REASON', 'MISSING']
    .map((status) => [status, outputCases.filter((item) => item.status === status).length]));
  const diagnostics = [...new Set(packageDiagnostics)].sort(compare);
  return { schema: PIPELINE_GRE_CAESAR_OPERATOR_ADMISSION_SCHEMA,
    baseSchema, expectedSourceCommitSha: sourceCommitSha, packageRoot: '.', operatorSessionIdentity: session,
    cases: outputCases, counts, packageDiagnostics: diagnostics,
    ready: baseReady === true && diagnostics.length === 0
      && counts.ADMITTED === PIPELINE_GRE_CAESAR_CASES.length };
}

export async function verifyOperatorEvidencePackage(root, sourceCommitSha, dependencies = {}) {
  const verifyBase = dependencies.verifyEvidencePackage || verifyEvidencePackage;
  let base;
  try { base = await verifyBase(root, sourceCommitSha); }
  catch (error) { return baseFailureReport(sourceCommitSha,
    `BASE_VERIFIER_FAILED:${text(error.code) || text(error.name) || 'ERROR'}`); }
  const cases = [];
  for (const item of base.cases || []) cases.push(await augmentCase(root, item));
  const packageDiagnostics = [], session = enforceSessionIdentity(cases, packageDiagnostics);
  return buildReport({ sourceCommitSha, baseSchema: base.schema || '', baseReady: base.ready === true,
    cases, packageDiagnostics, session });
}

export async function scaffoldOperatorEvidencePackage(root, sourceCommitSha, dependencies = {}) {
  const scaffoldBase = dependencies.scaffoldEvidencePackage || scaffoldEvidencePackage;
  await scaffoldBase(root, sourceCommitSha);
  await scaffoldOperatorSessions(root);
  return verifyOperatorEvidencePackage(root, sourceCommitSha, dependencies);
}


async function runCli() {
  const [command, root = 'pipeline-gre-caesar-evidence', sourceCommitSha = '', reportPath = ''] =
    process.argv.slice(2);
  if (!['scaffold', 'verify'].includes(command) || !sourceCommitSha) throw new Error(
    'Usage: scaffold <root> <source-sha> | verify <root> <source-sha> [report-path]');
  const report = command === 'scaffold'
    ? await scaffoldOperatorEvidencePackage(root, sourceCommitSha)
    : await verifyOperatorEvidencePackage(root, sourceCommitSha);
  if (reportPath) await writeJson(reportPath, report);
  else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (command === 'verify' && !report.ready) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) runCli().catch((error) => {
  process.stderr.write(`${error.message}\n`); process.exitCode = 1;
});
