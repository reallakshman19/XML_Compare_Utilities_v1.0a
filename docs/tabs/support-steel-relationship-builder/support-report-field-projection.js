import {
  deriveSupportReportNominalSizeMm,
  normalizeSupportReportSizeValue,
  supportReportPreviousName,
} from './support-report-field-normalization.js?v=20260911-support-report-pos-trace-20';

const SUPPORT_TYPE_KEYS = Object.freeze([
  'CMPSUPTYPE', 'MDSSUPPTYPE', 'SUPPORT_TYPE', 'SUPTYPE', 'TYPE_TEXT', 'STYPE',
]);
const SUPPORT_REFERENCE_KEYS = Object.freeze([
  'PIPING_PRIMARY_SUPPORT_REFERENCE', 'PRIMARY_SUPPORT_REFERENCE', 'SUPPORT_REFERENCE',
  'SUPPORT_REF', 'DBREF', 'REFNO', 'REFERENCE', 'REF',
]);
const DESCRIPTION_KEYS = Object.freeze(['DTXR', 'DESCRIPTION', 'DESC', 'LONG_DESCRIPTION']);
const REMARK_KEYS = Object.freeze(['REMARKS', 'REMARK', 'STATUS_NOTE', 'COMMENTS', 'COMMENT']);
const PIPE_SIZE_PRIMARY_KEYS = Object.freeze(['BORE']);
const PIPE_SIZE_FALLBACK_KEYS = Object.freeze([
  'ABORE', 'NOMINAL_BORE', 'NOMINAL_DIAMETER', 'DN', 'PIPE_SIZE', 'SIZE',
]);
const PIPE_SCHEDULE_KEYS = Object.freeze(['PIPE_SCHEDULE', 'SCHEDULE', 'SCH', 'WALL_SCHEDULE', 'PIPE_SCH']);
const INSULATION_THICKNESS_KEYS = Object.freeze([
  'PIPE_INSULATION_THICKNESS', 'INSULATION_THICKNESS', 'INS_THK', 'ITHK', 'THICKNESS_INSULATION',
]);
const INSULATION_TYPE_KEYS = Object.freeze(['PIPE_INSULATION_TYPE', 'INSULATION_TYPE', 'INS_TYPE', 'ITYPE']);
const STRESS_SYSTEM_KEYS = Object.freeze([
  'STRESS_SYSTEM_NUMBER', 'STRESS_SYS_NO', 'STRESS_SYSTEM', 'SYSTEM_NUMBER', 'SYSTEM_NO',
]);
const NODE_NUMBER_KEYS = Object.freeze(['NODE_NO', 'NODE_NUMBER', 'STRESS_NODE', 'CAESAR_NODE']);
const REVISION_KEYS = Object.freeze(['REVISION', 'REVISION_NO', 'REVISION_NUMBER', 'REV_NO', 'REV']);
const CARRIER_FIELD_SPECS = Object.freeze([
  Object.freeze({ field: 'size', resolve: resolveCarrierSize }),
  Object.freeze({ field: 'pipeSchedule', keys: PIPE_SCHEDULE_KEYS }),
  Object.freeze({ field: 'pipeInsulationThickness', keys: INSULATION_THICKNESS_KEYS }),
  Object.freeze({ field: 'pipeInsulationType', keys: INSULATION_TYPE_KEYS }),
  Object.freeze({ field: 'stressSystemNumber', keys: STRESS_SYSTEM_KEYS }),
  Object.freeze({ field: 'nodeNumber', keys: NODE_NUMBER_KEYS }),
  Object.freeze({ field: 'revision', keys: REVISION_KEYS }),
]);

export const SUPPORT_REPORT_FIELD_SOURCE_CLASSES = Object.freeze({
  NATIVE_MEMBER_ATTRIBUTE: 'AUTHORITATIVE_NATIVE_MEMBER_ATTRIBUTE',
  NATIVE_MEMBERSHIP: 'AUTHORITATIVE_NATIVE_MEMBERSHIP',
  NATIVE_MEMBER_LIST_STRUCTURE: 'AUTHORITATIVE_NATIVE_MEMBER_LIST_STRUCTURE',
  NATIVE_MEMBER_POSITION: 'AUTHORITATIVE_NATIVE_MEMBER_POSITION',
  NATIVE_MEMBER_PATH: 'AUTHORITATIVE_NATIVE_MEMBER_PATH',
  CARRIER_ATTRIBUTE: 'AUTHORITATIVE_CARRIER_ATTRIBUTE',
  SOURCE_CONFLICT: 'AUTHORITATIVE_SOURCE_CONFLICT',
  CLASH_RELATIONSHIP: 'CLASH_RELATIONSHIP_EVIDENCE',
  CLASH_GROUP_DERIVATION: 'CLASH_GROUP_DERIVATION',
  CLASH_PRIMARY_PATH: 'CLASH_PRIMARY_PATH_DERIVATION',
  CLASH_MEMBER_FALLBACK: 'CLASH_MEMBER_FALLBACK',
  CLASH_POINT_FALLBACK: 'CLASH_POINT_FALLBACK',
  LINE_TAG_DERIVATION: 'DETERMINISTIC_LINE_TAG_DERIVATION',
  FIELD_COMPOSITION: 'DETERMINISTIC_FIELD_COMPOSITION',
  UNRESOLVED: 'UNRESOLVED',
});

export function projectSupportReportFields({ group, reportMembers, carrierRows, coordinatePoint }) {
  const primaryPath = choosePrimaryPath(group?.primaryPaths || []);
  const size = resolveCarrierSize(carrierRows);
  const schedule = resolveCarrierAttribute(carrierRows, PIPE_SCHEDULE_KEYS);
  const insulationThickness = resolveCarrierAttribute(carrierRows, INSULATION_THICKNESS_KEYS);
  const insulationType = resolveCarrierAttribute(carrierRows, INSULATION_TYPE_KEYS);
  const stressSystem = resolveCarrierAttribute(carrierRows, STRESS_SYSTEM_KEYS);
  const nodeNumber = resolveCarrierAttribute(carrierRows, NODE_NUMBER_KEYS);
  const revision = resolveCarrierAttribute(carrierRows, REVISION_KEYS);
  const supportSite = resolvePrimaryPathField(primaryPath, reportMembers, 'site');
  const supportZone = resolvePrimaryPathField(primaryPath, reportMembers, 'zone');
  return Object.freeze({
    previousName: joinMemberValues(reportMembers, supportReportPreviousName),
    scope: group?.scope || deriveScope(group?.fullLineTag),
    civilSecondarySupport: group?.secondarySupportFamilyId ? `${group.secondarySupportFamilyId}(REF)` : '',
    pipe: stripLeadingSlash(group?.fullLineTag),
    size: size.conflict ? '' : (size.value || deriveNominalSizeMm(group?.fullLineTag)),
    pipingPrimarySupport: joinMemberValues(reportMembers, (member) => normalizeMemberId(member.memberId)),
    supportType: joinMemberValues(reportMembers, supportType),
    pipingPrimarySupportReference: joinMemberValues(reportMembers, (member) => memberAttribute(member, SUPPORT_REFERENCE_KEYS)),
    eastWest: formatHorizontalCoordinate(coordinatePoint?.x, 'E', 'W'),
    northSouth: formatHorizontalCoordinate(coordinatePoint?.y, 'N', 'S'),
    bopElevation: formatVerticalCoordinate(coordinatePoint?.z),
    totalSupportPointsOnSecondary: group?.totalSupportPointsOnSecondary ?? 0,
    remarks: joinMemberValues(reportMembers, (member) => memberAttribute(member, REMARK_KEYS), { keepBlanks: true }),
    primarySupportDescription: joinMemberValues(reportMembers, (member) => memberAttribute(member, DESCRIPTION_KEYS)),
    primarySupportZone: supportZone.conflict ? '' : supportZone.value,
    primarySupportSite: supportSite.conflict ? '' : supportSite.value,
    pipeSchedule: schedule.value,
    pipeInsulationThickness: insulationThickness.value,
    pipeInsulationType: insulationType.value,
    pipeInsulationTypeAndThickness: [insulationType.value, insulationThickness.value].filter(Boolean).join(' '),
    stressSystemNumber: stressSystem.value,
    nodeNumber: nodeNumber.value,
    revision: revision.value,
  });
}

export function projectSupportReportFieldProvenance(input = {}) {
  const { group, reportMembers = [], carrierRows = [], selectedNativeMemberCount = 0 } = input;
  const primaryPath = choosePrimaryPath(group?.primaryPaths || []);
  const size = resolveCarrierSize(carrierRows);
  const insulationType = carrierSource(resolveCarrierAttribute(carrierRows, INSULATION_TYPE_KEYS));
  const insulationThickness = carrierSource(resolveCarrierAttribute(carrierRows, INSULATION_THICKNESS_KEYS));
  const supportSite = resolvePrimaryPathField(primaryPath, reportMembers, 'site');
  const supportZone = resolvePrimaryPathField(primaryPath, reportMembers, 'zone');
  const membership = reportMembers.length
    ? source(selectedNativeMemberCount ? SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBERSHIP
      : SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_MEMBER_FALLBACK, memberIds(reportMembers))
    : unresolved();
  const coordinate = coordinateSource(input.coordinateSource, input.coordinateSourceIds || []);
  return Object.freeze({
    previousName: projectedMemberSource(reportMembers, supportReportPreviousName),
    scope: group?.scope || group?.fullLineTag ? source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_RELATIONSHIP) : unresolved(),
    civilSecondarySupport: group?.secondarySupportFamilyId ? source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_RELATIONSHIP) : unresolved(),
    pipe: group?.fullLineTag ? source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_RELATIONSHIP) : unresolved(),
    size: size.conflict ? carrierSource(size) : size.value ? carrierSource(size)
      : deriveNominalSizeMm(group?.fullLineTag) ? source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.LINE_TAG_DERIVATION) : unresolved(),
    pipingPrimarySupport: membership,
    supportType: memberSource(reportMembers, SUPPORT_TYPE_KEYS),
    pipingPrimarySupportReference: memberSource(reportMembers, SUPPORT_REFERENCE_KEYS),
    eastWest: coordinate,
    northSouth: coordinate,
    bopElevation: coordinate,
    totalSupportPointsOnSecondary: Number.isFinite(group?.totalSupportPointsOnSecondary)
      ? source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_GROUP_DERIVATION) : unresolved(),
    remarks: memberSource(reportMembers, REMARK_KEYS, selectedNativeMemberCount > 0),
    primarySupportDescription: memberSource(reportMembers, DESCRIPTION_KEYS),
    primarySupportZone: primaryPathFieldSource(supportZone),
    primarySupportSite: primaryPathFieldSource(supportSite),
    pipeSchedule: carrierSource(resolveCarrierAttribute(carrierRows, PIPE_SCHEDULE_KEYS)),
    pipeInsulationThickness: insulationThickness,
    pipeInsulationType: insulationType,
    pipeInsulationTypeAndThickness: compositionSource(insulationType, insulationThickness),
    stressSystemNumber: carrierSource(resolveCarrierAttribute(carrierRows, STRESS_SYSTEM_KEYS)),
    nodeNumber: carrierSource(resolveCarrierAttribute(carrierRows, NODE_NUMBER_KEYS)),
    revision: carrierSource(resolveCarrierAttribute(carrierRows, REVISION_KEYS)),
  });
}

export function supportReportCarrierAttributeConflicts(carrierRows = []) {
  return CARRIER_FIELD_SPECS.map((spec) => {
    const resolved = spec.resolve ? spec.resolve(carrierRows) : resolveCarrierAttribute(carrierRows, spec.keys);
    if (!resolved.conflict) return null;
    return Object.freeze({ field: spec.field, values: resolved.values, carrierValues: resolved.carrierValues });
  }).filter(Boolean);
}

function carrierSource(resolved) {
  if (resolved.conflict) return source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.SOURCE_CONFLICT,
    resolved.carrierValues.map((item) => item.carrierObjectId), { values: resolved.values });
  return resolved.value ? source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CARRIER_ATTRIBUTE,
    resolved.carrierValues.map((item) => item.carrierObjectId)) : unresolved();
}
function memberSource(members, keys, allowStructureOnly = false) {
  const withValues = (members || []).filter((member) => memberAttribute(member, keys));
  if (withValues.length) return source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_ATTRIBUTE, memberIds(withValues));
  if (allowStructureOnly && members.length) return source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_LIST_STRUCTURE,
    memberIds(members), { valueStatus: 'STRUCTURE_ONLY' });
  return unresolved();
}
function projectedMemberSource(members, selector) {
  const withValues = (members || []).filter((member) => clean(selector(member)));
  return withValues.length
    ? source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_ATTRIBUTE, memberIds(withValues))
    : unresolved();
}
function coordinateSource(kind, ids) {
  if (kind === 'NATIVE_MEMBER_POSITION') return source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_POSITION, ids);
  if (kind === 'CLASH_POINT_FALLBACK') return source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_POINT_FALLBACK);
  return unresolved();
}
function primaryPathFieldSource(resolved) {
  if (resolved.conflict) return source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.SOURCE_CONFLICT,
    resolved.sourceIds, { values: resolved.values });
  if (resolved.sourceClass) return source(resolved.sourceClass, resolved.sourceIds);
  return unresolved();
}
function compositionSource(...entries) {
  return entries.some((entry) => entry.sourceClass !== SUPPORT_REPORT_FIELD_SOURCE_CLASSES.UNRESOLVED)
    ? source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.FIELD_COMPOSITION, [], { dependsOn: ['pipeInsulationType', 'pipeInsulationThickness'] })
    : unresolved();
}
function source(sourceClass, sourceIds = [], extra = {}) {
  return Object.freeze({
    sourceClass,
    confidenceClass: confidenceClass(sourceClass),
    valueStatus: extra.valueStatus || (sourceClass === SUPPORT_REPORT_FIELD_SOURCE_CLASSES.SOURCE_CONFLICT ? 'CONFLICT' : 'RESOLVED'),
    sourceIds: Object.freeze([...new Set(sourceIds.filter(Boolean))]),
    ...extra,
  });
}
function unresolved() {
  return source(SUPPORT_REPORT_FIELD_SOURCE_CLASSES.UNRESOLVED, [], { valueStatus: 'UNRESOLVED' });
}
function confidenceClass(sourceClass) {
  if (sourceClass.startsWith('AUTHORITATIVE_') && !sourceClass.endsWith('_CONFLICT')) return 'AUTHORITATIVE';
  if (sourceClass.startsWith('DETERMINISTIC_')) return 'DETERMINISTIC';
  if (sourceClass === SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_MEMBER_FALLBACK
    || sourceClass === SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_POINT_FALLBACK) return 'FALLBACK';
  if (sourceClass === SUPPORT_REPORT_FIELD_SOURCE_CLASSES.SOURCE_CONFLICT) return 'CONFLICT';
  if (sourceClass === SUPPORT_REPORT_FIELD_SOURCE_CLASSES.UNRESOLVED) return 'UNRESOLVED';
  return 'EVIDENCE';
}
function memberIds(members) { return (members || []).map((member) => normalizeMemberId(member.memberId)).filter(Boolean); }
function resolveCarrierSize(carrierRows) {
  const bore = resolveCarrierSizeValues(carrierRows, PIPE_SIZE_PRIMARY_KEYS);
  if (bore.value || bore.conflict) return bore;
  return resolveCarrierSizeValues(carrierRows, PIPE_SIZE_FALLBACK_KEYS);
}
function resolveCarrierSizeValues(carrierRows, keys) {
  const carrierValues = (carrierRows || []).map((row) => {
    const raw = firstAttribute([row?.attributes || {}], keys);
    return { carrierObjectId: clean(row?.carrierObjectId), value: normalizeSupportReportSizeValue(raw) };
  }).filter((row) => row.value !== '').sort((left, right) => left.carrierObjectId.localeCompare(right.carrierObjectId)
    || Number(left.value) - Number(right.value));
  const values = [...new Set(carrierValues.map((row) => row.value))].sort((a, b) => Number(a) - Number(b));
  return Object.freeze({ value: values.length === 1 ? values[0] : '', conflict: values.length > 1, values, carrierValues });
}
function resolveCarrierAttribute(carrierRows, keys) {
  const carrierValues = (carrierRows || []).map((row) => ({
    carrierObjectId: clean(row?.carrierObjectId), value: firstAttribute([row?.attributes || {}], keys),
  })).filter((row) => row.value).sort((left, right) => left.carrierObjectId.localeCompare(right.carrierObjectId)
    || left.value.localeCompare(right.value));
  const values = [...new Set(carrierValues.map((row) => row.value))].sort((a, b) => a.localeCompare(b));
  return Object.freeze({ value: values.length === 1 ? values[0] : '', conflict: values.length > 1, values, carrierValues });
}
function memberAttribute(member, keys) { return firstAttribute([member?.attributes || {}], keys); }
function supportType(member) { return memberAttribute(member, SUPPORT_TYPE_KEYS); }
function firstAttribute(attributeRows, keys) {
  for (const attrs of attributeRows || []) {
    const normalized = normalizeAttributeMap(attrs);
    for (const key of keys || []) {
      const value = clean(normalized.get(normalizeKey(key)));
      if (value) return value;
    }
  }
  return '';
}
function normalizeAttributeMap(attrs) {
  const map = new Map();
  for (const [key, value] of Object.entries(attrs || {})) map.set(normalizeKey(key), value);
  return map;
}
function normalizeKey(value) { return String(value || '').replace(/[\s./-]+/g, '_').toUpperCase(); }
function joinMemberValues(members, selector, options = {}) {
  const values = (members || []).map((member) => clean(selector(member)));
  if (options.keepBlanks) {
    if (!values.length || !values.some(Boolean)) return '';
    return values.length === 1 ? values[0] : values.join(', ');
  }
  return values.filter(Boolean).join(', ');
}
function choosePrimaryPath(paths) { return [...(paths || [])].sort((a, b) => b.length - a.length)[0] || []; }
function resolvePrimaryPathField(path, members, field) {
  const nativeRows = (members || []).map((member) => ({
    memberId: normalizeMemberId(member?.memberId),
    value: supportPathHierarchy(member?.sourcePath || [])[field],
  })).filter((row) => row.value);
  const nativeValues = [...new Set(nativeRows.map((row) => row.value))];
  if (nativeValues.length > 1) return Object.freeze({
    value: '', conflict: true, values: nativeValues.sort(),
    sourceClass: SUPPORT_REPORT_FIELD_SOURCE_CLASSES.SOURCE_CONFLICT,
    sourceIds: nativeRows.map((row) => row.memberId).filter(Boolean),
  });
  if (nativeValues.length === 1) return Object.freeze({
    value: nativeValues[0], conflict: false, values: nativeValues,
    sourceClass: SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_PATH,
    sourceIds: nativeRows.map((row) => row.memberId).filter(Boolean),
  });
  const clashValue = supportPathHierarchy(path)[field];
  if (clashValue) return Object.freeze({
    value: clashValue, conflict: false, values: [clashValue],
    sourceClass: SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_PRIMARY_PATH,
    sourceIds: [],
  });
  return Object.freeze({ value: '', conflict: false, values: [], sourceClass: '', sourceIds: [] });
}
function supportPathHierarchy(path) {
  const nodes = flattenPath(path).map(stripLeadingSlash).filter(Boolean);
  const siteIndex = nodes.findIndex((node) => /-CU-[A-Z0-9]+$/iu.test(node));
  if (siteIndex < 0) return Object.freeze({ site: '', zone: '' });
  const site = nodes[siteIndex];
  const zone = nodes.slice(siteIndex + 1).find((node) => node.startsWith(`${site}-`)) || '';
  return Object.freeze({ site, zone });
}
function flattenPath(path) {
  if (Array.isArray(path)) return path.flatMap(flattenPath);
  if (!path) return [];
  return String(path).split(/[\\/]+/).filter(Boolean);
}
function deriveScope(fullLineTag) {
  const line = stripLeadingSlash(fullLineTag);
  return line.includes('-') ? line.split('-')[0] : line;
}
function deriveNominalSizeMm(fullLineTag) { return deriveSupportReportNominalSizeMm(fullLineTag); }
function formatHorizontalCoordinate(value, positive, negative) {
  if (!Number.isFinite(value)) return '';
  return `${value < 0 ? negative : positive} ${roundCoordinate(Math.abs(value))} mm`;
}
function formatVerticalCoordinate(value) {
  if (!Number.isFinite(value)) return '';
  return `U ${roundCoordinate(value)} mm`;
}
function roundCoordinate(value) { return Math.round(Number(value) * 1000) / 1000; }
function normalizeMemberId(value) {
  const text = clean(value).replace(/\(REF\)$/iu, '').replace(/^\/+/, '').toUpperCase();
  return text ? `/${text}` : '';
}
function stripLeadingSlash(value) { return clean(value).replace(/^\/+/, ''); }
function clean(value) { return value == null ? '' : String(value).trim(); }

export const _test = Object.freeze({
  deriveNominalSizeMm,
  firstAttribute,
  formatHorizontalCoordinate,
  formatVerticalCoordinate,
  joinMemberValues,
  resolveCarrierAttribute,
  resolveCarrierSize,
  resolvePrimaryPathField,
  supportPathHierarchy,
});
