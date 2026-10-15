import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const SOURCE_COMMIT = 'd5fda9c95fda9bba9b6b05171628ba16778a7667';
const SOURCE_URL = `https://raw.githubusercontent.com/reallaksh19/3D_Converters/${SOURCE_COMMIT}/Benchmarks/1885_NC/1885_NC.json`;
const ROOT_BRANCH = '/ASIM-1885-6"-S8811951-91261M7-HC-01/B2';
const REPORT_PATH = 'artifacts/sequential-sketcher/1885-nc-b2-component-evidence.json';

function text(value) { return String(value ?? '').trim(); }
function branchId(record) { return text(record?.attributes?.NAME || record?.name); }
function selectedAttributes(attributes = {}) {
  const keys = [
    'NAME', 'TYPE', 'RAW_TYPE', 'APOS', 'LPOS', 'POS', 'BPOS', 'CREF',
    'ABORE', 'LBORE', 'BORE', 'OD', 'RADI', 'ANGL', 'OWNER', 'REF',
    'DTXR', 'DESCRIPTION', 'FUNCTION',
  ];
  return Object.fromEntries(keys.filter((key) => attributes[key] !== undefined).map((key) => [key, attributes[key]]));
}

const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'sequential-sketcher-b2-evidence' } });
assert.equal(response.ok, true, `Unable to fetch pinned 1885_NC fixture: ${response.status}`);
const records = await response.json();
const root = records.find((record) => branchId(record) === ROOT_BRANCH);
assert.ok(root, `Pinned fixture must contain ${ROOT_BRANCH}`);
const children = Array.isArray(root.children) ? root.children : [];
const components = children.map((record, sourceIndex) => ({
  sourceIndex,
  sourceType: text(record?.type),
  sourceName: text(record?.name),
  attributes: selectedAttributes(record?.attributes),
}));
const report = {
  schema: 'Sequential1885NcB2ComponentEvidence.v1',
  sourceCommit: SOURCE_COMMIT,
  rootBranchId: ROOT_BRANCH,
  sourceChildCount: components.length,
  components,
};
mkdirSync('artifacts/sequential-sketcher', { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
