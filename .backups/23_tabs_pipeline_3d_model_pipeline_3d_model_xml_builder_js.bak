// Builds "Coordinate tab" rows and a CAESARII>PIPINGMODEL>PIPINGELEMENT XML
// document matching the actual input schema read by 3D_Converters'
// InputXML->CII(2019) converter, as a standalone (no-DOM) utility.
// Coordinate tab schema: [branchName, nodeNumber, x, y, z]  (mm)

const M_TO_MM = 1000;
const NODE_NUMBER_START = 100;
const NODE_NUMBER_STEP = 10;

function toMm(meters) {
  return Math.round(Number(meters || 0) * M_TO_MM * 1000) / 1000;
}

// Turns the combined coordinate list (from pipeline-3d-model-geometry.js) into
// Coordinate-tab rows: one row per point, with sequential CII node numbers and
// the marker/point label carried alongside as the node name.
export function buildCoordinateRows(combinedPoints, branchName) {
  return combinedPoints.map((point, index) => ({
    branchName,
    nodeNumber: NODE_NUMBER_START + index * NODE_NUMBER_STEP,
    x: toMm(point.x),
    y: toMm(point.y),
    z: toMm(point.z),
    nodeName: point.label || '',
    horizontal: point.horizontal,
  }));
}

export function coordinateRowsToTabText(rows) {
  const header = ['BranchName', 'NodeNumber', 'X(mm)', 'Y(mm)', 'Z(mm)', 'NodeName'].join('\t');
  const lines = rows.map((r) => [r.branchName, r.nodeNumber, r.x, r.y, r.z, r.nodeName].join('\t'));
  return [header, ...lines].join('\n');
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function tag(name, value) {
  return `<${name}>${esc(value)}</${name}>`;
}

// Sentinel used throughout 3D_Converters' InputXML->CII(2019) workflow to mean
// "no value supplied" (converters/scripts/inputxml_to_cii2019.py /
// xml-cii-inputxml-enrichment.js: isSentinel() checks abs(n + 1.0101) < 1e-6).
// Using it here (rather than 0 or blank) so downstream enrichment treats these
// exactly like any other un-supplied CAESAR II field.
const SENTINEL_MISSING = '-1.010100';

function num(value, fallback = SENTINEL_MISSING) {
  if (value === '' || value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : fallback;
}

function attr(name, value) {
  return `${name}="${esc(value)}"`;
}

// Builds one <PIPINGELEMENT> per consecutive node pair, matching the
// attribute set read by 3D_Converters' InputXML->CII(2019) consumer
// (converters/scripts/inputxml_to_cii2019.py). FROM_NODE/TO_NODE are
// hard-required; DELTA_X/Y/Z default to 0.0 if absent/sentinel;
// DIAMETER/WALL_THICK/INSUL_THICK/CORR_ALLOW/TEMP_EXP_C1-9/PRESSURE_C1-9/
// MATERIAL_NUM/FLUID_DENSITY/INSUL_DENSITY/HYDRO_PRESSURE "carry forward"
// from the previous element if absent/sentinel; FROM_NAME/TO_NAME are read
// as plain text. TEMP_EXP_C4-9 and PRESSURE_C2-9 have no corresponding
// config field in this tool (only one temperature triple and one design
// pressure are collected), so they're always "0" — matching the CAESAR
// spec's own "non-specified real values are assigned a value of 0.0" rule,
// not a hidden default. LINE_ID is NOT emitted: the consumer has no
// attribute for it (a per-element line label exists via a separate
// "elements.line_label" config mechanism, unrelated to XML attributes).
function pipingElementXml(fromRow, toRow, branchInfo) {
  const deltaX = num(toRow.x - fromRow.x);
  const deltaY = num(toRow.y - fromRow.y);
  const deltaZ = num(toRow.z - fromRow.z);
  const attrs = [
    attr('FROM_NODE', fromRow.nodeNumber),
    attr('TO_NODE', toRow.nodeNumber),
    attr('DELTA_X', deltaX),
    attr('DELTA_Y', deltaY),
    attr('DELTA_Z', deltaZ),
    attr('DIAMETER', num(branchInfo.boreMm)),
    attr('WALL_THICK', num(branchInfo.wallThickness)),
    attr('INSUL_THICK', num(branchInfo.insulationThickness, '0')),
    attr('CORR_ALLOW', num(branchInfo.corrosionAllowance, '0')),
    attr('TEMP_EXP_C1', num(branchInfo.t1)),
    attr('TEMP_EXP_C2', num(branchInfo.t2)),
    attr('TEMP_EXP_C3', num(branchInfo.t3)),
    attr('TEMP_EXP_C4', '0'),
    attr('TEMP_EXP_C5', '0'),
    attr('TEMP_EXP_C6', '0'),
    attr('TEMP_EXP_C7', '0'),
    attr('TEMP_EXP_C8', '0'),
    attr('TEMP_EXP_C9', '0'),
    attr('PRESSURE_C1', num(branchInfo.p1)),
    attr('PRESSURE_C2', '0'),
    attr('PRESSURE_C3', '0'),
    attr('PRESSURE_C4', '0'),
    attr('PRESSURE_C5', '0'),
    attr('PRESSURE_C6', '0'),
    attr('PRESSURE_C7', '0'),
    attr('PRESSURE_C8', '0'),
    attr('PRESSURE_C9', '0'),
    attr('MATERIAL_NUM', num(branchInfo.materialCode)),
    attr('FLUID_DENSITY', num(branchInfo.fluidDensity, '0')),
    attr('INSUL_DENSITY', num(branchInfo.insulationDensity, '0')),
    attr('HYDRO_PRESSURE', num(branchInfo.hydroPressure)),
    attr('FROM_NAME', fromRow.nodeName),
    attr('TO_NAME', toRow.nodeName),
  ];
  return `<PIPINGELEMENT ${attrs.join(' ')}/>`;
}

// Builds the CAESARII > PIPINGMODEL > PIPINGELEMENT XML that
// InputXML->CII(2019) expects as its raw input (pre-enrichment). We do not
// modify that workflow — this only shapes our coordinate data to match its
// documented schema (see converters/scripts/inputxml_to_cii2019.py and
// tests/fixtures/xml-cii-standalone/inputxml-element-benchmark.xml).
export function buildInputXmlPipingModelXml(branchInfo, coordinateRows) {
  const elements = [];
  for (let i = 1; i < coordinateRows.length; i += 1) {
    elements.push(pipingElementXml(coordinateRows[i - 1], coordinateRows[i], branchInfo));
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<CAESARII>',
    `<PIPINGMODEL NUMELEMENTS="${elements.length}" NUMREST="0">`,
    ...elements,
    '</PIPINGMODEL>',
    '</CAESARII>',
  ].join('\n');
}

export const _internal = { toMm, SENTINEL_MISSING };
