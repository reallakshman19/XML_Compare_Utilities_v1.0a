#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) out[argv[i].replace(/^--/, '')] = argv[i + 1];
  return out;
}

function testFiles(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const command = String(pkg.scripts?.['test:workbench3d'] ?? '');
  const files = [];
  for (const match of command.matchAll(/\bnode\s+([^\s&]+)/g)) files.push(match[1]);
  return files;
}

function runOne(root, file) {
  const result = spawnSync(process.execPath, [file], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
    timeout: 180000,
  });
  return {
    status: result.error?.code === 'ETIMEDOUT' ? 'TIMEOUT' : result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().slice(-3000),
  };
}

function runFamily(root) {
  const results = {};
  for (const file of testFiles(root)) results[file] = runOne(root, file);
  return results;
}

function compare(base, head) {
  const regressions = [];
  const improvements = [];
  const retainedFailures = [];
  const removed = [];
  for (const name of [...new Set([...Object.keys(base), ...Object.keys(head)])].sort()) {
    const before = base[name]?.status ?? 'MISSING';
    const after = head[name]?.status ?? 'MISSING';
    const row = { test: name, base: before, head: after };
    if (after === 'MISSING') {
      removed.push(row);
      regressions.push({ ...row, reason: 'test removed from head' });
    } else if (before === 'MISSING' && after !== 'PASS') {
      regressions.push({ ...row, reason: 'new test does not pass' });
    } else if (before === 'PASS' && after !== 'PASS') {
      regressions.push({ ...row, reason: 'previously passing test regressed' });
    } else if (before !== 'PASS' && before !== 'MISSING' && after === 'PASS') {
      improvements.push(row);
    } else if (before !== 'PASS' && before !== 'MISSING' && after !== 'PASS' && after !== 'MISSING') {
      retainedFailures.push(row);
    }
  }
  return { regressions, improvements, retainedFailures, removed };
}

const args = parseArgs(process.argv);
if (!args.base || !args.head || !args.output) throw new Error('Usage: --base <dir> --head <dir> --output <file>');
const baseRoot = path.resolve(args.base);
const headRoot = path.resolve(args.head);
const base = runFamily(baseRoot);
const head = runFamily(headRoot);
const comparison = compare(base, head);
const report = {
  schema: 'workbench3d-tablexml-baseline-ledger/v1',
  baseRoot,
  headRoot,
  baseCount: Object.keys(base).length,
  headCount: Object.keys(head).length,
  baseFailures: Object.entries(base).filter(([, value]) => value.status !== 'PASS').map(([name]) => name),
  headFailures: Object.entries(head).filter(([, value]) => value.status !== 'PASS').map(([name]) => name),
  ...comparison,
};
report.ok = report.regressions.length === 0;
fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  '# Workbench3D TableXML named baseline ledger',
  '',
  `- Base tests: ${report.baseCount}`,
  `- Head tests: ${report.headCount}`,
  `- Base failing names: ${report.baseFailures.length}`,
  `- Head failing names: ${report.headFailures.length}`,
  `- Regressions: ${report.regressions.length}`,
  `- Removed tests: ${report.removed.length}`,
  `- Improvements: ${report.improvements.length}`,
  '',
];
if (report.regressions.length) {
  lines.push('## Regressions', '');
  for (const row of report.regressions) lines.push(`- \`${row.test}\`: ${row.base} → ${row.head} (${row.reason})`);
  lines.push('');
}
if (report.headFailures.length) {
  lines.push('## Head failing names', '');
  for (const name of report.headFailures) lines.push(`- \`${name}\``);
  lines.push('');
}
lines.push(`**Result:** ${report.ok ? 'PASS' : 'FAIL'}`, '');
const markdown = lines.join('\n');
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) fs.writeFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
process.exit(report.ok ? 0 : 1);
