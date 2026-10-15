import { parseLooseTable, rowsToTabText } from './inputxml-workspace-table.js';

/**
 * DTXR ingestion for CleanXML.
 * Inputs: pasted DTXR table or staged JSON trace state rows.
 * Outputs: branch/POS/PS indexed DTXR rows that can annotate CleanXML nodes.
 * Fallback: branch+PS matching is used when a row has no parseable POS coordinate.
 */

const DTXR_COLUMNS = Object.freeze([
  { key: 'psNo', label: 'PS No.(Item Name)', aliases: ['PS No.(Item Name)', 'PS No', 'Item Name', 'NAME', 'PSNO', 'PS'] },
  { key: 'branch', label: 'Branch(Pipe)', aliases: ['Branch(Pipe)', 'Branch', 'Pipe', 'OWNER', 'Pipe Branch'] },
  { key: 'bore', label: 'Bore', aliases: ['Bore', 'ABORE', 'BORE_MM', 'BoreMm', 'DN'] },
  { key: 'pos', label: 'POS', aliases: ['POS', 'POSITION', 'APOS', 'LPOS'] },
  { key: 'dtxr', label: 'DTXR', aliases: ['DTXR', 'DTXR_POS', 'DESC', 'DESCRIPTION'] },
  { key: 'cmpSupGap', label: 'CMPSUPGAP', aliases: ['CMPSUPGAP', 'CMP SUP GAP', 'Support Gap', 'GAP'] },
]);

const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase();
const uniq = (items = []) => [...new Set(items.map(clean).filter(Boolean))];

export function parseDtxrPosition(value = '') {
  const raw = clean(value);
  if (!raw) return null;
  const objectMatch = Object.fromEntries([...raw.matchAll(/\b(E|EAST|X|N|NORTH|Y|EL|ELEV|Z)\s*=?\s*(-?\d+(?:\.\d+)?)/gi)]
    .map((match) => [upper(match[1]), Number(match[2])]));
  const x = objectMatch.E ?? objectMatch.EAST ?? objectMatch.X;
  const y = objectMatch.N ?? objectMatch.NORTH ?? objectMatch.Y;
  const z = objectMatch.EL ?? objectMatch.ELEV ?? objectMatch.Z;
  if ([x, y, z].every(Number.isFinite)) return { x, y, z };
  const nums = raw.split(/[,\s]+/).map(Number).filter(Number.isFinite);
  return nums.length >= 3 ? { x: nums[0], y: nums[1], z: nums[2] } : null;
}

export function normalizeDtxrBranch(value = '') {
  return upper(value).replace(/^\s*=\s*/, '').replace(/['"]/g, '').replace(/\s+/g, '').replace(/^\/*/, '/').replace(/\/B0*(\d+)$/i, '/B$1');
}

export function normalizePsToken(value = '') {
  return upper(value).replace(/[^A-Z0-9.]+/g, '').replace(/\.0+$/g, '');
}

function dtxrValue(row = {}) {
  const value = clean(row.dtxr);
  if (!value) return '';
  const extras = [];
  if (clean(row.psNo)) extras.push(`NAME=${clean(row.psNo)}`);
  if (clean(row.cmpSupGap)) extras.push(`CMPSUPGAP=${clean(row.cmpSupGap)}`);
  return extras.length ? `${value}(${extras.join(',')})` : value;
}

export function parseDtxrTable(text = '') {
  return parseLooseTable(text, DTXR_COLUMNS, { joinTail: true }).map((row, index) => ({
    ...row,
    source: 'dtxr-table',
    sourceRow: index + 1,
    position: parseDtxrPosition(row.pos),
    branchKey: normalizeDtxrBranch(row.branch),
    psKey: normalizePsToken(row.psNo),
    dtxrText: dtxrValue(row),
  })).filter((row) => clean(row.dtxrText));
}

export function dtxrRowsToTableText(rows = []) {
  return rowsToTabText(rows, DTXR_COLUMNS);
}

export function dtxrRowsFromJsonTraceSnapshot(snapshot = {}) {
  const rows = [];
  const sourceRows = Array.isArray(snapshot.scopedTrace) && snapshot.scopedTrace.length ? snapshot.scopedTrace
    : Array.isArray(snapshot.trace) ? snapshot.trace
      : Array.isArray(snapshot.fullTrace) ? snapshot.fullTrace : [];
  for (const [index, row] of sourceRows.entries()) {
    const fieldText = upper(`${row.field || ''} ${row.sourceAttributeName || ''} ${row.sourcePath || ''} ${row.xmlTraceScope || ''}`);
    if (!/DTXR|DESC|DESCRIPTION|CMPSUP|SUPPORT/.test(fieldText)) continue;
    const dtxr = clean(row.finalValue || row.sourceRawValue || row.value);
    if (!dtxr) continue;
    const psNo = clean(row.name || row.matchedToken || row.nodeName || row.sourceAttributeName);
    const branch = clean(row.branchName || row.stagedBranchKey || row.xmlBranchKey);
    rows.push({
      psNo,
      branch,
      bore: clean(row.boreMm || row.bore),
      pos: clean(row.position || row.positionLabel || row.matchedText || row.matchedKey),
      dtxr,
      cmpSupGap: clean(row.cmpSupGap),
      source: 'json-trace',
      sourceRow: index + 1,
      position: parseDtxrPosition(row.position || row.positionLabel || row.matchedText || row.matchedKey),
      branchKey: normalizeDtxrBranch(branch),
      psKey: normalizePsToken(psNo),
      dtxrText: dtxrValue({ psNo, dtxr, cmpSupGap: row.cmpSupGap }),
    });
  }
  return rows.filter((row) => clean(row.dtxrText));
}

function branchMatches(left = '', right = '') {
  const a = normalizeDtxrBranch(left);
  const b = normalizeDtxrBranch(right);
  if (!a || !b) return true;
  const baseA = a.replace(/\/B\d+$/i, '');
  const baseB = b.replace(/\/B\d+$/i, '');
  return a === b || baseA === baseB || a.includes(b) || b.includes(a);
}

function distance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), (a.z || 0) - (b.z || 0));
}

function nodePsTokens(node = {}) {
  return uniq([node.nodeName, node.componentRefNo, node.dtxrPs, node.dtxrPos].flatMap((value) => {
    const raw = clean(value);
    const direct = normalizePsToken(raw);
    const psHits = [...raw.matchAll(/PS[-\s]*[A-Za-z0-9.]+/gi)].map((match) => normalizePsToken(match[0]));
    return [direct, direct.replace(/^PS/, 'PS-'), direct.replace(/^PS-/, 'PS'), ...psHits];
  }));
}

export function matchDtxrRowsForNode(node = {}, rows = [], options = {}) {
  const toleranceMm = Number.isFinite(Number(options.positionToleranceMm)) ? Number(options.positionToleranceMm) : 6;
  const posMatches = [];
  const psMatches = [];
  const nodeTokens = new Set(nodePsTokens(node));
  for (const row of rows || []) {
    if (!branchMatches(node.branchName, row.branch)) continue;
    if (node.position && row.position && distance(node.position, row.position) <= toleranceMm) posMatches.push(row);
    if (row.psKey && nodeTokens.has(row.psKey)) psMatches.push(row);
  }
  return {
    dtxrPos: uniq(posMatches.map((row) => row.dtxrText)).join('|'),
    dtxrPs: uniq(psMatches.map((row) => row.dtxrText)).join('|'),
    basis: [
      posMatches.length ? `DTXR_POS: ${posMatches.length} branch/POS match(es)` : '',
      psMatches.length ? `DTXR_PS: ${psMatches.length} branch/PS match(es)` : '',
    ].filter(Boolean).join('; '),
  };
}

export const _test = Object.freeze({ DTXR_COLUMNS, dtxrValue, branchMatches, distance, nodePsTokens });
