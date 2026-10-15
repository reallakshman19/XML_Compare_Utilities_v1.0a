import { deepFreeze } from './cii-workspace-contracts.js';

export const CII_CAPABILITY_STATES = Object.freeze({
  PARSED: 'PARSED', EMPTY: 'EMPTY', NOT_PARSED: 'NOT_PARSED', UNSUPPORTED: 'UNSUPPORTED', PARSE_ERROR: 'PARSE_ERROR',
});
const QUALIFICATION = Object.freeze({ QUALIFIED: 'QUALIFIED', PARTIAL: 'PARTIAL', NONE: 'NONE' });

function sectionMap(rawText) {
  const sections = new Map(); let active = null;
  for (const row of String(rawText ?? '').split(/\r?\n/)) {
    const marker = row.match(/^\s*#\$\s*(.+?)\s*$/);
    if (marker) { active = marker[1].trim().toUpperCase(); if (!sections.has(active)) sections.set(active, []); continue; }
    if (active) sections.get(active).push(row);
  }
  return sections;
}
function rawSectionEvidence(sections, names = []) {
  const requested = names.map((name) => String(name).toUpperCase()); const present = requested.filter((name) => sections.has(name));
  const rows = present.flatMap((name) => sections.get(name) || []); const dataRows = rows.filter((row) => {
    const text = row.trim(); return text && !text.startsWith('*') && !/^-1(?:\.0+)?\s+-1(?:\.0+)?$/.test(text);
  });
  return Object.freeze({ requestedSections: Object.freeze(requested), presentSections: Object.freeze(present), present: present.length > 0, nonEmptyRowCount: dataRows.length });
}
function parserArrayCapability(parsed, sections, config) {
  const raw = rawSectionEvidence(sections, config.sections); const value = parsed?.[config.parsedKey];
  if (!Array.isArray(value)) return deepFreeze({ state: CII_CAPABILITY_STATES.PARSE_ERROR, count: null, qualification: QUALIFICATION.NONE,
    authority: config.authority, raw, limitations: Object.freeze(['Expected parser output is unavailable or malformed.']) });
  return deepFreeze({ state: value.length ? CII_CAPABILITY_STATES.PARSED : CII_CAPABILITY_STATES.EMPTY, count: value.length,
    qualification: config.qualification || QUALIFICATION.QUALIFIED, authority: config.authority, raw, limitations: Object.freeze(config.limitations || []) });
}
function unparsedCapability(sections, config) {
  return deepFreeze({ state: config.state || CII_CAPABILITY_STATES.NOT_PARSED, count: null, qualification: QUALIFICATION.NONE, authority: null,
    raw: rawSectionEvidence(sections, config.sections || []), limitations: Object.freeze(config.limitations || ['No qualified semantic parser is connected for this family.']) });
}
function finiteValues(values) { return values.map(Number).filter(Number.isFinite); }
function nonZeroUnique(values) { return [...new Set(finiteValues(values).filter((value) => value !== 0))].sort((a, b) => a - b); }
function numericRange(values) { const finite = finiteValues(values); return finite.length ? Object.freeze({ min: Math.min(...finite), max: Math.max(...finite) }) : null; }
function nodeCapability(parsed, sections) {
  const nodes = parsed?.nodes;
  if (!nodes || Array.isArray(nodes) || typeof nodes !== 'object') return deepFreeze({ state: CII_CAPABILITY_STATES.PARSE_ERROR, count: null,
    qualification: QUALIFICATION.NONE, authority: 'parser/sections/elements.js#nodes', raw: rawSectionEvidence(sections, ['ELEMENTS']),
    limitations: Object.freeze(['Expected parsed node map is unavailable or malformed.']) });
  const count = Object.keys(nodes).length;
  return deepFreeze({ state: count ? CII_CAPABILITY_STATES.PARSED : CII_CAPABILITY_STATES.EMPTY, count, qualification: QUALIFICATION.QUALIFIED,
    authority: 'parser/sections/elements.js#nodes', raw: rawSectionEvidence(sections, ['ELEMENTS']), limitations: Object.freeze([]) });
}
function pipePropertyCapability(parsed, sections) {
  const elements = Array.isArray(parsed?.elements) ? parsed.elements : null;
  if (!elements) return parserArrayCapability(parsed, sections, { parsedKey: 'elements', sections: ['ELEMENTS'], authority: 'parser/sections/elements.js' });
  const ods = finiteValues(elements.map((element) => element.od)).filter((value) => value > 0);
  const walls = finiteValues(elements.map((element) => element.wall)).filter((value) => value > 0);
  return deepFreeze({ state: elements.length ? CII_CAPABILITY_STATES.PARSED : CII_CAPABILITY_STATES.EMPTY, count: elements.length,
    qualification: QUALIFICATION.QUALIFIED, authority: 'parser/sections/elements.js', raw: rawSectionEvidence(sections, ['ELEMENTS']),
    details: Object.freeze({ uniqueODs: Object.freeze([...new Set(ods)].sort((a, b) => a - b)), odRange: numericRange(ods),
      uniqueWalls: Object.freeze([...new Set(walls)].sort((a, b) => a - b)), wallRange: numericRange(walls) }), limitations: Object.freeze([]) });
}
function processCapability(parsed, sections) {
  const elements = Array.isArray(parsed?.elements) ? parsed.elements : null;
  if (!elements) return deepFreeze({ state: CII_CAPABILITY_STATES.PARSE_ERROR, count: null, qualification: QUALIFICATION.NONE,
    authority: 'parser/sections/elements.js', raw: rawSectionEvidence(sections, ['ELEMENTS']), limitations: Object.freeze(['Element process fields are unavailable.']) });
  const pressures = nonZeroUnique(elements.flatMap((element) => Array.from({ length: 9 }, (_, index) => element[`P${index + 1}`])));
  const temperatures = nonZeroUnique(elements.flatMap((element) => Array.from({ length: 9 }, (_, index) => element[`T${index + 1}`])));
  const insulationDensities = nonZeroUnique(elements.map((element) => element.insulationDensity));
  const fluidDensities = nonZeroUnique(elements.map((element) => element.fluidDensity));
  const hydroPressures = nonZeroUnique(elements.map((element) => element.hydroPressure));
  return deepFreeze({
    state: elements.length ? CII_CAPABILITY_STATES.PARSED : CII_CAPABILITY_STATES.EMPTY, count: elements.length,
    qualification: QUALIFICATION.PARTIAL, authority: 'parser/sections/elements.js#WRITER_1B_FIXED_FIELDS', raw: rawSectionEvidence(sections, ['ELEMENTS']),
    details: Object.freeze({
      elementRecordCount: elements.length,
      uniquePressureValueCount: pressures.length, pressureValues: Object.freeze(pressures), pressureRange: numericRange(pressures),
      uniqueTemperatureValueCount: temperatures.length, temperatureValues: Object.freeze(temperatures), temperatureRange: numericRange(temperatures),
      insulationDensityValues: Object.freeze(insulationDensities), fluidDensityValues: Object.freeze(fluidDensities), hydroPressureValues: Object.freeze(hydroPressures),
      exactFixedFields: Object.freeze(['P1','P2','P3','P4','P5','P6','P7','P8','P9','T1','T2','T3','T4','T5','T6','T7','T8','T9','insulationDensity','fluidDensity','hydroPressure']),
    }),
    limitations: Object.freeze(['Exact Writer 1B fixed fields are normalized individually; unique values are revision evidence, not qualified CAESAR load-case counts or a complete process-data model.']),
  });
}
function nodeNameCapability(nodeNameEvidence) {
  const names = Object.keys(nodeNameEvidence?.names || {}); const conflicts = nodeNameEvidence?.conflicts || [];
  return deepFreeze({ state: names.length ? CII_CAPABILITY_STATES.PARSED : CII_CAPABILITY_STATES.EMPTY, count: names.length,
    qualification: conflicts.length ? QUALIFICATION.PARTIAL : QUALIFICATION.QUALIFIED, authority: 'tabs/cii-workspace/cii-workspace-nodename.js',
    raw: Object.freeze({ present: Number(nodeNameEvidence?.rowCount || 0) > 0, nonEmptyRowCount: Number(nodeNameEvidence?.rowCount || 0) }),
    details: Object.freeze({ conflictCount: conflicts.length }),
    limitations: Object.freeze(conflicts.length ? ['Conflicting or unmappable NODENAME evidence exists; conflicting node names are withheld.'] : []) });
}
function lineNumberCapability(rawText, sections) {
  const markers = String(rawText ?? '').match(/\bLINENO\d*\b/gi) || [];
  return deepFreeze({ state: CII_CAPABILITY_STATES.NOT_PARSED, count: null, qualification: QUALIFICATION.NONE, authority: null,
    raw: Object.freeze({ ...rawSectionEvidence(sections, ['ELEMENTS']), markerCount: markers.length, markersPresent: markers.length > 0 }),
    limitations: Object.freeze(['LINENO markers are detected only as raw evidence; no element-bound line-number semantic parser is qualified.']) });
}
function restraintDetails(restraints) {
  const rows = restraints.flatMap((restraint) => Array.isArray(restraint?.rows) ? restraint.rows : []);
  return Object.freeze({ nodeCount: restraints.length, rawRecordCount: rows.length });
}

export function buildCiiWorkspaceCapabilities(rawText, parsed = {}, nodeNameEvidence = {}) {
  const sections = sectionMap(rawText);
  const restraints = parserArrayCapability(parsed, sections, { parsedKey: 'restraints', sections: ['RESTRANT'], authority: 'parser/sections/restraints.js', qualification: QUALIFICATION.PARTIAL,
    limitations: ['Raw restraint rows are retained, but derived type semantics are not qualified for all CAESAR restraint codes and gap/friction fields are not normalized.'] });
  const restraintValues = Array.isArray(parsed?.restraints) ? parsed.restraints : [];
  return deepFreeze({ schema: 'CIIWorkspaceCapabilities.v1', states: CII_CAPABILITY_STATES,
    sections: Object.freeze(Object.fromEntries([...sections.entries()].map(([name, rows]) => [name, Object.freeze({ present: true, rowCount: rows.filter((row) => row.trim()).length })]))),
    families: Object.freeze({
      nodes: nodeCapability(parsed, sections),
      elements: parserArrayCapability(parsed, sections, { parsedKey: 'elements', sections: ['ELEMENTS'], authority: 'parser/sections/elements.js' }),
      bends: parserArrayCapability(parsed, sections, { parsedKey: 'bends', sections: ['BEND'], authority: 'parser/sections/bends.js' }),
      restraints: deepFreeze({ ...restraints, details: restraintDetails(restraintValues) }),
      forces: parserArrayCapability(parsed, sections, { parsedKey: 'forces', sections: ['FORCMNT'], authority: 'parser/sections/forces.js' }),
      rigidMass: parserArrayCapability(parsed, sections, { parsedKey: 'rigids', sections: ['RIGID'], authority: 'parser/caesar-parser.js#parseRigids' }),
      nodeNames: nodeNameCapability(nodeNameEvidence), pipeProperties: pipePropertyCapability(parsed, sections), process: processCapability(parsed, sections),
      lineNumbers: lineNumberCapability(rawText, sections),
      hangers: unparsedCapability(sections, { sections: ['HANGER', 'HANGERS'] }),
      sifTee: unparsedCapability(sections, { sections: ['SIF'], limitations: ['SIF/tee raw section evidence may exist, but no qualified CII Workspace semantic parser is connected.'] }),
      weightData: unparsedCapability(sections, { sections: ['WEIGHT', 'MISCEL'], limitations: ['General weight/miscellaneous engineering data is not normalized; parsed RIGID mass is reported separately as rigidMass.'] }),
    }),
  });
}

export function capabilityCount(capability) {
  return capability?.state === CII_CAPABILITY_STATES.PARSED || capability?.state === CII_CAPABILITY_STATES.EMPTY ? Number(capability.count || 0) : null;
}
