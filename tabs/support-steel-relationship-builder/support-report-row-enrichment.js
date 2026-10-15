import { SUPPORT_REPORT_MULTI_LOCATION_REMARK } from './support-report-location-grouping.js?v=20260911-support-report-location-attribution-22';
import {
  supportReportPreviousName,
} from './support-report-field-normalization.js?v=20260911-prevname-semantic-22';
import {
  buildSupportReportJsonTrace,
  resolveSupportReportObservedMembers,
  supportReportFamilyMismatchMemberIds,
} from './support-report-json-trace.js?v=20260911-prevname-semantic-22';
import {
  supportReportMemberMatchesBranches,
  supportReportMemberMatchesLine,
} from './support-report-member-context.js?v=20260911-datum-metadata-23';

const SUPPORT_TYPE_KEYS = Object.freeze([
  'CMPSUPTYPE', 'MDSSUPPTYPE', 'SUPPORT_TYPE', 'SUPTYPE', 'TYPE_TEXT', 'STYPE',
]);
const SUPPORT_REFERENCE_KEYS = Object.freeze([
  'PIPING_PRIMARY_SUPPORT_REFERENCE', 'PRIMARY_SUPPORT_REFERENCE', 'SUPPORT_REFERENCE',
  'SUPPORT_REF', 'DBREF', 'REFNO', 'REFERENCE', 'REF',
]);
const DESCRIPTION_KEYS = Object.freeze(['DTXR', 'DESCRIPTION', 'DESC', 'LONG_DESCRIPTION']);
const INSULATION_THICKNESS_KEYS = Object.freeze([
  'PIPE_INSULATION_THICKNESS', 'INSULATION_THICKNESS', 'INS_THK', 'ITHK', 'THICKNESS_INSULATION', 'INSU',
]);
const DATUM_FIELD_SPECS = Object.freeze([
  Object.freeze({ field: 'supportType', keys: SUPPORT_TYPE_KEYS }),
  Object.freeze({ field: 'pipingPrimarySupportReference', keys: SUPPORT_REFERENCE_KEYS }),
  Object.freeze({ field: 'primarySupportDescription', keys: DESCRIPTION_KEYS }),
  Object.freeze({ field: 'pipeInsulationThickness', keys: INSULATION_THICKNESS_KEYS }),
]);
const DATUM_SOURCE_CLASS = 'AUTHORITATIVE_NATIVE_FAMILY_DATUM_ATTRIBUTE';
const SOURCE_CONFLICT_CLASS = 'AUTHORITATIVE_SOURCE_CONFLICT';

export function resolveSupportReportRowMembers({ relationshipBundle, group, familyMembers = [] } = {}) {
  const observed = resolveSupportReportObservedMembers(
    relationshipBundle,
    group?.primarySupportMemberIds || [],
    group,
  );
  const attribution = locationScopedFamilyMembers(group, familyMembers);
  const members = uniqueMembers([...attribution.members, ...observed.members]);
  const resolvedObservedIds = new Set(observed.matches.filter((match) => match.member).map((match) => token(match.observedMemberId)));
  const reportRemarks = rowRemarks(group, observed.matches);
  return Object.freeze({
    members: Object.freeze(members),
    observedMatches: observed.matches,
    resolvedObservedIds,
    reportRemarks: Object.freeze(reportRemarks),
    memberAttributionBasis: attribution.basis,
  });
}

export function selectSupportReportDatumMetadataMembers({ family, group, selectedMembers = [] } = {}) {
  if (selectedMembers.length) return Object.freeze({ members: Object.freeze([]), basis: 'CONCRETE_MEMBER_METADATA' });
  if (Number(group?.locationCountOnPipe || 1) > 1) {
    return Object.freeze({ members: Object.freeze([]), basis: 'MULTI_LOCATION_DATUM_METADATA_DISABLED' });
  }
  const members = (family?.members || []).filter((member) => String(member?.semanticRole || '').toUpperCase() === 'DATUM')
    .filter((member) => supportReportMemberMatchesLine(member, group?.fullLineTag)
      || supportReportMemberMatchesBranches(member, group));
  return Object.freeze({
    members: Object.freeze(members),
    basis: members.length ? 'SINGLE_LOCATION_FAMILY_DATUM_METADATA' : 'NO_DATUM_METADATA',
  });
}

export function resolveSupportReportDatumMetadata(metadataMembers = []) {
  const fields = {};
  const conflicts = [];
  for (const spec of DATUM_FIELD_SPECS) {
    const resolved = resolveMemberAttribute(metadataMembers, spec.keys);
    fields[spec.field] = resolved;
    if (resolved.conflict) conflicts.push(Object.freeze({
      field: spec.field,
      values: resolved.values,
      sourceIds: resolved.sourceIds,
    }));
  }
  const sourceIds = unique((metadataMembers || []).map((member) => normalizeMemberId(member?.memberId)).filter(Boolean));
  return Object.freeze({
    sourceIds: Object.freeze(sourceIds),
    fields: Object.freeze(fields),
    conflicts: Object.freeze(conflicts),
  });
}

export function enrichSupportReportProjectedFields(fields, input = {}) {
  const { reportMembers = [], reportRemarks = [], datumMetadata = null } = input;
  const nativeRemarks = clean(fields?.remarks);
  const derivedRemarks = reportRemarks.filter(Boolean).join('; ');
  const reportInsulation = consistentMemberAttribute(reportMembers, INSULATION_THICKNESS_KEYS);
  return Object.freeze({
    ...fields,
    previousName: reportablePreviousNames(reportMembers),
    supportType: clean(fields?.supportType) || datumValue(datumMetadata, 'supportType'),
    pipingPrimarySupportReference: clean(fields?.pipingPrimarySupportReference)
      || datumValue(datumMetadata, 'pipingPrimarySupportReference'),
    primarySupportDescription: clean(fields?.primarySupportDescription)
      || datumValue(datumMetadata, 'primarySupportDescription'),
    pipeInsulationThickness: clean(fields?.pipeInsulationThickness) || reportInsulation
      || datumValue(datumMetadata, 'pipeInsulationThickness'),
    remarks: [nativeRemarks, derivedRemarks].filter(Boolean).join('; '),
  });
}

export function enrichSupportReportFieldProvenance(provenance, fields, enriched, input = {}) {
  const { reportMembers = [], reportRemarks = [], datumMetadata = null } = input;
  const output = { ...(provenance || {}) };
  const previousNameMemberIds = reportMembers.filter((member) => supportReportPreviousName(member))
    .map((member) => normalizeMemberId(member.memberId));
  output.previousName = previousNameMemberIds.length
    ? source('AUTHORITATIVE_NATIVE_MEMBER_ATTRIBUTE', previousNameMemberIds)
    : unresolvedSource();
  applyDatumProvenance(output, fields, enriched, datumMetadata, 'supportType');
  applyDatumProvenance(output, fields, enriched, datumMetadata, 'pipingPrimarySupportReference');
  applyDatumProvenance(output, fields, enriched, datumMetadata, 'primarySupportDescription');
  if (!clean(fields?.pipeInsulationThickness) && clean(enriched?.pipeInsulationThickness)) {
    const nativeIds = memberIdsWithAttribute(reportMembers, INSULATION_THICKNESS_KEYS);
    output.pipeInsulationThickness = nativeIds.length
      ? source('AUTHORITATIVE_NATIVE_MEMBER_ATTRIBUTE', nativeIds)
      : datumProvenance(datumMetadata, 'pipeInsulationThickness');
  } else if (!clean(fields?.pipeInsulationThickness) && datumField(datumMetadata, 'pipeInsulationThickness')?.conflict) {
    output.pipeInsulationThickness = datumProvenance(datumMetadata, 'pipeInsulationThickness');
  }
  if (reportRemarks.length && !clean(fields?.remarks)) output.remarks = source('CLASH_GROUP_DERIVATION');
  if (reportRemarks.length && clean(fields?.remarks)) output.remarks = source('DETERMINISTIC_FIELD_COMPOSITION');
  return Object.freeze(output);
}

export function buildRowJsonTrace({ group, resolution, nativeMembers = [], metadataMembers = [], datumMetadata = null,
  metadataAttributionBasis = '' } = {}) {
  const trace = buildSupportReportJsonTrace({
    group,
    observedMatches: resolution?.observedMatches || [],
    nativeMembers,
  });
  return Object.freeze({
    ...trace,
    locationGroupingBasis: Object.freeze([...(group?.locationGroupingBasis || [])]),
    memberAttributionBasis: resolution?.memberAttributionBasis || '',
    metadataAttributionBasis,
    metadataSourceMemberIds: Object.freeze([...(datumMetadata?.sourceIds || [])]),
    metadataAttributeConflicts: Object.freeze([...(datumMetadata?.conflicts || [])]),
    metadataSources: Object.freeze((metadataMembers || []).map(metadataSourceEvidence)),
    primarySupportAssemblyId: clean(group?.primarySupportAssemblyId),
    primarySupportAssemblyStatus: clean(group?.primarySupportAssemblyStatus),
    primarySupportAssemblyBasis: clean(group?.primarySupportAssemblyBasis),
    primarySupportAssemblyCandidateIds: Object.freeze([...(group?.primarySupportAssemblyCandidateIds || [])]),
    primarySupportAssemblyProvisionalId: clean(group?.primarySupportAssemblyProvisionalId),
    primarySupportAssemblyCountBasis: clean(group?.primarySupportAssemblyCountBasis),
    primarySupportFamilyExplicitAssemblyIds: Object.freeze([...(group?.primarySupportFamilyExplicitAssemblyIds || [])]),
    primarySupportFamilyGeometryOnlyGroupIds: Object.freeze([...(group?.primarySupportFamilyGeometryOnlyGroupIds || [])]),
    primarySupportFamilyAmbiguityCount: Number(group?.primarySupportFamilyAmbiguityCount || 0),
    multiplePrimarySupport: Boolean(group?.multiplePrimarySupport),
  });
}

function locationScopedFamilyMembers(group, familyMembers) {
  const members = familyMembers || [];
  if (Number(group?.locationCountOnPipe || 1) <= 1) {
    return {
      members,
      basis: members.length ? 'SINGLE_LOCATION_FAMILY_LINE_ENRICHMENT' : 'OBSERVED_MEMBER_RESOLUTION_ONLY',
    };
  }
  const observed = new Set((group?.primarySupportMemberIds || []).map(token).filter(Boolean));
  const direct = members.filter((member) => observed.has(token(member?.memberId)));
  return {
    members: direct,
    basis: direct.length ? 'MULTI_LOCATION_OBSERVED_MEMBER_ONLY' : 'MULTI_LOCATION_OBSERVED_RESOLUTION_ONLY',
  };
}

function rowRemarks(group, matches) {
  const remarks = [];
  if (group?.multiplePrimarySupport) remarks.push(SUPPORT_REPORT_MULTI_LOCATION_REMARK);
  const mismatches = supportReportFamilyMismatchMemberIds(group);
  for (const memberId of mismatches) {
    const resolved = matches.find((match) => token(match.observedMemberId) === token(memberId));
    if (resolved?.matchBasis === 'PREVIOUS_NAME_ALIAS' && resolved.member) {
      remarks.push(`Primary support renamed from ${normalizeMemberId(memberId)}`);
    } else {
      remarks.push(`Primary support family mismatch: ${normalizeMemberId(memberId)} under ${group.secondarySupportFamilyId}; rename required`);
    }
  }
  return unique(remarks);
}

function reportablePreviousNames(members) {
  return (members || []).map(supportReportPreviousName).map(clean).filter(Boolean).join(', ');
}
function consistentMemberAttribute(members, keys) {
  return resolveMemberAttribute(members, keys).value;
}
function resolveMemberAttribute(members, keys) {
  const rows = (members || []).map((member) => ({
    sourceId: normalizeMemberId(member?.memberId),
    value: attribute(member?.attributes || {}, keys),
  })).filter((row) => row.value);
  const values = unique(rows.map((row) => row.value)).sort((a, b) => a.localeCompare(b));
  return Object.freeze({
    value: values.length === 1 ? values[0] : '',
    conflict: values.length > 1,
    values: Object.freeze(values),
    sourceIds: Object.freeze(unique(rows.map((row) => row.sourceId).filter(Boolean))),
  });
}
function datumField(metadata, field) { return metadata?.fields?.[field] || null; }
function datumValue(metadata, field) {
  const resolved = datumField(metadata, field);
  return resolved && !resolved.conflict ? clean(resolved.value) : '';
}
function applyDatumProvenance(output, fields, enriched, metadata, field) {
  const resolved = datumField(metadata, field);
  if (!resolved || clean(fields?.[field])) return;
  if (resolved.conflict || clean(enriched?.[field])) output[field] = datumProvenance(metadata, field);
}
function datumProvenance(metadata, field) {
  const resolved = datumField(metadata, field);
  if (!resolved) return unresolvedSource();
  if (resolved.conflict) return source(SOURCE_CONFLICT_CLASS, resolved.sourceIds, { values: resolved.values, valueStatus: 'CONFLICT' });
  return resolved.value ? source(DATUM_SOURCE_CLASS, resolved.sourceIds) : unresolvedSource();
}
function memberIdsWithAttribute(members, keys) {
  return (members || []).filter((member) => attribute(member?.attributes || {}, keys)).map((member) => normalizeMemberId(member.memberId));
}
function metadataSourceEvidence(member) {
  return Object.freeze({
    memberId: normalizeMemberId(member?.memberId),
    sourcePath: Object.freeze([...(member?.sourcePath || [])]),
    lineContext: member?.lineContext ? Object.freeze({ ...member.lineContext }) : null,
  });
}
function attribute(attrs, keys) {
  const normalized = new Map(Object.entries(attrs || {}).map(([key, value]) => [normalizeKey(key), value]));
  for (const key of keys) {
    const value = clean(normalized.get(normalizeKey(key)));
    if (value) return value;
  }
  return '';
}
function source(sourceClass, sourceIds = [], extra = {}) {
  return Object.freeze({
    sourceClass,
    confidenceClass: sourceClass.startsWith('AUTHORITATIVE_') && sourceClass !== SOURCE_CONFLICT_CLASS ? 'AUTHORITATIVE'
      : sourceClass.startsWith('DETERMINISTIC_') ? 'DETERMINISTIC'
        : sourceClass === SOURCE_CONFLICT_CLASS ? 'CONFLICT' : 'EVIDENCE',
    valueStatus: extra.valueStatus || 'RESOLVED',
    sourceIds: Object.freeze(unique(sourceIds)),
    ...extra,
  });
}
function unresolvedSource() {
  return Object.freeze({
    sourceClass: 'UNRESOLVED', confidenceClass: 'UNRESOLVED', valueStatus: 'UNRESOLVED', sourceIds: Object.freeze([]),
  });
}
function uniqueMembers(members) {
  const seen = new Set();
  return members.filter((member) => {
    const key = token(member?.memberId);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function normalizeMemberId(value) { const text = clean(value).replace(/^\/+/, '').toUpperCase(); return text ? `/${text}` : ''; }
function normalizeKey(value) { return String(value || '').replace(/[\s./-]+/g, '_').toUpperCase(); }
function token(value) { return clean(value).replace(/\(REF\)$/iu, '').replace(/^\/+/, '').toUpperCase(); }
function clean(value) { return value == null ? '' : String(value).trim(); }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }

export const _test = Object.freeze({ locationScopedFamilyMembers, reportablePreviousNames, resolveMemberAttribute });