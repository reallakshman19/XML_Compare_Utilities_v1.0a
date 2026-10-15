import { decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { deepFreeze } from './cii-workspace-contracts.js';

const HANGER_LAYOUTS = Object.freeze({
  SYNCHRONIZER: 'CAESAR_SYNCHRONIZER_IHGRNODE_FIRST',
  INPUTXML_CURRENT: 'INPUTXML_CURRENT_HGRDAT_FIRST',
  NONE: 'CONTROL_NOHGRS_ZERO',
  SAME_NODES: 'MULTIPLE_LAYOUTS_SAME_IHGRNODE',
});

function sectionRows(rawText, wanted) {
  const rows = String(rawText ?? '').split(/\r?\n/);
  const marker = new RegExp(`^\\s*#\\$\\s*${wanted}\\s*$`, 'i');
  const start = rows.findIndex((row) => marker.test(row));
  if (start < 0) return [];
  const out = [];
  for (let index = start + 1; index < rows.length; index += 1) {
    if (/^\s*#\$\s*/.test(rows[index])) break;
    if (rows[index].trim()) out.push(rows[index]);
  }
  return out;
}
function numeric(row, minimum = 1) {
  const values = decodeCiiNumericRow(row);
  return Array.isArray(values) && values.length >= minimum && values.slice(0, minimum).every(Number.isFinite) ? values : null;
}
function asNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
function ceilDiv(value, divisor) { return Math.floor(value / divisor) + (value % divisor ? 1 : 0); }
function conflict(code, details = {}) { return Object.freeze({ code, ...details }); }

function parseControl(rawText) {
  const rows = sectionRows(rawText, 'CONTROL'); const conflicts = [];
  if (rows.length < 4) {
    conflicts.push(conflict('HANGER_CONTROL_ROWS_MISSING', { rowCount: rows.length }));
    return { rows, control: null, conflicts };
  }
  const first = numeric(rows[0], 6); const second = numeric(rows[1], 6); const third = numeric(rows[2], 6); const fourth = numeric(rows[3], 1);
  if (!first || !second || !third || !fourth) {
    conflicts.push(conflict('HANGER_CONTROL_DECODE_FAILED'));
    return { rows, control: null, conflicts };
  }
  const fields = [...first.slice(0, 6), ...second.slice(0, 6), ...third.slice(0, 6), fourth[0]];
  if (fields.some((value) => asNonNegativeInteger(value) === null)) {
    conflicts.push(conflict('HANGER_CONTROL_NON_INTEGER_COUNT', { fields }));
    return { rows, control: null, conflicts };
  }
  return {
    rows,
    control: Object.freeze({
      numelt: Number(first[0]), numnoz: Number(first[1]), nohgrs: Number(first[2]), nonam: Number(first[3]),
      nored: Number(first[4]), numflg: Number(first[5]),
      bends: Number(second[0]), rigids: Number(second[1]), expjts: Number(second[2]), restraints: Number(second[3]),
      displmnt: Number(second[4]), forcmnt: Number(second[5]),
      uniform: Number(third[0]), wind: Number(third[1]), offsets: Number(third[2]), allowbls: Number(third[3]),
      sifTees: Number(third[4]), izup: Number(third[5]), equipmnt: Number(fourth[0]),
    }),
    conflicts,
  };
}

function decodeNodeCandidate(rows, start, packedRows, expectedCount, knownNodes, layout) {
  if (start < 0 || start + packedRows > rows.length) return null;
  const values = [];
  for (const row of rows.slice(start, start + packedRows)) {
    const decoded = decodeCiiNumericRow(row);
    if (!Array.isArray(decoded) || decoded.some((value) => !Number.isFinite(value))) return null;
    values.push(...decoded);
  }
  // IHGRNODE is a packed array with exactly NOHGRS values. Requiring the exact
  // count prevents a six-field HGRDAT row from masquerading as a one-node list.
  if (values.length !== expectedCount) return null;
  const nodes = [];
  for (const value of values) {
    if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0) return null;
    const id = String(Number(value));
    if (!knownNodes.has(id)) return null;
    nodes.push(id);
  }
  return Object.freeze({ layout, startRow1Based: start + 1, packedRowCount: packedRows, nodes: Object.freeze(nodes) });
}

export function buildCiiHangerEvidence(rawText, parsed = {}) {
  const controlResult = parseControl(rawText); const conflicts = [...controlResult.conflicts];
  const control = controlResult.control; const miscelRows = sectionRows(rawText, 'MISCEL_1');
  if (!control) return deepFreeze({
    schema: 'CIIWorkspaceHangerEvidence.v1', status: 'PARSE_ERROR', control: null,
    count: null, nodes: Object.freeze([]), byNode: Object.freeze({}), layout: null,
    miscel1SectionRowCount: miscelRows.length, candidates: Object.freeze([]), conflicts: Object.freeze(conflicts),
  });

  const parsedElementCount = Array.isArray(parsed?.elements) ? parsed.elements.length : null;
  if (parsedElementCount == null || parsedElementCount !== control.numelt) {
    conflicts.push(conflict('HANGER_CONTROL_NUMELT_MISMATCH', { controlNumelt: control.numelt, parsedElementCount }));
  }
  const knownNodes = new Set(Object.keys(parsed?.nodes || {}).map(String));
  if (control.nohgrs === 0) {
    return deepFreeze({
      schema: 'CIIWorkspaceHangerEvidence.v1', status: conflicts.length ? 'PARSE_ERROR' : 'QUALIFIED', control,
      count: conflicts.length ? null : 0, nodes: Object.freeze([]), byNode: Object.freeze({}), layout: HANGER_LAYOUTS.NONE,
      miscel1SectionRowCount: miscelRows.length, candidates: Object.freeze([]), conflicts: Object.freeze(conflicts),
      authority: 'CONTROL.NOHGRS_ZERO',
    });
  }
  if (!miscelRows.length) conflicts.push(conflict('HANGER_MISCEL_1_REQUIRED', { nohgrs: control.nohgrs }));

  const rrmatRows = ceilDiv(control.numelt, 6);
  const nozzleRows = control.numnoz * 4; // current protected writer emits 22 VFLEX values -> four rows/nozzle
  const hangerBase = rrmatRows + nozzleRows;
  const packedRows = ceilDiv(control.nohgrs, 6);
  const candidateSpecs = [
    // CAESAR/vendor + cii2019_hanger_miscel_control.py: defaults, then IHGRNODE.
    { layout: HANGER_LAYOUTS.SYNCHRONIZER, start: hangerBase + 2 },
    // inputxml_to_cii2019.py::_build_hanger_lines current main: defaults, then
    // five per-hanger rows (HGRDAT1/HGRDAT2/TAG/GUID/IHGRFREE), then IHGRNODE.
    { layout: HANGER_LAYOUTS.INPUTXML_CURRENT, start: hangerBase + 2 + control.nohgrs * 5 },
  ];
  const candidates = candidateSpecs
    .map((spec) => decodeNodeCandidate(miscelRows, spec.start, packedRows, control.nohgrs, knownNodes, spec.layout))
    .filter(Boolean);

  let selected = null; let layout = null;
  if (candidates.length === 1) {
    [selected] = candidates; layout = selected.layout;
  } else if (candidates.length > 1) {
    const canonical = candidates.map((candidate) => candidate.nodes.join('|'));
    if (canonical.every((value) => value === canonical[0])) {
      selected = candidates[0]; layout = HANGER_LAYOUTS.SAME_NODES;
    } else {
      conflicts.push(conflict('HANGER_IHGRNODE_LAYOUT_AMBIGUOUS', {
        candidates: candidates.map((candidate) => ({ layout: candidate.layout, nodes: candidate.nodes })),
      }));
    }
  } else {
    conflicts.push(conflict('HANGER_IHGRNODE_LAYOUT_UNRESOLVED', {
      nohgrs: control.nohgrs, rrmatRows, nozzleRows, packedRows, miscel1SectionRowCount: miscelRows.length,
    }));
  }

  const nodes = selected ? [...selected.nodes] : [];
  const byNode = {};
  nodes.forEach((node, recordIndex) => {
    if (!byNode[node]) byNode[node] = [];
    byNode[node].push(Object.freeze({ recordIndex: recordIndex + 1, node, layout, authority: 'CONTROL_NOHGRS_PLUS_IHGRNODE' }));
  });
  return deepFreeze({
    schema: 'CIIWorkspaceHangerEvidence.v1', status: conflicts.length ? 'PARSE_ERROR' : 'QUALIFIED', control,
    count: conflicts.length ? null : nodes.length, nodes: Object.freeze(nodes),
    byNode: Object.freeze(Object.fromEntries(Object.entries(byNode).map(([node, records]) => [node, Object.freeze(records)]))),
    layout, miscel1SectionRowCount: miscelRows.length, candidates: Object.freeze(candidates), conflicts: Object.freeze(conflicts),
    authority: 'CONTROL.NOHGRS + MISCEL_1.IHGRNODE; DUAL_LAYOUT_VALIDATED',
    limitations: Object.freeze(['Hanger count/node presence is qualified. HGRDAT/TAG/GUID/other hanger attributes are intentionally not normalized by this evidence layer.']),
  });
}

export function applyCiiHangerCapabilities(baseCapabilities, hangerEvidence) {
  const base = baseCapabilities || {}; const families = base.families || {}; const evidence = hangerEvidence || {};
  const parseError = evidence.status !== 'QUALIFIED';
  const count = parseError ? null : Number(evidence.count || 0);
  const capability = parseError
    ? deepFreeze({
      state: 'PARSE_ERROR', count: null, qualification: 'NONE', authority: 'tabs/cii-workspace/cii-workspace-hanger.js',
      raw: Object.freeze({ present: Number(evidence.miscel1SectionRowCount || 0) > 0, nonEmptyRowCount: Number(evidence.miscel1SectionRowCount || 0), section: 'MISCEL_1' }),
      details: Object.freeze({ controlCount: evidence.control?.nohgrs ?? null, nodePresenceQualified: false, layout: evidence.layout || null, conflictCount: (evidence.conflicts || []).length }),
      limitations: Object.freeze(['Hanger CONTROL/MISCEL_1 node custody failed; hanger comparison is blocked.']),
    })
    : deepFreeze({
      state: count > 0 ? 'PARSED' : 'EMPTY', count, qualification: 'PARTIAL', authority: 'tabs/cii-workspace/cii-workspace-hanger.js#CONTROL_NOHGRS_IHGRNODE',
      raw: Object.freeze({ present: Number(evidence.miscel1SectionRowCount || 0) > 0, nonEmptyRowCount: Number(evidence.miscel1SectionRowCount || 0), section: 'MISCEL_1' }),
      details: Object.freeze({
        controlCount: evidence.control?.nohgrs ?? count, nodeCount: (evidence.nodes || []).length,
        nodes: Object.freeze([...(evidence.nodes || [])]), nodePresenceQualified: true, layout: evidence.layout,
      }),
      limitations: Object.freeze(['Hanger count/node presence is qualified; HGRDAT and other hanger attributes remain unnormalized.']),
    });
  return deepFreeze({ ...base, families: Object.freeze({ ...families, hangers: capability }) });
}

export const CII_HANGER_LAYOUTS = HANGER_LAYOUTS;
