const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const REAL_ROOT = fs.realpathSync(ROOT_DIR);
const BACKUP_DIR = path.join(ROOT_DIR, '.backups');
const LOG_FILE = path.join(BACKUP_DIR, 'log.json');

function ensureBackupDirectory() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function resolveSource(filePathArg) {
  if (!filePathArg) throw new Error('Specify a repository file path.');
  const absolutePath = path.resolve(process.cwd(), filePathArg);
  if (!isInside(ROOT_DIR, absolutePath)) throw new Error(`Path is outside repository: ${absolutePath}`);
  if (!fs.existsSync(absolutePath)) throw new Error(`File not found: ${absolutePath}`);
  const realPath = fs.realpathSync(absolutePath);
  if (!isInside(REAL_ROOT, realPath)) throw new Error(`Resolved path escapes repository: ${realPath}`);
  if (!fs.statSync(realPath).isFile()) throw new Error(`Target is not a regular file: ${absolutePath}`);
  return { absolutePath: realPath, relativePath: path.relative(REAL_ROOT, realPath) };
}

function resolveStoredSource(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error('Backup entry has an invalid source path.');
  const absolutePath = path.resolve(ROOT_DIR, relativePath);
  if (!isInside(ROOT_DIR, absolutePath)) throw new Error(`Backup source escapes repository: ${relativePath}`);
  const existingPath = findExistingAncestor(absolutePath);
  const realExistingPath = fs.realpathSync(existingPath);
  if (realExistingPath !== REAL_ROOT && !isInside(REAL_ROOT, realExistingPath)) {
    throw new Error(`Backup source resolves outside repository: ${relativePath}`);
  }
  return absolutePath;
}

function findExistingAncestor(candidate) {
  let current = candidate;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`No existing ancestor for path: ${candidate}`);
    current = parent;
  }
  return current;
}

function resolveBackup(backupFile) {
  if (!backupFile || path.basename(backupFile) !== backupFile) throw new Error('Backup entry has an invalid backup filename.');
  const absolutePath = path.resolve(BACKUP_DIR, backupFile);
  if (!isInside(BACKUP_DIR, absolutePath)) throw new Error(`Backup path escapes .backups: ${backupFile}`);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) throw new Error(`Backup file not found: ${absolutePath}`);
  return absolutePath;
}

function timestampParts(date) {
  const pad = (value) => String(value).padStart(2, '0');
  const file = [pad(date.getDate()), pad(date.getMonth() + 1), String(date.getFullYear()).slice(-2), pad(date.getHours()), pad(date.getMinutes())].join('_');
  const display = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return { file, display };
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function loadLog() {
  ensureBackupDirectory();
  if (!fs.existsSync(LOG_FILE)) return { schemaVersion: 2, lastId: 0, entries: [] };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse ${LOG_FILE}; repair it before continuing. ${error.message}`);
  }
  if (!Number.isInteger(parsed.lastId) || !Array.isArray(parsed.entries)) throw new Error(`Invalid backup log structure: ${LOG_FILE}`);
  return { schemaVersion: 2, ...parsed };
}

function writeLog(log) {
  ensureBackupDirectory();
  const temporary = `${LOG_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(log, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temporary, LOG_FILE);
}

function normalizePlan(context) {
  const text = String(context || '').trim();
  if (!text) throw new Error('Provide a planned action, for example: "Plan to update validation".');
  return /^Plan to\b/i.test(text) ? `Plan to${text.slice(7)}` : `Plan to ${text}`;
}

function slugFor(relativePath) {
  const extension = path.extname(relativePath);
  const stem = extension ? relativePath.slice(0, -extension.length) : relativePath;
  return `${stem.replace(/[\\/:*?"<>|\s]+/g, '__')}${extension}`;
}

function uniqueBackupName(relativePath, stamp) {
  const base = `${slugFor(relativePath)}_${stamp}`;
  for (let index = 1; index < 1000; index += 1) {
    const suffix = index === 1 ? '' : `_${String(index).padStart(2, '0')}`;
    const name = `${base}${suffix}.bak`;
    if (!fs.existsSync(path.join(BACKUP_DIR, name))) return name;
  }
  throw new Error(`Unable to allocate a unique backup name for ${relativePath}.`);
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function appendPlanLog(stamp, entry) {
  const planLog = path.join(BACKUP_DIR, `plan-log_${stamp}.md`);
  if (!fs.existsSync(planLog)) fs.writeFileSync(planLog, '| ID | Backup | Source | Planned action |\n|---:|---|---|---|\n', 'utf8');
  const row = `| ${entry.id} | ${escapeMarkdown(entry.backupFile)} | ${escapeMarkdown(entry.file)} | ${escapeMarkdown(entry.context)} |\n`;
  fs.appendFileSync(planLog, row, 'utf8');
}

function saveFile(filePathArg, context) {
  const source = resolveSource(filePathArg);
  const plan = normalizePlan(context);
  const log = loadLog();
  const now = timestampParts(new Date());
  const backupFile = uniqueBackupName(source.relativePath, now.file);
  const content = fs.readFileSync(source.absolutePath);
  fs.writeFileSync(path.join(BACKUP_DIR, backupFile), content, { flag: 'wx' });
  const entry = { id: log.lastId + 1, timestamp: now.display, file: source.relativePath, context: plan, backupFile, bytes: content.length, sha256: sha256(content) };
  appendPlanLog(now.file, entry);
  writeLog({ ...log, schemaVersion: 2, lastId: entry.id, entries: [...log.entries, entry] });
  console.log(`Saved backup #${entry.id} for ${entry.file}`);
  console.log(`Plan: ${entry.context}`);
  console.log(`SHA-256: ${entry.sha256}`);
  return entry;
}

function findEntry(idArg) {
  const id = Number(idArg);
  if (!Number.isInteger(id) || id < 1) throw new Error('Specify a valid positive backup ID.');
  const entry = loadLog().entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Backup #${id} not found.`);
  return entry;
}

function verifyEntry(entry) {
  const content = fs.readFileSync(resolveBackup(entry.backupFile));
  const actual = sha256(content);
  if (entry.sha256 && actual !== entry.sha256) throw new Error(`Checksum mismatch for backup #${entry.id}. Expected ${entry.sha256}, received ${actual}.`);
  if (Number.isInteger(entry.bytes) && content.length !== entry.bytes) throw new Error(`Size mismatch for backup #${entry.id}.`);
  console.log(`Verified backup #${entry.id}: ${actual}`);
  return content;
}

function listBackups(filterFile) {
  const entries = loadLog().entries.filter((entry) => !filterFile || entry.file.toLowerCase().includes(filterFile.toLowerCase()));
  if (!entries.length) {
    console.log(filterFile ? `No backups match: ${filterFile}` : 'No backups created yet.');
    return;
  }
  entries.forEach((entry) => console.log(`[#${entry.id}] ${entry.timestamp} ${entry.file}\n  ${entry.context}`));
}

function runDiff(idArg) {
  const entry = findEntry(idArg);
  const backupPath = resolveBackup(entry.backupFile);
  const targetPath = resolveStoredSource(entry.file);
  if (!fs.existsSync(targetPath)) throw new Error(`Current source file not found: ${entry.file}`);
  const result = spawnSync('git', ['--no-pager', 'diff', '--no-index', '--text', '--', backupPath, targetPath], { cwd: ROOT_DIR, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (![0, 1].includes(result.status)) throw new Error(`git diff failed with exit code ${result.status}.`);
  if (result.status === 0) console.log(`Backup #${entry.id} is identical to ${entry.file}.`);
}

function restoreFile(idArg) {
  const entry = findEntry(idArg);
  const backupContent = verifyEntry(entry);
  const targetPath = resolveStoredSource(entry.file);
  if (fs.existsSync(targetPath)) {
    const current = fs.readFileSync(targetPath);
    if (current.equals(backupContent)) {
      console.log(`${entry.file} is already identical to backup #${entry.id}.`);
      return;
    }
    saveFile(targetPath, `Plan to preserve the current file before restoring backup #${entry.id}`);
  } else {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }
  fs.writeFileSync(targetPath, backupContent);
  console.log(`Restored backup #${entry.id} to ${entry.file}.`);
}

const commands = {
  save: (filePathArg, context) => saveFile(filePathArg, context),
  list: (filterFile) => listBackups(filterFile),
  verify: (idArg) => verifyEntry(findEntry(idArg)),
  diff: (idArg) => runDiff(idArg),
  restore: (idArg) => restoreFile(idArg)
};

function printUsage() {
  console.log(`Backup Manager Utility
Usage:
  node utils/backup.cjs save <file-path> "Plan to ..."
  node utils/backup.cjs list [file-filter]
  node utils/backup.cjs verify <backup-id>
  node utils/backup.cjs diff <backup-id>
  node utils/backup.cjs restore <backup-id>`);
}

function main() {
  const [, , command, ...args] = process.argv;
  if (!command) return printUsage();
  if (!commands[command]) throw new Error(`Unknown command: ${command}`);
  return commands[command](...args);
}

try {
  main();
} catch (error) {
  console.error(`Backup error: ${error.message}`);
  process.exitCode = 1;
}
