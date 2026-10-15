/**
 * CII Workspace adapter for the frozen 3D_Converters CAESAR II v11 <-> v14 engine.
 *
 * Upstream Python source is loaded byte-for-byte from
 * ./scripts/cii-v11-v14-upstream/. This worker may adapt runtime plumbing only;
 * it must not edit/rewrite the frozen Python engine.
 */
import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.mjs';

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';
const FROZEN_SCRIPT_BLOBS = Object.freeze({
  'cii_v11_v14.py': '6152f28c0c43b4d70029f360d993da5794310c8a',
  'cii_v11_v14_format.py': '56f59fb7e095a887fc84e8a008a5f40acbadaec5',
  'cii_v11_v14_records.py': '1a1f7bdd78a4b1479dd474fd9cc61a2b9adef235',
  'cii_v11_v14_sif.py': '88c1d80bdb7bd2d5197a56c5be60ac2057c02367',
  'cii_v11_v14_validate.py': '8e6896e8b61ac3c90d579139d39b29a6ace1637c',
  'cii2019_section_rules.py': 'efa894afd241f8ac0b74f6a6e0ecfaedc3d6d76e',
});
const SCRIPT_FILES = Object.freeze(Object.keys(FROZEN_SCRIPT_BLOBS));
const FROZEN_SCRIPT_ROOT = './scripts/cii-v11-v14-upstream/';
const SCRIPT_PATH = '/scripts/cii_v11_v14.py';
const WORK_ROOT = '/work/cii-writer-v11-v14';

let runtimePromise = null;
let scriptPromise = null;
let jobQueue = Promise.resolve();

function asText(value) {
  return value === undefined || value === null ? '' : String(value);
}
function sanitizeFileName(name) {
  const value = asText(name).trim() || 'input.cii';
  return value.replace(/[\\/:*?"<>|]/g, '_');
}
function errorText(error) {
  return [error?.name, error?.message || error, error?.stack].filter(Boolean).map(String).join(' | ');
}
function hex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}
async function gitBlobSha(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('Frozen converter source SHA verification is unavailable.');
  const header = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
  const payload = new Uint8Array(header.byteLength + bytes.byteLength);
  payload.set(header, 0);
  payload.set(bytes, header.byteLength);
  const digest = await globalThis.crypto.subtle.digest('SHA-1', payload);
  return hex(new Uint8Array(digest));
}
async function verifiedFrozenScript(fileName) {
  const scriptUrl = new URL(`${FROZEN_SCRIPT_ROOT}${fileName}`, import.meta.url).href;
  const response = await fetch(scriptUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load frozen ${fileName}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength) throw new Error(`Frozen ${fileName} loaded as empty bytes.`);
  const actualSha = await gitBlobSha(bytes);
  const expectedSha = FROZEN_SCRIPT_BLOBS[fileName];
  if (actualSha !== expectedSha) {
    throw new Error(`Frozen ${fileName} Git blob mismatch: expected ${expectedSha}, received ${actualSha}.`);
  }
  return bytes;
}
async function getRuntime() {
  if (!runtimePromise) runtimePromise = loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  return runtimePromise;
}
async function ensureScripts(pyodide) {
  if (!scriptPromise) {
    scriptPromise = (async () => {
      pyodide.FS.mkdirTree('/scripts');
      for (const fileName of SCRIPT_FILES) {
        const bytes = await verifiedFrozenScript(fileName);
        pyodide.FS.writeFile(`/scripts/${fileName}`, bytes);
      }
      pyodide.runPython('import sys; sys.path.insert(0, "/scripts") if "/scripts" not in sys.path else None');
    })().catch((error) => {
      scriptPromise = null;
      throw error;
    });
  }
  await scriptPromise;
}
async function runPython(pyodide, argv) {
  pyodide.globals.set('cii_job_argv', argv);
  const raw = await pyodide.runPythonAsync(`
import contextlib
import io
import json
import runpy
import sys
import traceback
_stdout = io.StringIO()
_stderr = io.StringIO()
_exit_code = 0
sys.argv = list(cii_job_argv)
with contextlib.redirect_stdout(_stdout), contextlib.redirect_stderr(_stderr):
    try:
        runpy.run_path(sys.argv[0], run_name="__main__")
    except SystemExit as exc:
        code = exc.code
        if code is None:
            _exit_code = 0
        elif isinstance(code, int):
            _exit_code = code
        else:
            print(code, file=sys.stderr)
            _exit_code = 1
    except Exception:
        traceback.print_exc()
        _exit_code = 1
json.dumps({"exit_code": _exit_code, "stdout": _stdout.getvalue(), "stderr": _stderr.getvalue()})
`);
  return JSON.parse(String(raw));
}
function cleanupJobDir(pyodide, jobDir, paths) {
  for (const path of paths) {
    try { pyodide.FS.unlink(path); } catch {}
  }
  try { pyodide.FS.rmdir(jobDir); } catch {}
}
async function runJob(message) {
  const pyodide = await getRuntime();
  await ensureScripts(pyodide);
  const inputBytes = new Uint8Array(message.inputBytes || new ArrayBuffer(0));
  if (!inputBytes.byteLength) throw new Error('Primary CII input is empty.');
  const jobId = sanitizeFileName(message.jobId || `job-${Date.now()}`);
  const jobDir = `${WORK_ROOT}/${jobId}`;
  pyodide.FS.mkdirTree(jobDir);
  const inputName = sanitizeFileName(message.inputName);
  const inputPath = `${jobDir}/${inputName}`;
  const outputPath = `${jobDir}/converted.cii`;
  const auditPath = `${jobDir}/conversion.audit.json`;
  pyodide.FS.writeFile(inputPath, inputBytes);
  const targetVersion = ['11', '14'].includes(String(message.targetVersion))
    ? String(message.targetVersion)
    : 'auto';
  const argv = [SCRIPT_PATH, inputPath, outputPath, '--target', targetVersion, '--audit-json', auditPath];
  if (message.allowLossy === true) argv.push('--allow-lossy');
  try {
    const execution = await runPython(pyodide, argv);
    if (Number(execution.exit_code) !== 0) {
      const detail = asText(execution.stderr).trim() || asText(execution.stdout).trim() || `exit code ${execution.exit_code}`;
      throw new Error(detail);
    }
    const outputBytes = pyodide.FS.readFile(outputPath);
    const auditText = pyodide.FS.readFile(auditPath, { encoding: 'utf8' });
    return {
      outputBytes,
      auditText,
      audit: JSON.parse(auditText),
      stdout: asText(execution.stdout).split(/\r?\n/).filter(Boolean),
      stderr: asText(execution.stderr).split(/\r?\n/).filter(Boolean),
      argv: argv.slice(1),
    };
  } finally {
    cleanupJobDir(pyodide, jobDir, [inputPath, outputPath, auditPath]);
  }
}
function enqueueJob(message) {
  const current = jobQueue.then(() => runJob(message));
  jobQueue = current.catch(() => undefined);
  return current;
}
self.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type !== 'run') return;
  enqueueJob(message).then(
    (result) => self.postMessage({ type: 'result', jobId: message.jobId, ok: true, ...result }),
    (error) => self.postMessage({ type: 'result', jobId: message.jobId, ok: false, error: errorText(error) }),
  );
});
