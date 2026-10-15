export const NAVIS_TAG_ISONOTE_AUDIT_SCHEMA = 'navis-tag-isonote-audit/v5';
export const NAVIS_TAG_EVIDENCE_SCHEMA = 'navis-tag-evidence/v2';
export const STAGED_JSON_TREE_SCHEMA = 'staged-json-canonical-tree/v5';
export const IDENTITY_NODE_TRACE_SCHEMA = 'navis-tag-identity-node-trace/v5';
export const NAVIS_TAG_READINESS_SCHEMA = 'navis-tag-isonote-readiness/v3';

export const DEFAULT_NAVIS_TAG_ISONOTE_CONFIG = Object.freeze({
  tableIdentityColumns: ['Name of the element'],
  tableIdentityMode: 'first-non-empty',
  tableReferenceColumns: ['Reference of the element'],
  tablePositionMode: 'single',
  tablePositionColumn: 'POS',
  tableEastingColumn: '',
  tableNorthingColumn: '',
  tableElevationColumn: '',
  tablePipeColumns: ['PIPE', 'Branch', 'BranchName', 'Line ID'],
  tableUnits: 'auto',
  tableCoordinateProfileName: 'TABLE_DEFAULT',
  tableEastingDatumMm: 0,
  tableNorthingDatumMm: 0,
  tableElevationDatumMm: 0,
  jsonIdentityPaths: ['attributes.NAME', 'name'],
  jsonReferencePaths: ['attributes.REF', 'REF'],
  jsonPositionPaths: ['attributes.SUPPORTCOORD', 'attributes.POSI', 'attributes.POS', 'attributes.APOS', 'attributes.LPOS'],
  jsonBranchPaths: ['attributes.OWNER', 'attributes.BRANCH', 'attributes.BRANCHNAME'],
  jsonPipePaths: ['attributes.PIPE', 'attributes.PIPELINE', 'attributes.LINE', 'attributes.LINE_ID', 'attributes.PIPING_SYSTEM'],
  jsonZonePaths: ['attributes.ZONE', 'attributes.AREA', 'attributes.SITE', 'attributes.LOCATION'],
  jsonOdPaths: ['attributes.OUTSIDE_DIAMETER', 'attributes.OD', 'attributes.PIPE_OD'],
  jsonBorePaths: ['attributes.ABORE', 'attributes.LBORE', 'attributes.HBORE', 'attributes.BORE'],
  jsonUnits: 'auto',
  jsonCoordinateProfileName: 'JSON_DEFAULT',
  jsonEastingDatumMm: 0,
  jsonNorthingDatumMm: 0,
  jsonElevationDatumMm: 0,
  jsonOdUnits: 'mm',
  jsonBoreUnits: 'mm',
  navisUnits: 'auto',
  navisCoordinateProfileName: 'NAVIS_DEFAULT',
  navisEastingDatumMm: 0,
  navisNorthingDatumMm: 0,
  navisElevationDatumMm: 0,
  supportCoordinateSource: 'prefer-table-fallback-json',
  eastingToleranceMm: 100,
  northingToleranceMm: 100,
  elevationToleranceMm: 100,
  coordinateDisagreementToleranceMm: 100,
  useOdHalfAlternatives: true,
  ambiguityScoreGap: 15,
  boreToOdLookupEnabled: false,
  boreToOdLookupName: '',
  boreToOdLookup: {},
  navisAnchorTagId: '',
  navisAnchorSupportIdentity: '',
});

export function text(value) { return String(value ?? '').trim(); }
export function list(value, fallback = []) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const out = text(value).split(/[\n,]+/).map(text).filter(Boolean);
  return out.length ? out : [...fallback];
}
function configuredList(input, key, fallback) {
  if (!Object.prototype.hasOwnProperty.call(input || {}, key)) return [...fallback];
  if (Array.isArray(input[key])) return input[key].map(text).filter(Boolean);
  return text(input[key]).split(/[\n,]+/).map(text).filter(Boolean);
}
export function normalizeSupportIdentity(value) {
  return text(value).replace(/^\/+/, '').replace(/\s*\(\s*REF\s*\)\s*$/i, '').replace(/\s+/g, '').toUpperCase();
}
export function normalizeReference(value) {
  return text(value).replace(/^\/+/, '').replace(/\s+/g, '').toUpperCase();
}
export function supportRoot(value) {
  const normalized = normalizeSupportIdentity(value);
  const match = normalized.match(/(?:^|[^A-Z0-9])(PS|SL)-?(\d+)/i) || normalized.match(/^(PS|SL)-?(\d+)/i);
  return match ? `${match[1].toUpperCase()}-${match[2]}` : '';
}
export function unitScaleToMm(unit, values = []) {
  const normalized = text(unit).toLowerCase();
  const scale = { mm: 1, millimeter: 1, millimetre: 1, cm: 10, m: 1000, meter: 1000, metre: 1000, in: 25.4, inch: 25.4, ft: 304.8, feet: 304.8 }[normalized];
  if (scale) return scale;
  const finite = values.map(Number).filter(Number.isFinite).map(Math.abs);
  const max = finite.length ? Math.max(...finite) : 0;
  return max && max < 10000 ? 1000 : 1;
}
function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = text(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?/);
  const number = match ? Number(match[0]) : NaN;
  return Number.isFinite(number) ? number : null;
}
export function coordinateProfileOptions(config = {}, source = 'json') {
  const prefix = text(source).toLowerCase();
  const profilePrefix = prefix === 'table' ? 'table' : prefix === 'navis' ? 'navis' : 'json';
  return {
    profileName: text(config[`${profilePrefix}CoordinateProfileName`]) || `${profilePrefix.toUpperCase()}_DEFAULT`,
    eastingDatumMm: signedFiniteNumber(config[`${profilePrefix}EastingDatumMm`], 0),
    northingDatumMm: signedFiniteNumber(config[`${profilePrefix}NorthingDatumMm`], 0),
    elevationDatumMm: signedFiniteNumber(config[`${profilePrefix}ElevationDatumMm`], 0),
  };
}
function inlineCoordinateUnit(raw) {
  if (typeof raw !== 'string') return '';
  const units = [...raw.matchAll(/-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?\s*(mm|cm|m|ft|in)\b/gi)].map((match) => match[1].toLowerCase());
  return units.length && units.every((unit) => unit === units[0]) ? units[0] : '';
}
function directionalObjectPoint(raw) {
  const entries = Object.fromEntries(Object.entries(raw || {}).map(([key, value]) => [String(key).toUpperCase(), value]));
  const choose = (positive, negative, ordinary) => {
    for (const key of positive) {
      const value = numeric(entries[key]);
      if (Number.isFinite(value)) return Math.abs(value);
    }
    for (const key of negative) {
      const value = numeric(entries[key]);
      if (Number.isFinite(value)) return -Math.abs(value);
    }
    for (const key of ordinary) {
      const value = numeric(entries[key]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  };
  const x = choose(['E', 'EAST', 'EASTING'], ['W', 'WEST', 'WESTING'], ['X']);
  const y = choose(['N', 'NORTH', 'NORTHING'], ['S', 'SOUTH', 'SOUTHING'], ['Y']);
  const z = choose(['U', 'UP', 'EL', 'ELEV', 'ELEVATION'], ['D', 'DOWN'], ['Z']);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}
export function parseCoordinate(raw, unit = 'auto', options = {}) {
  if (raw == null || raw === '') return null;
  let point = null;
  let axisBasis = 'NUMERIC_TRIPLET';
  if (Array.isArray(raw)) {
    const values = raw.slice(0, 3).map(numeric);
    if (values.length === 3 && values.every(Number.isFinite)) point = { x: values[0], y: values[1], z: values[2] };
    axisBasis = 'ARRAY_XYZ';
  } else if (typeof raw === 'object') {
    point = directionalObjectPoint(raw);
    axisBasis = point && Object.keys(raw).some((key) => /^(E|W|N|S|U|D|EAST|WEST|NORTH|SOUTH|UP|DOWN|EL|ELEV|ELEVATION)$/i.test(key)) ? 'DIRECTIONAL_OBJECT' : 'OBJECT_XYZ';
  } else {
    const source = text(raw);
    const directional = {};
    const axisPattern = /\b(EASTING|EAST|WESTING|WEST|NORTHING|NORTH|SOUTHING|SOUTH|ELEVATION|ELEV|EL|UP|DOWN|E|W|N|S|U|D|Z)\s*[:=]?\s*(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)(?:\s*(mm|cm|m|ft|in))?/gi;
    source.replace(axisPattern, (_, axis, value) => {
      const key = axis.toUpperCase();
      const magnitude = Math.abs(Number(value));
      if (/^(E|EAST|EASTING)$/.test(key)) directional.x = magnitude;
      else if (/^(W|WEST|WESTING)$/.test(key)) directional.x = -magnitude;
      else if (/^(N|NORTH|NORTHING)$/.test(key)) directional.y = magnitude;
      else if (/^(S|SOUTH|SOUTHING)$/.test(key)) directional.y = -magnitude;
      else if (/^(D|DOWN)$/.test(key)) directional.z = -magnitude;
      else directional.z = magnitude;
      return '';
    });
    if ([directional.x, directional.y, directional.z].every(Number.isFinite)) {
      point = directional;
      axisBasis = 'DIRECTIONAL_ENU';
    }
    if (!point) {
      const values = source.match(/-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?/g)?.slice(0, 3).map(Number) || [];
      if (values.length === 3 && values.every(Number.isFinite)) point = { x: values[0], y: values[1], z: values[2] };
    }
  }
  if (!point) return null;
  const requestedUnit = text(unit).toLowerCase() || 'auto';
  const detectedUnit = requestedUnit === 'auto' ? inlineCoordinateUnit(raw) : '';
  const effectiveUnit = detectedUnit || requestedUnit;
  const scale = unitScaleToMm(effectiveUnit, [point.x, point.y, point.z]);
  const datumOffsetMm = {
    x: signedFiniteNumber(options.eastingDatumMm, 0),
    y: signedFiniteNumber(options.northingDatumMm, 0),
    z: signedFiniteNumber(options.elevationDatumMm, 0),
  };
  const rawPoint = { ...point };
  return {
    x: (point.x * scale) + datumOffsetMm.x,
    y: (point.y * scale) + datumOffsetMm.y,
    z: (point.z * scale) + datumOffsetMm.z,
    unitScale: scale,
    sourceUnit: effectiveUnit,
    requestedUnit,
    rawPoint,
    datumOffsetMm,
    profileName: text(options.profileName) || 'DEFAULT',
    axisBasis,
  };
}
function normalizeLookup(value) {
  let source = value;
  if (typeof source === 'string') { try { source = JSON.parse(source || '{}'); } catch { return {}; } }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const output = {};
  for (const [key, raw] of Object.entries(source)) {
    const number = Number(raw);
    if (text(key) && Number.isFinite(number) && number > 0) output[text(key)] = number;
  }
  return output;
}
export function normalizeConfig(input = {}) {
  const defaults = DEFAULT_NAVIS_TAG_ISONOTE_CONFIG;
  return {
    ...defaults,
    ...input,
    tableIdentityColumns: configuredList(input, 'tableIdentityColumns', defaults.tableIdentityColumns),
    tableReferenceColumns: configuredList(input, 'tableReferenceColumns', defaults.tableReferenceColumns),
    tablePipeColumns: configuredList(input, 'tablePipeColumns', defaults.tablePipeColumns),
    jsonIdentityPaths: configuredList(input, 'jsonIdentityPaths', defaults.jsonIdentityPaths),
    jsonReferencePaths: configuredList(input, 'jsonReferencePaths', defaults.jsonReferencePaths),
    jsonPositionPaths: configuredList(input, 'jsonPositionPaths', defaults.jsonPositionPaths),
    jsonBranchPaths: configuredList(input, 'jsonBranchPaths', defaults.jsonBranchPaths),
    jsonPipePaths: configuredList(input, 'jsonPipePaths', defaults.jsonPipePaths),
    jsonZonePaths: configuredList(input, 'jsonZonePaths', defaults.jsonZonePaths),
    jsonOdPaths: configuredList(input, 'jsonOdPaths', defaults.jsonOdPaths),
    jsonBorePaths: configuredList(input, 'jsonBorePaths', defaults.jsonBorePaths),
    eastingToleranceMm: finiteNumber(input.eastingToleranceMm, defaults.eastingToleranceMm),
    northingToleranceMm: finiteNumber(input.northingToleranceMm, defaults.northingToleranceMm),
    elevationToleranceMm: finiteNumber(input.elevationToleranceMm, defaults.elevationToleranceMm),
    coordinateDisagreementToleranceMm: finiteNumber(input.coordinateDisagreementToleranceMm, defaults.coordinateDisagreementToleranceMm),
    tableEastingDatumMm: signedFiniteNumber(input.tableEastingDatumMm, defaults.tableEastingDatumMm),
    tableNorthingDatumMm: signedFiniteNumber(input.tableNorthingDatumMm, defaults.tableNorthingDatumMm),
    tableElevationDatumMm: signedFiniteNumber(input.tableElevationDatumMm, defaults.tableElevationDatumMm),
    jsonEastingDatumMm: signedFiniteNumber(input.jsonEastingDatumMm, defaults.jsonEastingDatumMm),
    jsonNorthingDatumMm: signedFiniteNumber(input.jsonNorthingDatumMm, defaults.jsonNorthingDatumMm),
    jsonElevationDatumMm: signedFiniteNumber(input.jsonElevationDatumMm, defaults.jsonElevationDatumMm),
    navisEastingDatumMm: signedFiniteNumber(input.navisEastingDatumMm, defaults.navisEastingDatumMm),
    navisNorthingDatumMm: signedFiniteNumber(input.navisNorthingDatumMm, defaults.navisNorthingDatumMm),
    navisElevationDatumMm: signedFiniteNumber(input.navisElevationDatumMm, defaults.navisElevationDatumMm),
    ambiguityScoreGap: finiteNumber(input.ambiguityScoreGap, defaults.ambiguityScoreGap),
    useOdHalfAlternatives: input.useOdHalfAlternatives !== false,
    boreToOdLookupEnabled: input.boreToOdLookupEnabled === true || input.boreToOdLookupEnabled === 'true',
    boreToOdLookupName: text(input.boreToOdLookupName),
    boreToOdLookup: normalizeLookup(input.boreToOdLookup),
    navisAnchorTagId: text(input.navisAnchorTagId),
    navisAnchorSupportIdentity: text(input.navisAnchorSupportIdentity),
  };
}
function signedFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
export function firstConfiguredValue(node, paths = []) {
  for (const path of paths) {
    if (!Object.prototype.hasOwnProperty.call(node?.values || {}, path)) continue;
    const value = node.values[path];
    if (value !== '' && value != null) return { path, value };
  }
  return { path: '', value: null };
}
