import {
  SUPPORT_REPORT_DIAGNOSTICS,
  SUPPORT_REPORT_ROW_SCHEMA,
  SUPPORT_REPORT_SCHEMA,
} from './support-report-contract.js?v=20260909-support-report-carrier-conflict-13';
import {
  groupSupportReportClashEvidence,
  parseSupportReportClashXml,
} from './support-report-clash-safety.js?v=20260909-support-report-parser-primitives-8&location=20260911-support-report-location-attribution-22';
import {
  projectSupportReportFieldProvenance,
  projectSupportReportFields,
  supportReportCarrierAttributeConflicts,
} from './support-report-field-projection.js?v=20260910-support-report-field-provenance-14&rca=20260910-bore-site-zone-19&pos=20260911-support-report-pos-trace-20';
import {
  buildRowJsonTrace, enrichSupportReportFieldProvenance, enrichSupportReportProjectedFields,
  resolveSupportReportDatumMetadata, resolveSupportReportRowMembers, selectSupportReportDatumMetadataMembers,
} from './support-report-row-enrichment.js?v=20260911-support-report-pos-trace-20&location=20260911-support-report-location-attribution-22&prev=20260911-prevname-semantic-22&datum=20260911-datum-metadata-23';
import {
  supportReportMemberContextConflicts as memberContextConflictsGroup,
  supportReportMemberMatchesBranches as memberMatchesBranches,
  supportReportMemberMatchesLine as memberMatchesLine,
} from './support-report-member-context.js?v=20260911-datum-metadata-23';

const SYMBOLIC_ROLES = new Set(['DATUM', 'STRUCTURAL_REFERENCE']);
const CONCRETE_SUPPORT_MEMBER_RE = /^\/(?:PS|SL)-\d+[A-Z]?\.\d+$/iu;

export function buildSupportReportBundle(input = {}) {
  const relationshipBundle = normalizeBundle(input.relationshipBundle);
  const parsedEvidence = input.clashEvidence?.groups
    ? input.clashEvidence
    : parseSupportReportClashXml(input.clashXmlText || '', input.config || {});
  const groups = parsedEvidence.groups || groupSupportReportClashEvidence(parsedEvidence.rows || [], input.config || {});
  const diagnostics = [...(parsedEvidence.diagnostics || [])];
  if (!relationshipBundle) {
    diagnostics.push(diagnostic('INFO', SUPPORT_REPORT_DIAGNOSTICS.RELATIONSHIP_BUNDLE_UNAVAILABLE,
      'Support report was built from clash XML only. Load/build the relationship bundle to enrich complete member lists and native attributes.'));
  }

  const familyIndex = indexFamilies(relationshipBundle?.supportFamilies || []);
  const carriers = relationshipBundle?.supportCarrierResolution?.carrierObjects || [];
  const projections = groups.map((group, groupIndex) => projectGroup({
    group, groupIndex, relationshipBundle, familyIndex, carriers, diagnostics,
  }));
  const rows = projections
    .sort((left, right) => left.familyRank - right.familyRank
      || left.familyToken.localeCompare(right.familyToken)
      || left.memberRank - right.memberRank
      || left.groupIndex - right.groupIndex)
    .map((projection) => projection.row);

  return Object.freeze({
    schema: SUPPORT_REPORT_SCHEMA,
    sourceEvidenceSchema: parsedEvidence.schema,
    relationshipBundleSchema: relationshipBundle?.schema || null,
    evidenceMode: relationshipBundle ? 'CLASH_XML_PLUS_RELATIONSHIP_BUNDLE' : 'CLASH_XML_ONLY',
    summary: Object.freeze({
      clashEvidenceCount: parsedEvidence.rows?.length || 0,
      reportRowCount: rows.length,
      secondarySupportFamilyCount: unique(rows.map((row) => normalizeFamilyId(row.civilSecondarySupport))).length,
      enrichedRowCount: rows.filter((row) => row.evidence.selectedNativeMemberIds.length > 0).length,
      xmlOnlyRowCount: rows.filter((row) => row.evidence.selectedNativeMemberIds.length === 0).length,
      nativeOnlyMemberCount: rows.reduce((sum, row) => sum + row.evidence.nativeOnlyMemberIds.length, 0),
      multiLocationRowCount: rows.filter((row) => row.evidence.multipleLocationsOnPipe).length,
      datumMetadataRowCount: rows.filter((row) => row.evidence.metadataAttributionBasis === 'SINGLE_LOCATION_FAMILY_DATUM_METADATA').length,
      diagnosticCount: diagnostics.length,
    }),
    rows,
    diagnostics,
  });
}

function projectGroup({ group, groupIndex, relationshipBundle, familyIndex, carriers, diagnostics }) {
  const rowDiagnostics = [];
  const familyEntry = familyIndex.get(token(group.secondarySupportFamilyId)) || null;
  const family = familyEntry?.family || null;
  if (relationshipBundle && !family) {
    rowDiagnostics.push(diagnostic('WARN', SUPPORT_REPORT_DIAGNOSTICS.FAMILY_NOT_FOUND,
      `${group.secondarySupportFamilyId} is present in clash XML but not in the relationship bundle.`, {
        secondarySupportFamilyId: group.secondarySupportFamilyId, fullLineTag: group.fullLineTag,
      }));
  }

  const familyMembers = selectMembersForGroup(family, group);
  const resolution = resolveSupportReportRowMembers({ relationshipBundle, group, familyMembers });
  const selectedMembers = resolution.members;
  const metadataAttribution = selectSupportReportDatumMetadataMembers({ family, group, selectedMembers });
  const metadataMembers = metadataAttribution.members;
  const datumMetadata = resolveSupportReportDatumMetadata(metadataMembers);
  const selectedIds = selectedMembers.map((member) => normalizeMemberId(member.memberId)).filter(Boolean);
  const observedClashIds = unique(group.primarySupportMemberIds.map(normalizeMemberId));
  const clashIds = observedClashIds.filter(isConcreteSupportMemberId);
  const missingClashMembers = observedClashIds.filter((id) => !selectedIds.some((selected) => token(selected) === token(id))
    && !resolution.resolvedObservedIds.has(token(id)));
  const nativeOnlyMembers = selectedIds.filter((id) => !clashIds.some((clash) => token(clash) === token(id)));
  if (family && !selectedMembers.length) {
    rowDiagnostics.push(diagnostic('WARN', SUPPORT_REPORT_DIAGNOSTICS.MEMBER_ENRICHMENT_INCOMPLETE,
      `No native family members could be line-matched for ${group.secondarySupportFamilyId} on ${group.fullLineTag}; concrete clash members are retained as fallback.`, {
        secondarySupportFamilyId: group.secondarySupportFamilyId, fullLineTag: group.fullLineTag,
      }));
  }

  const reportMembers = selectedMembers.length
    ? selectedMembers
    : clashIds.map((memberId) => ({ memberId, semanticRole: '', attributes: {}, lineContext: {}, positionGlobal: null }));
  const projectedGroup = Object.freeze({ ...group, reportRemarks: resolution.reportRemarks });
  const resolvedCarrierObjectIds = resolvedCarrierIdsForMembers(selectedMembers);
  const carrierRows = selectCarriersForGroup(carriers, group, selectedMembers);
  if (relationshipBundle && !carrierRows.length) addCarrierUnavailableDiagnostic(
    rowDiagnostics, group, resolvedCarrierObjectIds,
  );
  const carrierAttributeConflicts = supportReportCarrierAttributeConflicts(carrierRows);
  if (carrierAttributeConflicts.length) addCarrierConflictDiagnostic(rowDiagnostics, group, carrierAttributeConflicts);

  const representativeMember = chooseRepresentativeMember(selectedMembers, clashIds);
  const nativePoint = representativeMember?.positionGlobal || null;
  const coordinatePoint = group.representativeClashPointGlobalMm || null;
  const coordinateSource = coordinatePoint ? 'CLASH_POINT_FALLBACK' : 'UNRESOLVED';
  if (coordinatePoint) addCoordinateBasisDiagnostic(rowDiagnostics, group, Boolean(nativePoint));

  const baseFields = projectSupportReportFields({ group: projectedGroup, reportMembers, carrierRows, coordinatePoint });
  const fields = enrichSupportReportProjectedFields(baseFields, {
    group: projectedGroup, reportMembers, reportRemarks: resolution.reportRemarks, datumMetadata,
  });
  const baseProvenance = projectSupportReportFieldProvenance({
    group: projectedGroup, reportMembers, carrierRows, coordinateSource, coordinateSourceIds: [],
    selectedNativeMemberCount: selectedMembers.length,
  });
  const fieldProvenance = enrichSupportReportFieldProvenance(baseProvenance, baseFields, fields, {
    group: projectedGroup, reportMembers, reportRemarks: resolution.reportRemarks, datumMetadata,
  });
  const jsonTrace = buildRowJsonTrace({
    group: projectedGroup, resolution, nativeMembers: selectedMembers, metadataMembers, datumMetadata,
    metadataAttributionBasis: metadataAttribution.basis,
  });

  const row = Object.freeze({
    schema: SUPPORT_REPORT_ROW_SCHEMA,
    rowId: group.groupId,
    ...fields,
    evidence: Object.freeze({
      evidenceMode: relationshipBundle ? 'CLASH_XML_PLUS_RELATIONSHIP_BUNDLE' : 'CLASH_XML_ONLY',
      clashCount: group.clashCount,
      clashMemberIds: observedClashIds,
      selectedNativeMemberIds: selectedIds,
      nativeOnlyMemberIds: nativeOnlyMembers,
      missingClashMemberIds: missingClashMembers,
      branchNodes: group.branchNodes,
      locationIndex: group.locationIndex ?? 0,
      locationCountOnPipe: group.locationCountOnPipe ?? 1,
      locationMergeToleranceMm: group.locationMergeToleranceMm ?? null,
      locationGroupingBasis: Object.freeze([...(group.locationGroupingBasis || [])]),
      memberAttributionBasis: resolution.memberAttributionBasis || '',
      metadataAttributionBasis: metadataAttribution.basis,
      metadataSourceMemberIds: Object.freeze([...(datumMetadata.sourceIds || [])]),
      metadataAttributeConflicts: Object.freeze([...(datumMetadata.conflicts || [])]),
      multipleLocationsOnPipe: Boolean(group.multipleLocationsOnPipe),
      resolvedCarrierObjectIds,
      carrierObjectIds: carrierRows.map((carrier) => carrier.carrierObjectId).filter(Boolean),
      carrierAttributeConflicts,
      jsonTrace,
      fieldProvenance,
      nativeCoordinateAvailable: Boolean(nativePoint),
      nativeCoordinateUsedForReport: false,
      reportCoordinateBasis: coordinatePoint ? 'NAVISWORKS_CLASH_LOCATION' : 'UNRESOLVED',
      clashCoordinateFallbackUsed: Boolean(coordinatePoint),
    }),
    diagnostics: rowDiagnostics,
  });
  diagnostics.push(...rowDiagnostics);
  return {
    row,
    familyRank: familyEntry?.index ?? Number.MAX_SAFE_INTEGER,
    familyToken: token(group.secondarySupportFamilyId),
    memberRank: memberOrderRank(family, selectedMembers),
    groupIndex,
  };
}

function addCarrierUnavailableDiagnostic(rows, group, resolvedIds) {
  const mismatch = resolvedIds.length > 0;
  rows.push(diagnostic(
    mismatch ? 'WARN' : 'INFO', SUPPORT_REPORT_DIAGNOSTICS.CARRIER_ENRICHMENT_UNAVAILABLE,
    mismatch
      ? `Resolved carrier object(s) ${resolvedIds.join(', ')} for selected support members are absent from the carrier catalog; line/branch fallback was not used.`
      : `No authoritative carrier object was line-matched for ${group.fullLineTag}; pipe metadata may be incomplete.`,
    { fullLineTag: group.fullLineTag, resolvedCarrierObjectIds: resolvedIds },
  ));
}
function addCarrierConflictDiagnostic(rows, group, conflicts) {
  rows.push(diagnostic('WARN', SUPPORT_REPORT_DIAGNOSTICS.CARRIER_ATTRIBUTE_CONFLICT,
    `Conflicting authoritative carrier metadata was found for ${conflicts.map((item) => item.field).join(', ')}; conflicting report fields were left blank.`,
    { fullLineTag: group.fullLineTag, carrierAttributeConflicts: conflicts }));
}
function addCoordinateBasisDiagnostic(rows, group, nativeAvailable) {
  const suffix = nativeAvailable
    ? ' Native staged POS is retained in JSON Trace but is not report-coordinate authority until coordinate-frame/base-anchor qualification exists.'
    : '';
  rows.push(diagnostic('INFO', SUPPORT_REPORT_DIAGNOSTICS.COORDINATE_FROM_CLASH_FALLBACK,
    `Coordinates for ${group.secondarySupportFamilyId} / ${group.fullLineTag} use the Navisworks clash/report location.${suffix}`, {
      secondarySupportFamilyId: group.secondarySupportFamilyId, fullLineTag: group.fullLineTag,
      nativeCoordinateAvailable: nativeAvailable,
    }));
}

function selectMembersForGroup(family, group) {
  if (!family) return [];
  const candidates = (family.members || []).filter(isReportableMember);
  const exactLine = candidates.filter((member) => memberMatchesLine(member, group.fullLineTag));
  const branchMatches = candidates.filter((member) => memberMatchesBranches(member, group));
  const directClash = candidates.filter((member) => group.primarySupportMemberIds
    .some((id) => token(id) === token(member.memberId)))
    .filter((member) => !memberContextConflictsGroup(member, group));
  const selected = exactLine.length ? exactLine : branchMatches.length ? branchMatches : directClash;
  return uniqueMembers([...selected, ...directClash]);
}

function selectCarriersForGroup(carriers, group, selectedMembers = []) {
  const candidates = carriers || [];
  const resolvedIds = resolvedCarrierIdsForMembers(selectedMembers).map(token);
  if (resolvedIds.length) {
    const resolvedSet = new Set(resolvedIds);
    return candidates.filter((carrier) => resolvedSet.has(token(carrier?.carrierObjectId)));
  }
  const exact = candidates.filter((carrier) => sameLine(carrier.lineContext?.fullLineTag, group.fullLineTag));
  if (exact.length) return exact;
  const branchTokens = new Set((group.branchNodes || []).map(token));
  return candidates.filter((carrier) => {
    const context = carrier?.lineContext || {};
    if (clean(context.fullLineTag)) return false;
    return branchTokens.has(token(context.branchNode));
  });
}
function resolvedCarrierIdsForMembers(members) {
  return unique((members || []).map((member) => {
    const resolution = member?.carrierResolution || {};
    return resolution.physicalCarrierObjectAvailable && clean(resolution.carrierObjectId)
      ? resolution.carrierObjectId : '';
  }));
}
function isReportableMember(member) {
  if (!member || SYMBOLIC_ROLES.has(String(member.semanticRole || '').toUpperCase())) return false;
  return isConcreteSupportMemberId(normalizeMemberId(member.memberId));
}
function isConcreteSupportMemberId(value) { return CONCRETE_SUPPORT_MEMBER_RE.test(normalizeMemberId(value)); }
function uniqueMembers(members) {
  const seen = new Set();
  return (members || []).filter((member) => {
    const key = token(member.memberId);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function chooseRepresentativeMember(members, clashMemberIds) {
  const direct = (members || []).find((member) => member.positionGlobal
    && clashMemberIds.some((id) => token(id) === token(member.memberId)));
  return direct || (members || []).find((member) => member.positionGlobal) || null;
}
function indexFamilies(families) {
  const map = new Map();
  (families || []).forEach((family, index) => {
    const key = token(family.familyId);
    if (key && !map.has(key)) map.set(key, { family, index });
  });
  return map;
}
function memberOrderRank(family, selectedMembers) {
  if (!family || !selectedMembers?.length) return Number.MAX_SAFE_INTEGER;
  const order = new Map((family.members || []).map((member, index) => [token(member.memberId), index]));
  const ranks = selectedMembers.map((member) => order.get(token(member.memberId))).filter(Number.isFinite);
  return ranks.length ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER;
}
function normalizeBundle(bundle) {
  if (!bundle) return null;
  if (typeof bundle === 'string') { try { return JSON.parse(bundle); } catch { return null; } }
  return typeof bundle === 'object' ? bundle : null;
}
function normalizeMemberId(value) {
  const text = clean(value).replace(/\(REF\)$/iu, '').replace(/^\/+/, '').toUpperCase();
  return text ? `/${text}` : '';
}
function normalizeFamilyId(value) { return clean(value).replace(/\(REF\)$/iu, '').replace(/^\/+/, '').toUpperCase(); }
function sameLine(left, right) {
  const leftToken = token(lineFromBranch(left));
  return Boolean(leftToken) && leftToken === token(lineFromBranch(right));
}
function lineFromBranch(value) { return stripLeadingSlash(value).replace(/\/B(?:RANCH)?[-_A-Z0-9.]*$/iu, ''); }
function stripLeadingSlash(value) { return clean(value).replace(/^\/+/, ''); }
function clean(value) { return value == null ? '' : String(value).trim(); }
function token(value) { return stripLeadingSlash(value).replace(/\(REF\)$/iu, '').toUpperCase(); }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
function diagnostic(severity, code, message, extra = {}) { return Object.freeze({ severity, code, message, ...extra }); }

export const _test = Object.freeze({
  selectMembersForGroup, selectCarriersForGroup, resolvedCarrierIdsForMembers, memberContextConflictsGroup,
  isConcreteSupportMemberId,
});
