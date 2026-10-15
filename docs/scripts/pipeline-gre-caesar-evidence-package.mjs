import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPipelineGreCaesarFixtureEvidence } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-fixture-evidence.js';

export const PIPELINE_GRE_CAESAR_PACKAGE_SCHEMA = 'PipelineGreCaesarEvidencePackage.v2';
export const PIPELINE_GRE_CAESAR_CASES = Object.freeze(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7']);

const COMMIT_SHA = /^[a-f0-9]{40}$/;
const BASE_FILES = Object.freeze([
  'manifest.json', 'original-export.xml', 'import-result.json', 'warnings-errors.json',
  'operator-log.md', 'unit-file.dat', 'sha256-manifest.txt',
]);
const ACCEPTED_FILES = Object.freeze(['re-export.xml', 'semantic-comparison.json', 'identity-map.json']);
const SESSION_FIELDS = Object.freeze([
  'sourceCommitSha', 'caesarVersion', 'caesarBuild', 'xmlVersion', 'unitFileId', 'unitFileSha256',
]);
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const slash = (value) => value.split(path.sep).join('/');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

async function exists(target) {
  try { await fs.access(target); return true; } catch { return false; }
}

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, 'utf8'));
}

async function writeJson(target, value) {
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, stableValue(value[key])]));
}

const canonicalJson = (value) => JSON.stringify(stableValue(value));
const portablePath = (value) => typeof value === 'string' && value.length > 0
  && !value.includes('\\') && !path.posix.isAbsolute(value)
  && value.split('/').every((part) => part && part !== '.' && part !== '..');

export async function sha256File(target) {
  return sha256(await fs.readFile(target));
}

async function listFiles(root, relative = '') {
  const target = path.join(root, relative), entries = await fs.readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => compare(a.name, b.name))) {
    const next = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not admitted: ${slash(next)}`);
    if (entry.isDirectory()) files.push(...await listFiles(root, next));
    else if (entry.isFile()) files.push(slash(next));
  }
  return files;
}

export async function sha256Tree(root) {
  const lines = [];
  for (const relative of await listFiles(root)) {
    lines.push(`${await sha256File(path.join(root, relative))}  ${relative}`);
  }
  return sha256(Buffer.from(lines.length ? `${lines.join('\n')}\n` : '', 'utf8'));
}

async function packageHashes(root) {
  const entries = [];
  for (const relative of (await listFiles(root)).filter((item) => item !== 'sha256-manifest.txt')) {
    entries.push([relative, await sha256File(path.join(root, relative))]);
  }
  return entries;
}

function manifestText(entries) {
  return entries.map(([relative, hash]) => `${hash}  ${relative}`).join('\n') + (entries.length ? '\n' : '');
}

export async function writeSha256Manifest(root) {
  await fs.writeFile(path.join(root, 'sha256-manifest.txt'), manifestText(await packageHashes(root)), 'utf8');
}

function parseSha256Manifest(value) {
  const entries = new Map();
  for (const line of value.split(/\r?\n/).filter(Boolean)) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || !portablePath(match[2]) || entries.has(match[2])) return null;
    entries.set(match[2], match[1]);
  }
  return entries;
}

async function verifySha256Manifest(root, diagnostics) {
  const target = path.join(root, 'sha256-manifest.txt');
  if (!await exists(target)) { diagnostics.push('SHA256_MANIFEST_MISSING'); return; }
  const raw = await fs.readFile(target, 'utf8'), declared = parseSha256Manifest(raw);
  if (!declared) { diagnostics.push('SHA256_MANIFEST_INVALID'); return; }
  const entries = await packageHashes(root), actual = new Map(entries);
  if (raw !== manifestText(entries)) diagnostics.push('SHA256_MANIFEST_NONCANONICAL');
  for (const [relative, hash] of actual) {
    if (declared.get(relative) !== hash) diagnostics.push(`SHA256_MISMATCH:${relative}`);
  }
  for (const relative of declared.keys()) {
    if (!actual.has(relative)) diagnostics.push(`SHA256_UNKNOWN_PATH:${relative}`);
  }
}

function templateManifest(caseId, sourceCommitSha) {
  return {
    fixtureId: `fixture:${caseId}`, fixtureCaseId: caseId,
    fixturePath: `${caseId}/original-export.xml`, fixtureSha256: '', fixtureGitBlobSha1: '',
    sourceCommitSha, sourceClassification: 'CAESAR_OPERATOR_FIXTURE',
    caesarVersion: '', caesarBuild: '', xmlVersion: '', unitFileId: '',
    unitFilePath: 'unit-file.dat', unitFileSha256: '', identityMapPath: 'identity-map.json',
    nativeJobSha256: '', importedJobSha256: '', reexportSha256: '', operatorLogSha256: '',
    pipingCodeId: '', pipingCodeName: '', pipingCodeEdition: '', laminateClassification: '',
    elementCount: 0, bendCount: 0, bendRecords: [], continuityRecords: [],
    importEvidence: { status: 'MISSING', warnings: [], errors: [] },
    roundTripEvidence: { status: 'MISSING' }, authorityLevel: 'UNVERIFIED_OPERATOR_INPUT',
    sourceReferences: [],
  };
}

async function createIfMissing(target, content) {
  if (!await exists(target)) await fs.writeFile(target, content, 'utf8');
}

async function scaffoldCase(root, caseId, sourceCommitSha) {
  const directory = path.join(root, caseId);
  for (const name of ['native-job', 'imported-job', 'screenshots']) {
    await fs.mkdir(path.join(directory, name), { recursive: true });
  }
  if (!await exists(path.join(directory, 'manifest.json'))) {
    await writeJson(path.join(directory, 'manifest.json'), templateManifest(caseId, sourceCommitSha));
  }
  await createIfMissing(path.join(directory, 'original-export.xml'), '');
  await createIfMissing(path.join(directory, 'operator-log.md'), `# ${caseId} operator log\n`);
  await createIfMissing(path.join(directory, 'unit-file.dat'), '');
  await createIfMissing(path.join(directory, 'identity-map.json'), '{}\n');
  await createIfMissing(path.join(directory, 'import-result.json'), '{\n  "status": "MISSING"\n}\n');
  await createIfMissing(path.join(directory, 'warnings-errors.json'), '{\n  "warnings": [],\n  "errors": []\n}\n');
  await createIfMissing(path.join(directory, 'semantic-comparison.json'), '{\n  "status": "MISSING"\n}\n');
  await writeSha256Manifest(directory);
}

export async function scaffoldEvidencePackage(root, sourceCommitSha = '') {
  if (!COMMIT_SHA.test(sourceCommitSha)) throw new Error('A 40-character source commit SHA is required.');
  await fs.mkdir(root, { recursive: true });
  for (const caseId of PIPELINE_GRE_CAESAR_CASES) await scaffoldCase(root, caseId, sourceCommitSha);
  return verifyEvidencePackage(root, sourceCommitSha);
}

async function requiredArtifacts(directory, manifest, diagnostics) {
  for (const relative of BASE_FILES) if (!await exists(path.join(directory, relative))) {
    diagnostics.push(`REQUIRED_FILE_MISSING:${relative}`);
  }
  for (const relative of ['native-job', 'imported-job']) if (!await exists(path.join(directory, relative))) {
    diagnostics.push(`REQUIRED_DIRECTORY_MISSING:${relative}`);
  }
  if (manifest?.importEvidence?.result === 'ACCEPTED') for (const relative of ACCEPTED_FILES) {
    if (!await exists(path.join(directory, relative))) diagnostics.push(`REQUIRED_FILE_MISSING:${relative}`);
  }
}

async function verifyFileBinding(directory, relative, expectedHash, field, diagnostics) {
  if (!portablePath(relative)) { diagnostics.push(`ARTIFACT_PATH_INVALID:${field}`); return; }
  const target = path.join(directory, relative);
  if (!await exists(target)) { diagnostics.push(`REQUIRED_FILE_MISSING:${relative}`); return; }
  if ((await fs.stat(target)).size === 0) diagnostics.push(`ARTIFACT_FILE_EMPTY:${relative}`);
  if (await sha256File(target) !== expectedHash) diagnostics.push(`ARTIFACT_HASH_MISMATCH:${field}`);
}

async function verifyArtifactBindings(directory, manifest, diagnostics) {
  await verifyFileBinding(directory, 'original-export.xml', manifest.fixtureSha256, 'fixtureSha256', diagnostics);
  await verifyFileBinding(directory, 'operator-log.md', manifest.operatorLogSha256, 'operatorLogSha256', diagnostics);
  await verifyFileBinding(directory, manifest.unitFilePath, manifest.unitFileSha256, 'unitFileSha256', diagnostics);
  if (manifest.importEvidence?.result === 'ACCEPTED') {
    await verifyFileBinding(directory, 're-export.xml', manifest.reexportSha256, 'reexportSha256', diagnostics);
    await verifyFileBinding(directory, manifest.identityMapPath,
      manifest.roundTripEvidence?.comparison?.identityMapSha256, 'identityMapSha256', diagnostics);
  }
  for (const [relative, field] of [['native-job', 'nativeJobSha256'], ['imported-job', 'importedJobSha256']]) {
    const target = path.join(directory, relative);
    if (!await exists(target)) continue;
    const files = await listFiles(target);
    if (!files.length) diagnostics.push(`ARTIFACT_DIRECTORY_EMPTY:${relative}`);
    else if (await sha256Tree(target) !== manifest[field]) diagnostics.push(`ARTIFACT_HASH_MISMATCH:${field}`);
  }
}

async function verifyCompanionJson(directory, manifest, diagnostics) {
  try {
    const imported = await readJson(path.join(directory, 'import-result.json'));
    if (canonicalJson(imported) !== canonicalJson(manifest.importEvidence)) diagnostics.push('IMPORT_RESULT_MANIFEST_CONFLICT');
    const ledger = await readJson(path.join(directory, 'warnings-errors.json'));
    const expected = { warnings: manifest.importEvidence?.warnings || [], errors: manifest.importEvidence?.errors || [] };
    if (canonicalJson(ledger) !== canonicalJson(expected)) diagnostics.push('WARNING_LEDGER_MANIFEST_CONFLICT');
    if (manifest.importEvidence?.result === 'ACCEPTED') {
      const comparison = await readJson(path.join(directory, 'semantic-comparison.json'));
      if (canonicalJson(comparison) !== canonicalJson(manifest.roundTripEvidence?.comparison)) {
        diagnostics.push('SEMANTIC_COMPARISON_MANIFEST_CONFLICT');
      }
    }
  } catch { diagnostics.push('COMPANION_JSON_INVALID'); }
}

async function verifyCase(root, caseId, expectedSourceCommitSha) {
  const directory = path.join(root, caseId);
  if (!await exists(directory)) return { caseId, status: 'MISSING', diagnostics: ['CASE_DIRECTORY_MISSING'] };
  const diagnostics = [];
  let manifest = null, evidence = null;
  try {
    manifest = await readJson(path.join(directory, 'manifest.json'));
    if (manifest.fixtureCaseId !== caseId) diagnostics.push('FIXTURE_CASE_ID_MISMATCH');
    if (manifest.fixturePath !== `${caseId}/original-export.xml`) diagnostics.push('FIXTURE_PATH_MISMATCH');
    if (manifest.sourceCommitSha !== expectedSourceCommitSha) diagnostics.push('SOURCE_COMMIT_MISMATCH');
    evidence = createPipelineGreCaesarFixtureEvidence(manifest);
    if (evidence.ready !== true) diagnostics.push(...evidence.blockerCodes.map((code) => `V2:${code}`));
  } catch { diagnostics.push('MANIFEST_INVALID'); }
  await requiredArtifacts(directory, manifest, diagnostics);
  await verifySha256Manifest(directory, diagnostics);
  if (manifest) {
    await verifyArtifactBindings(directory, manifest, diagnostics);
    await verifyCompanionJson(directory, manifest, diagnostics);
  }
  const unique = [...new Set(diagnostics)].sort(compare);
  return { caseId, fixtureId: manifest?.fixtureId || '', status: unique.length ? 'REJECTED_WITH_REASON' : 'ADMITTED',
    diagnostics: unique, evidenceReady: evidence?.ready === true,
    session: manifest ? Object.fromEntries(SESSION_FIELDS.map((field) => [field, manifest[field] || ''])) : null };
}

function enforceSessionConsistency(cases, packageDiagnostics) {
  const basis = cases.find((item) => item.session);
  if (!basis) { packageDiagnostics.push('SESSION_BASIS_MISSING'); return null; }
  for (const item of cases.filter((candidate) => candidate.session)) {
    for (const field of SESSION_FIELDS) if (item.session[field] !== basis.session[field]) {
      item.diagnostics = [...new Set([...item.diagnostics, `SESSION_CONFLICT:${field}`])].sort(compare);
      item.status = 'REJECTED_WITH_REASON';
      packageDiagnostics.push(`SESSION_CONFLICT:${item.caseId}:${field}`);
    }
  }
  return { basisCaseId: basis.caseId, ...basis.session };
}

export async function verifyEvidencePackage(root, expectedSourceCommitSha = '') {
  const packageDiagnostics = [];
  if (!COMMIT_SHA.test(expectedSourceCommitSha)) packageDiagnostics.push('EXPECTED_SOURCE_COMMIT_INVALID');
  const cases = [];
  for (const caseId of PIPELINE_GRE_CAESAR_CASES) {
    cases.push(await verifyCase(root, caseId, expectedSourceCommitSha));
  }
  const session = enforceSessionConsistency(cases, packageDiagnostics);
  const outputCases = cases.map(({ session: ignored, ...item }) => item);
  const counts = Object.fromEntries(['ADMITTED', 'REJECTED_WITH_REASON', 'MISSING']
    .map((status) => [status, outputCases.filter((item) => item.status === status).length]));
  const diagnostics = [...new Set(packageDiagnostics)].sort(compare);
  return { schema: PIPELINE_GRE_CAESAR_PACKAGE_SCHEMA, packageRoot: '.', expectedSourceCommitSha,
    session, cases: outputCases, counts, diagnostics,
    ready: diagnostics.length === 0 && counts.ADMITTED === PIPELINE_GRE_CAESAR_CASES.length };
}

async function runCli() {
  const [command, root = 'pipeline-gre-caesar-evidence', sourceCommitSha = '', reportPath = ''] = process.argv.slice(2);
  if (!['scaffold', 'verify'].includes(command)) {
    throw new Error('Usage: scaffold <root> <source-sha> | verify <root> <source-sha> [report-path]');
  }
  const report = command === 'scaffold'
    ? await scaffoldEvidencePackage(root, sourceCommitSha)
    : await verifyEvidencePackage(root, sourceCommitSha);
  if (command === 'verify' && reportPath) await writeJson(reportPath, report);
  else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (command === 'verify' && !report.ready) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) runCli().catch((error) => {
  process.stderr.write(`${error.message}\n`); process.exitCode = 1;
});
